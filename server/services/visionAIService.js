/**
 * Vision AI Service — Primary Image Analysis Pipeline for PRAMAN
 * 
 * Replaces traditional OCR with direct Multimodal Vision AI:
 * - Direct image inspection via OpenAI (GPT-4o-mini / GPT-4o) and Google Gemini
 * - Strict anti-hallucination prompting: only extracts visible pixels
 * - Preserves exact packaging text without guessing or demo substitutions
 * - Multi-image intelligence: inspects front, back, and sides together
 * - Modular provider abstraction (swappable via .env)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prepareImageForVisionAI, createEvidenceCrop } from './imagePreprocessor.js';
import { analyzeImagesForCodes } from './qrBarcodeService.js';

// Base Vision Provider
export class BaseVisionProvider {
  async analyze(images, options) {
    throw new Error('analyze() must be implemented by provider');
  }
  getName() {
    return 'base_vision';
  }
}

/**
 * OpenAI Vision Provider (GPT-4o / GPT-4o-mini)
 */
export class OpenAIVisionProvider extends BaseVisionProvider {
  constructor(apiKey, model) {
    super();
    this.apiKey = apiKey;
    this.model = model || process.env.VISION_MODEL || 'gpt-4o-mini';
  }

  getName() {
    return 'openai_vision';
  }

  getModel() {
    return this.model;
  }

