/**
 * OCR Service — Modular, Multi-Pass OCR with Abstraction Layer
 * 
 * Runs OCR across multiple preprocessing variants (standard enhanced, binarized, fine-print),
 * combines the extracted text and word bounding boxes, and deduplicates the results.
 * 
 * Supports pluggable OCR providers (Tesseract.js default, extensible to cloud OCR).
 */

import { generatePreprocessingVariants } from './imagePreprocessor.js';

let Tesseract = null;

async function loadTesseract() {
  if (!Tesseract) {
    try {
      Tesseract = await import('tesseract.js');
    } catch (e) {
      console.warn('Tesseract.js not available:', e.message);
    }
  }
  return Tesseract;
}

/**
 * Base OCR Provider Interface
 */
class BaseOCRProvider {
  async recognize(imageBuffer) {
    throw new Error('recognize() must be implemented by provider');
  }
  getName() {
    return 'base_ocr';
  }
}

/**
 * Tesseract.js OCR Provider
 */
class TesseractProvider extends BaseOCRProvider {
  constructor() {
    super();
    this.worker = null;
    this.initPromise = null;
  }

  getName() {
    return 'tesseract';
  }

  async getWorker() {
    if (this.worker) return this.worker;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const tess = await loadTesseract();
      if (!tess) throw new Error('Tesseract.js library could not be loaded');
      const { createWorker } = tess;
      this.worker = await createWorker('eng', 1, {
        logger: () => {}
      });
      return this.worker;
    })();

    return this.initPromise;
  }

  async recognize(imageBuffer) {
    const worker = await this.getWorker();
    const recognizePromise = worker.recognize(imageBuffer);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract recognition timed out')), 25000)
    );

    const result = await Promise.race([recognizePromise, timeoutPromise]);
    const data = result?.data || {};

    const words = (data.words || []).map(w => ({
      text: w.text ? w.text.trim() : '',
      confidence: typeof w.confidence === 'number' ? w.confidence : 0,
      bbox: w.bbox || null
    })).filter(w => w.text.length > 0);

    return {
      text: data.text || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      words
    };
  }
}

// Active OCR Provider (can be swapped in future for AWS Rekognition, Google Vision, etc.)
let activeProvider = new TesseractProvider();

export function setOCRProvider(provider) {
  if (provider && typeof provider.recognize === 'function') {
    activeProvider = provider;
  }
}

export function getOCRProvider() {
  return activeProvider;
}

/**
 * Clean, normalize and merge text from multiple OCR passes
 */
function mergePassResults(passResults) {
  const seenLines = new Set();
  const cleanedLines = [];
  const allRawTexts = [];
  const mergedWords = [];
  let totalConfidence = 0;
  let validPasses = 0;

  for (const pass of passResults) {
    if (!pass || !pass.text) continue;
    allRawTexts.push(`[Variant: ${pass.variantLabel || pass.variantName}]\n${pass.text.trim()}`);

    if (pass.confidence > 0) {
      totalConfidence += pass.confidence;
      validPasses++;
    }

    // Collect words
    if (Array.isArray(pass.words)) {
      for (const w of pass.words) {
        mergedWords.push(w);
      }
    }

    // Process lines for deduplication
    const lines = pass.text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line.length < 2) continue;

      // Normalized line for fuzzy deduplication
      const norm = line.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.length >= 3 && !seenLines.has(norm)) {
        seenLines.add(norm);
        cleanedLines.push(line);
      } else if (norm.length < 3 && !cleanedLines.includes(line)) {
        cleanedLines.push(line);
      }
    }
  }

  const raw_text = allRawTexts.join('\n\n---\n\n');
  const cleaned_text = cleanedLines.join('\n');
  const avgConfidence = validPasses > 0 ? Math.round(totalConfidence / validPasses) : 0;

  return {
    raw_text,
    cleaned_text,
    avgConfidence,
    mergedWords
  };
}

/**
 * Multi-Pass OCR Execution on an image file
 */