  getApiKey() {
    if (this.apiKey && this.apiKey.trim().length > 10) {
      return this.apiKey.trim();
    }
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10) {
      return process.env.OPENAI_API_KEY.trim();
    }
    // Also check Windows registry User/Machine environment variables in case added without terminal restart
    if (process.platform === 'win32') {
      try {
        const userKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'OPENAI_API_KEY\', \'User\')"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (userKey && userKey.length > 10) return userKey;
        const machineKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'OPENAI_API_KEY\', \'Machine\')"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (machineKey && machineKey.length > 10) return machineKey;
      } catch (_) {}
    }
    return '';
  }

  isConfigured() {
    return this.getApiKey().length > 10;
  }

  async analyze(images, options = {}) {
    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        success: false,
        error: 'OPENAI_API_KEY is not configured in .env or system environment variables. Please add OPENAI_API_KEY=sk-... to your .env file or Windows environment variables.',
        declarations: null,
        needs_config: true
      };
    }

    const contentItems = [
      {
        type: 'text',
        text: buildSystemPrompt(options)
      }
    ];

    // Attach all uploaded package images as base64 JPEG buffers
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const base64Data = img.buffer.toString('base64');
      const label = img.label || `Image ${i + 1} (${img.type || 'packaging'})`;

      contentItems.push({
        type: 'text',
        text: `[ATTACHED PACKAGING IMAGE ${i + 1}]: Label: ${label}, Original File: ${img.originalName || 'image.jpg'}`
      });

      contentItems.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
          detail: 'high'
        }
      });
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: contentItems
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3500,
      temperature: 0.1 // Near zero to strictly prevent creative hallucination
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const errJson = JSON.parse(errorText);
        parsedMsg = errJson.error?.message || errorText;
      } catch (_) {}
      throw new Error(`OpenAI Vision API error (${response.status}): ${parsedMsg}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch (parseErr) {
      throw new Error('Failed to parse OpenAI Vision response as JSON: ' + parseErr.message);
    }

    return {
      success: true,
      data: parsedResult,
      raw_response: rawContent,
      usage: data.usage || null
    };
  }
}

/**
 * Google Gemini Vision Provider (Gemini 1.5 / 2.0 Flash)
 */
export class GeminiVisionProvider extends BaseVisionProvider {
  constructor(apiKey, model) {
    super();
    this.apiKey = apiKey;
    this.model = model || process.env.VISION_MODEL || 'gemini-3.6-flash';
  }

  getName() {
    return 'gemini_vision';
  }

  getModel() {
    return this.model;
  }

  getApiKey() {
    if (this.apiKey && this.apiKey.trim().length > 10 && this.apiKey.trim() !== 'your_key_here') {
      return this.apiKey.trim();
    }
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (envKey && envKey.trim().length > 10 && envKey.trim() !== 'your_key_here') {
      return envKey.trim();
    }
    // Also check Windows registry User/Machine environment variables
    if (process.platform === 'win32') {
      try {
        const userKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'GEMINI_API_KEY\', \'User\')"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (userKey && userKey.length > 10 && userKey !== 'your_key_here') return userKey;
        const machineKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'GEMINI_API_KEY\', \'Machine\')"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (machineKey && machineKey.length > 10 && machineKey !== 'your_key_here') return machineKey;
      } catch (_) {}
    }
    return '';
  }

  isConfigured() {
    return this.getApiKey().length > 10;
  }

  async analyze(images, options = {}) {
    const activeKey = this.getApiKey();
    if (!activeKey) {
      return {
        success: false,
        error: 'GEMINI_API_KEY is not configured in .env (or still set to placeholder). Please add your real Gemini API key (GEMINI_API_KEY=AIza...) to your .env file to enable automated packaging extraction.',
        declarations: null,
        needs_config: true
      };
    }

    const systemPromptText = buildSystemPrompt(options);

    const parts = [
      { text: systemPromptText + '\n\nPlease analyze all attached packaging images and return the extracted declarations as the specified JSON object.' }
    ];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      parts.push({
        text: `[PACKAGING IMAGE ${i + 1} - ${img.label || img.type || 'panel'} (Filename: ${img.originalName || 'image.jpg'})]:`
      });
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.buffer.toString('base64')
        }
      });
    }

    const candidateModels = [this.model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].filter((m, i, a) => Boolean(m) && a.indexOf(m) === i);
    let lastError = null;

    for (const modelToTry of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${activeKey}`;

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            let errMsg = errText;
            try {
              const errJson = JSON.parse(errText);
              errMsg = errJson.error?.message || errText;
            } catch (_) {}

            lastError = new Error(`Google Gemini Vision API error (${response.status} on ${modelToTry}): ${errMsg}`);

            // If transient overload (503/429), back off and retry or fail over to next model
            if (response.status === 503 || response.status === 429) {
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1200 * attempt));
                continue;
              } else {
                // On second failure of this model, break inner loop to try next candidate model immediately
                break;
              }
            }

            // Other error, break attempt loop to try next model
            break;
          }

          const data = await response.json();
          const candidate = data.candidates?.[0];
          if (!candidate) {
            const promptFeedback = data.promptFeedback ? JSON.stringify(data.promptFeedback) : 'No candidate returned';
            throw new Error(`Google Gemini Vision API returned no content: ${promptFeedback}`);
          }

          let candidateText = candidate.content?.parts?.[0]?.text || '{}';
          candidateText = candidateText.trim();
          if (candidateText.startsWith('```')) {
            candidateText = candidateText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          }

          let parsed;
          try {
            parsed = JSON.parse(candidateText);
          } catch (parseErr) {
            throw new Error('Failed to parse Gemini Vision response as JSON: ' + parseErr.message + '\nRaw response: ' + candidateText.slice(0, 300));
          }

          return {
            success: true,
            data: parsed,
            raw_response: candidateText,
            model_used: modelToTry
          };
        } catch (callErr) {
          lastError = callErr;
          if (callErr.message.includes('503') || callErr.message.includes('high demand') || callErr.message.includes('429')) {
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 1200 * attempt));
              continue;
            } else {
              break; // Try next model candidate
            }
          }
          break; // Try next candidate model
        }
      }
    }

    throw lastError || new Error('Gemini Vision analysis failed across all attempts and candidate models.');
  }
}

/**
 * Vision Provider Factory
 */
export function getVisionProvider() {
  const providerName = (process.env.VISION_PROVIDER || 'gemini').toLowerCase();
  if (providerName === 'openai') {
    return new OpenAIVisionProvider();
  }
  return new GeminiVisionProvider();
}

/**
 * Builds the strict anti-hallucination prompt instructing the Vision AI
 */
function buildSystemPrompt(options = {}) {
  const productHint = options.product_name ? `Reported product hint: "${options.product_name}".` : '';
  const categoryHint = options.category ? `Category: "${options.category}".` : '';

  return `You are PRAMAN AI Vision Inspector for the Ministry of Consumer Affairs, Government of India (Legal Metrology Packaged Commodities Rules, 2011).
You are analyzing high-resolution photographs of packaged food commodities uploaded during official regulatory inspections.
${productHint} ${categoryHint}

CRITICAL ANTI-HALLUCINATION DIRECTIVES:
1. ONLY extract declarations and numbers that are ACTUALLY visible in the attached packaging photographs.
2. NEVER guess, invent, fabricate, or extrapolate missing text.
3. NEVER infer MRP, net weight, dates, or manufacturer from brand knowledge or general training data.
4. If text is blurry, folded, curved, faint, or cut off: status MUST BE "uncertain" or "illegible".
5. If a declaration is not found across all uploaded photos: status MUST BE "not_detected".
6. If a panel of packaging is clearly absent: status MUST BE "not_visible".
7. For MRP specifically:
   - Carefully read variations: "MRP ₹...", "MRP Rs. ...", "M.R.P. Rs ...", "Maximum Retail Price ₹...", "MRP Rs. ... incl. of all taxes", "(₹ ... / g)".
   - Preserve exact symbols, rupees, and decimals as printed.
   - If the price digits are ambiguous (e.g. could be 10 vs 70), DO NOT choose one; mark status = "uncertain" and explain in evidence.
8. MULTI-IMAGE INTELLIGENCE & CONFLICT DETECTION:
   - Consolidate declarations across ALL provided images (Front, Back, Side). If brand is on front and MRP/Net Weight is on back/side, combine them into one unified record.
   - Do NOT mark something missing simply because it is absent in one image if it appears in another.
   - If two images contain conflicting values (e.g., differing prices or different dates printed on panels), mark status = "uncertain", document BOTH observed values and image sources in the evidence field, and flag for officer verification.
9. DATES & SHELF LIFE EXTRACTION:
   Specifically inspect for keywords:
   - EXP, EXPIRY, EXPIRY DATE
   - USE BY
   - BEST BEFORE, BEST BEFORE END
   - SHELF LIFE
   - MFG, MANUFACTURED, DATE OF MANUFACTURE
   - PKD, PACKED, DATE OF PACKING
   You MUST extract and separate these into their individual fields:
   - manufacturing_date: exact verbatim text/date (e.g., "01/2026", "07/01/2026")
   - packing_date: exact verbatim text/date (e.g., "PKD 07/01/26")
   - expiry_date: exact verbatim text/date (e.g., "EXP 12/2026")
   - use_by_date: exact verbatim text/date (e.g., "USE BY 15/10/2026")
   - best_before: exact verbatim statement (e.g., "BEST BEFORE 6 MONTHS FROM PACKAGING")
   - shelf_life: exact shelf-life statement if printed (e.g., "6 MONTHS", "180 DAYS")
   DO NOT merge these into one date! If the package says "BEST BEFORE 6 MONTHS FROM PACKAGING", store exactly that statement. If date is unclear: status = "uncertain". NEVER guess or calculate an expiry date unless both dates and duration are explicitly and deterministically present.
10. QR CODE & BARCODE INSPECTION:
   Inspect packaging panels for physical QR codes and Barcodes.
   Report presence and approximate visual location. Do NOT fabricate QR contents or assume compliance.

You MUST respond with valid JSON matching EXACTLY this structure:
{
  "product_name": {
    "value": "string (brand + commodity description as visible on pack)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment visible on packaging",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax] // normalized 0-1000 or null
  },
  "generic_name": {
    "value": "string (e.g. Biscuits, Cookies, Atta, Rice)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "net_quantity": {
    "value": "string (e.g. 100 g, 5 kg, 500 ml)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. NET WEIGHT: 100 g)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "mrp": {
    "value": "string (e.g. ₹30.00)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. MRP ₹ 30.00 INCL. OF ALL TAXES)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "manufacturer_name": {
    "value": "string (name of manufacturer)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "packer_name": {
    "value": "string (name of packer if distinct from manufacturer)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "importer_name": {
    "value": "string (name of importer if imported commodity)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "manufacturer_address": {
    "value": "string (complete postal address with state and PIN code if visible)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "manufacturing_date": {
    "value": "string (e.g. 01/2026 or MFG 01/26)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "packing_date": {
    "value": "string (e.g. 07/01/26 or PKD 01/2026)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. PKD.: 7/01/26)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "expiry_date": {
    "value": "string (e.g. 12/2026 or EXP 12/26)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. EXP 12/2026)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "use_by_date": {
    "value": "string (e.g. USE BY 15/10/2026)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "best_before": {
    "value": "string (exact verbatim statement, e.g. BEST BEFORE 6 MONTHS FROM PACKAGING)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. Best Before 6 Months From Packaging)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "shelf_life": {
    "value": "string (e.g. 6 MONTHS, 180 DAYS)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "batch_number": {
    "value": "string (e.g. T3 C or HS-IND-2026)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "consumer_care": {
    "value": "string (phone number, toll-free, email, website)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. 1800 22 2000, cs@parle.biz)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "country_of_origin": {
    "value": "string (e.g. India)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment (e.g. FOR SALE IN INDIA ONLY or Made in India)",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "fssai_license": {
    "value": "string (FSSAI Lic. No. 14 digits)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "ingredients": {
    "value": "string (ingredients list as printed)",
    "confidence": 0-100,
    "status": "detected" | "uncertain" | "illegible" | "not_visible" | "not_detected",
    "evidence": "verbatim text segment",
    "source_image": "image name or number where found",
    "bbox_normalized": [ymin, xmin, ymax, xmax]
  },
  "qr_code_detected": {
    "present": false,
    "location": "string or null",
    "type": "QR"
  },
  "barcode_detected": {
    "present": false,
    "location": "string or null",
    "type": "BARCODE"
  }
}`;
}