export async function performOCR(imagePath) {
  const startTime = Date.now();

  try {
    // 1. Generate preprocessing variants (e.g. enhanced contrast, binarized threshold, fine print)
    const variants = await generatePreprocessingVariants(imagePath);

    // 2. Run OCR on each variant
    const passResults = [];
    for (const variant of variants) {
      try {
        const res = await activeProvider.recognize(variant.buffer);
        passResults.push({
          variantName: variant.name,
          variantLabel: variant.label,
          text: res.text,
          confidence: res.confidence,
          words: res.words
        });
      } catch (passErr) {
        console.warn(`OCR Pass failed for variant ${variant.name}:`, passErr.message);
      }
    }

    if (passResults.length === 0) {
      return {
        success: false,
        raw_text: '',
        cleaned_text: '',
        confidence: 0,
        method: activeProvider.getName(),
        processing_time_ms: Date.now() - startTime,
        error: 'All OCR preprocessing passes failed to recognize text.',
        words: [],
        variants_processed: 0
      };
    }

    // 3. Merge & Deduplicate across variants
    const merged = mergePassResults(passResults);

    return {
      success: true,
      raw_text: merged.raw_text,
      cleaned_text: merged.cleaned_text,
      confidence: merged.avgConfidence,
      method: activeProvider.getName(),
      processing_time_ms: Date.now() - startTime,
      low_confidence: merged.avgConfidence < 50,
      low_confidence_message: merged.avgConfidence < 50
        ? 'Low image/OCR confidence — manual verification required.'
        : null,
      words: merged.mergedWords,
      variants_processed: passResults.length,
      pass_details: passResults.map(p => ({
        variant: p.variantLabel,
        confidence: Math.round(p.confidence)
      })),
      error: null
    };
  } catch (error) {
    console.error('Multi-pass OCR error:', error);
    return {
      success: false,
      raw_text: '',
      cleaned_text: '',
      confidence: 0,
      method: activeProvider.getName(),
      processing_time_ms: Date.now() - startTime,
      error: `OCR processing failure: ${error.message}`,
      words: [],
      variants_processed: 0
    };
  }
}

/**
 * Demo Analysis Fallback — EXPLICITLY LABELLED
 * Only for controlled SIH demonstration when real OCR is unavailable/unreliable.
 */
export function performDemoAnalysis(productName, category) {
  const startTime = Date.now();

  const demoData = {
    'rice': {
      raw_text: `SAMPLE PREMIUM RICE\nPremium Quality Basmati Rice\nNet Weight: 5 kg\nMRP ₹420 (Inclusive of all taxes)\nManufactured by: ABC Foods Pvt Ltd\n123 Industrial Area, Sector 5\nIndore, Madhya Pradesh 452001\nPacked: June 2026\nBatch No: BATCH-2026-06-A1\nBest Before: 12 months from packaging\nCustomer Care: 1800-123-4567\ncustomercare@abcfoods.in\nCountry of Origin: India\nFSSAI Lic No: 10014022003152`,
      confidence: 87
    },
    'flour': {
      raw_text: `WHOLE WHEAT FLOUR (ATTA)\nNet Weight: 10 kg\nMRP ₹380 (Inclusive of all taxes)\nManufactured & Packed by: XYZ Mills Pvt Ltd\n45 Grain Market Road\nBhopal, Madhya Pradesh 462001\nDate of Packing: May 2026\nBatch: WF-2026-05-B2\nBest Before: 6 months from packaging\nCustomer Care: 1800-234-5678\nCountry of Origin: India\nFSSAI Lic No: 10015023004123`,
      confidence: 83
    },
    'biscuits': {
      raw_text: `PARLE HIDE & SEEK\nChocolate Chip Cookies\nNet Weight: 100 g\nMRP ₹30 (Inclusive of all taxes)\nManufactured & Packed by: Parle Products Pvt Ltd\nNorth Level Crossing, Vile Parle East\nMumbai, Maharashtra 400057\nDate of Packing: March 2026\nBatch No: HS-2026-03\nBest Before: 9 months from packaging\nCustomer Care: 1800-22-2000 / consumer@parle.biz\nCountry of Origin: India\nFSSAI Lic No: 10012022000145`,
      confidence: 86
    },
    'default': {
      raw_text: `${(productName || 'PACKAGED FOOD PRODUCT').toUpperCase()}\nNet Weight: 500 g\nMRP ₹150 (Inclusive of all taxes)\nManufactured by: Demo Manufacturer Pvt Ltd\n100 Industrial Estate\nIndore, Madhya Pradesh 452001\nPacked: July 2026\nBatch: DEMO-2026-07\nBest Before: 6 months from packaging\nCustomer Care: 1800-111-2222\nCountry of Origin: India`,
      confidence: 80
    }
  };

  const key = (category || '').toLowerCase();
  const demo = demoData[key] || demoData['default'];

  return {
    success: true,
    raw_text: demo.raw_text,
    cleaned_text: demo.raw_text,
    confidence: demo.confidence,
    method: 'demo_fallback',
    processing_time_ms: Date.now() - startTime + 1200,
    low_confidence: false,
    low_confidence_message: null,
    demo_notice: 'DEMO ANALYSIS: This result was generated using simulated demo data for demonstration purposes. Real OCR was not performed on this image.',
    words: [],
    variants_processed: 3,
    error: null
  };
}

export default { performOCR, performDemoAnalysis, setOCRProvider, getOCRProvider, BaseOCRProvider };