/**
 * Main AI Vision Analysis Pipeline
 * Takes uploaded images, preprocesses orientation and resolution,
 * executes Vision AI model, maps bounding box crops, and structures declarations.
 */
export async function performAIVisionAnalysis(imagesList, inspectionInfo = {}) {
  const startTime = Date.now();
  const provider = getVisionProvider();

  // 1. Preprocess each image for Vision AI
  const preprocessedImages = [];
  for (const img of imagesList) {
    const cleanRel = (img.image_path || '').replace(/^[\\\/]+/, '');
    let fullPath = path.join(process.cwd(), cleanRel);
    if (!fs.existsSync(fullPath) && fs.existsSync(img.image_path)) {
      fullPath = img.image_path;
    }

    if (fs.existsSync(fullPath)) {
      const prepared = await prepareImageForVisionAI(fullPath);
      preprocessedImages.push({
        id: img.id,
        path: fullPath,
        originalName: img.original_name,
        type: img.image_type,
        label: `${img.image_type || 'panel'} of packaging (${img.original_name || 'image'})`,
        buffer: prepared.buffer,
        width: prepared.width,
        height: prepared.height
      });
    }
  }

  if (preprocessedImages.length === 0) {
    return {
      success: false,
      error: 'No accessible packaging images found for analysis.',
      method: provider.getName(),
      declarations: [],
      processing_time_ms: Date.now() - startTime
    };
  }

  // 2. Call Vision AI Provider & deterministic QR/Barcode scanner concurrently
  let visionResult;
  let qrBarcodeResult = { code_present: false, status: 'NOT_DETECTED', source: 'Package Image' };
  try {
    const [aiRes, codeRes] = await Promise.all([
      provider.analyze(preprocessedImages, {
        product_name: inspectionInfo.product_name,
        category: inspectionInfo.category
      }),
      analyzeImagesForCodes(preprocessedImages)
    ]);
    visionResult = aiRes;
    qrBarcodeResult = codeRes;
  } catch (apiErr) {
    console.error('Vision AI Provider error:', apiErr);
    return {
      success: false,
      error: apiErr.message,
      method: provider.getName(),
      model: provider.getModel ? provider.getModel() : undefined,
      declarations: [],
      qr_barcode: qrBarcodeResult,
      processing_time_ms: Date.now() - startTime
    };
  }

  if (!visionResult.success) {
    return {
      success: false,
      error: visionResult.error,
      needs_config: visionResult.needs_config,
      method: provider.getName(),
      declarations: [],
      qr_barcode: qrBarcodeResult,
      processing_time_ms: Date.now() - startTime
    };
  }

  const aiData = visionResult.data || {};
  const inspectionId = inspectionInfo.id || 0;

  // Sync date_of_manufacture with packing_date or manufacturing_date if missing
  if (!aiData.date_of_manufacture?.value) {
    if (aiData.packing_date?.value) {
      aiData.date_of_manufacture = { ...aiData.packing_date };
    } else if (aiData.manufacturing_date?.value) {
      aiData.date_of_manufacture = { ...aiData.manufacturing_date };
    }
  }

  // 3. Format structured declarations and extract visual crops
  const declarationFields = [
    { key: 'product_name', is_info: 0 },
    { key: 'generic_name', is_info: 0 },
    { key: 'net_quantity', is_info: 0 },
    { key: 'mrp', is_info: 0 },
    { key: 'manufacturer_name', is_info: 0 },
    { key: 'packer_name', is_info: 1 },
    { key: 'importer_name', is_info: 1 },
    { key: 'manufacturer_address', is_info: 0 },
    { key: 'manufacturing_date', is_info: 0 },
    { key: 'packing_date', is_info: 0 },
    { key: 'date_of_manufacture', is_info: 0 },
    { key: 'expiry_date', is_info: 0 },
    { key: 'use_by_date', is_info: 0 },
    { key: 'best_before', is_info: 0 },
    { key: 'shelf_life', is_info: 1 },
    { key: 'batch_number', is_info: 1 },
    { key: 'consumer_care', is_info: 0 },
    { key: 'country_of_origin', is_info: 0 },
    { key: 'fssai_license', is_info: 1 },
    { key: 'ingredients', is_info: 1 }
  ];

  const structuredDeclarations = [];

  for (const field of declarationFields) {
    const raw = aiData[field.key] || {};
    let status = (raw.status || 'not_detected').toLowerCase();
    let val = (raw.value || '').trim();
    let confidence = typeof raw.confidence === 'number' ? Math.round(raw.confidence) : 0;
    let evidence = (raw.evidence || '').trim();
    let sourceImageName = raw.source_image || '';

    // Match source image ID from list
    let sourceImg = preprocessedImages.find(img =>
      sourceImageName && (img.originalName?.includes(sourceImageName) || img.type?.includes(sourceImageName))
    );
    if (!sourceImg && preprocessedImages.length > 0) {
      sourceImg = preprocessedImages[0];
    }

    // Generate evidence crop if normalized bbox is provided [ymin, xmin, ymax, xmax]
    let cropPath = null;
    if (raw.bbox_normalized && Array.isArray(raw.bbox_normalized) && raw.bbox_normalized.length === 4 && sourceImg) {
      try {
        const [ymin, xmin, ymax, xmax] = raw.bbox_normalized;
        const bbox = {
          x0: (xmin / 1000) * sourceImg.width,
          y0: (ymin / 1000) * sourceImg.height,
          x1: (xmax / 1000) * sourceImg.width,
          y1: (ymax / 1000) * sourceImg.height
        };
        cropPath = await createEvidenceCrop(sourceImg.path, bbox, inspectionId, field.key);
      } catch (cropErr) {
        console.warn(`Crop creation warning for ${field.key}:`, cropErr.message);
      }
    }

    structuredDeclarations.push({
      field_name: field.key,
      extracted_value: val,
      confidence: confidence,
      status: status, // 'detected' | 'uncertain' | 'illegible' | 'not_visible' | 'not_detected'
      evidence: evidence,
      source_image: sourceImg ? sourceImg.originalName : null,
      source_image_id: sourceImg ? sourceImg.id : null,
      source_type: 'package_image',
      crop_path: cropPath,
      is_informational: field.is_info,
      is_verified: 0,
      verified_value: null
    });
  }

  // Average confidence of detected/evaluated fields
  const evaluatedFields = structuredDeclarations.filter(d => d.confidence > 0);
  const avgConfidence = evaluatedFields.length > 0
    ? Math.round(evaluatedFields.reduce((sum, d) => sum + d.confidence, 0) / evaluatedFields.length)
    : 0;

  return {
    success: true,
    method: provider.getName(),
    model: provider.getModel ? provider.getModel() : undefined,
    confidence: avgConfidence,
    declarations: structuredDeclarations,
    qr_barcode: qrBarcodeResult,
    raw_ai_response: visionResult.raw_response,
    processing_time_ms: Date.now() - startTime
  };
}

export default {
  BaseVisionProvider,
  OpenAIVisionProvider,
  GeminiVisionProvider,
  getVisionProvider,
  performAIVisionAnalysis
};
