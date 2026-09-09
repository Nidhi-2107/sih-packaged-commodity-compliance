/**
 * Declaration Extractor — Tolerant Multi-Image Legal Metrology Parser
 * 
 * Accurately extracts mandatory packaged commodity declarations from OCR text:
 * - Tolerant pattern matching handling OCR character confusions (₹/Rs, O/0, I/1, S/5, B/8)
 * - Multi-image intelligence: consolidates front, back, and side packaging into one unified record
 * - Bounding box locator for visual evidence crops
 * - Confidence grading (distinguishes low confidence from missing)
 */

import { createEvidenceCrop } from './imagePreprocessor.js';

/**
 * Normalizes OCR misread digits within price or quantity tokens
 */
function fixOcrDigits(str) {
  if (!str) return '';
  return str
    .replace(/[oO]/g, '0')
    .replace(/[I|l]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8');
}

/**
 * Extracts declarations from a single image's OCR result
 */
export function extractDeclarationsFromImage(ocrResult, imageInfo = {}) {
  const rawText = ocrResult?.raw_text || '';
  const cleanedText = ocrResult?.cleaned_text || rawText;
  const ocrConfidence = ocrResult?.confidence || 0;
  const words = ocrResult?.words || [];
  const imageId = imageInfo.id || null;
  const imagePath = imageInfo.path || null;

  if (!cleanedText || cleanedText.trim().length === 0) {
    return getEmptyDeclarations(imageId);
  }

  const text = cleanedText.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');
  const lowerText = fullText.toLowerCase();

  const declarations = [];

  // 1. Product Name & Commodity
  declarations.push(extractProductName(lines, lowerText, words, imageId));

  // 2. Generic Name
  declarations.push(extractGenericName(lines, lowerText, words, imageId));

  // 3. Net Quantity
  declarations.push(extractNetQuantity(fullText, words, imageId));

  // 4. Maximum Retail Price (MRP)
  declarations.push(extractMRP(fullText, words, imageId));

  // 5. Manufacturer Name
  declarations.push(extractManufacturer(fullText, lines, words, imageId));

  // 6. Manufacturer Address
  declarations.push(extractAddress(fullText, lines, words, imageId));

  // 7. Date of Manufacture / Packing
  const dateDecl = extractDate(fullText, words, imageId);
  declarations.push(dateDecl);
  declarations.push({ ...dateDecl, field_name: 'manufacturing_date' });
  declarations.push(extractPackingDate(fullText, words, imageId));

  // Expiry & Best Before
  declarations.push(extractExpiryDate(fullText, words, imageId));
  declarations.push(extractBestBefore(fullText, words, imageId));
  declarations.push(extractShelfLife(fullText, words, imageId));

  // 8. Consumer Care Details
  declarations.push(extractConsumerCare(fullText, words, imageId));

  // 9. Country of Origin
  declarations.push(extractCountryOfOrigin(fullText, words, imageId));

  // Informational fields:
  // 10. FSSAI License
  declarations.push(extractFSSAI(fullText, words, imageId));

  // 11. Ingredients
  declarations.push(extractIngredients(fullText, words, imageId));

  // Confidence grading & status assignment
  for (const d of declarations) {
    if (d.status === 'detected') {
      if (ocrConfidence > 0 && ocrConfidence < 50) {
        d.confidence = Math.min(d.confidence, Math.round(ocrConfidence + 10));
        if (d.confidence < 45) {
          d.status = 'uncertain';
        }
      }
    } else if (d.status === 'missing') {
      if (ocrConfidence < 60 || rawText.length < 350) {
        d.status = 'uncertain';
        d.confidence = Math.round(ocrConfidence || 30);
      }
    }
  }

  return declarations;
}

/**
 * Multi-Image Intelligence:
 * Combines declarations discovered across all uploaded images (e.g. Front, Back, Side).
 * If front has product name and back has MRP/manufacturer, they merge into one product record.
 */
export async function mergeMultiImageDeclarations(imageDeclarationSets, inspectionId = null) {
  const mergedMap = new Map();

  // Initialize with standard empty fields
  const fieldOrder = [
    'product_name', 'generic_name', 'net_quantity', 'mrp',
    'manufacturer_name', 'manufacturer_address', 'date_of_manufacture',
    'consumer_care', 'country_of_origin', 'fssai_license', 'ingredients'
  ];

  for (const field of fieldOrder) {
    mergedMap.set(field, {
      field_name: field,
      extracted_value: '',
      confidence: 0,
      status: 'missing',
      is_informational: field === 'fssai_license' || field === 'ingredients' ? 1 : 0,
      source_image_id: null,
      crop_path: null,
      bbox: null,
      source_image_path: null
    });
  }

  // Iterate over each image's extracted declarations
  for (const item of imageDeclarationSets) {
    const { declarations, imagePath, imageId } = item;
    if (!Array.isArray(declarations)) continue;

    for (const d of declarations) {
      const current = mergedMap.get(d.field_name);
      if (!current) {
        mergedMap.set(d.field_name, { ...d, source_image_path: imagePath });
        continue;
      }

      // If current is missing and new is detected/uncertain, replace
      if (current.status === 'missing' && d.status !== 'missing') {
        mergedMap.set(d.field_name, { ...d, source_image_path: imagePath });
      } else if (d.status === 'detected' && (current.status !== 'detected' || d.confidence > current.confidence)) {
        // Detected with higher confidence takes priority
        mergedMap.set(d.field_name, { ...d, source_image_path: imagePath });
      } else if (d.status === 'uncertain' && current.status === 'uncertain' && d.confidence > current.confidence) {
        mergedMap.set(d.field_name, { ...d, source_image_path: imagePath });
      }
    }
  }

  // Generate visual evidence crops for declarations that have a bounding box and source image
  const finalDeclarations = Array.from(mergedMap.values());
  for (const d of finalDeclarations) {
    if (d.bbox && d.source_image_path && inspectionId) {
      try {
        const cropPath = await createEvidenceCrop(d.source_image_path, d.bbox, inspectionId, d.field_name);
        if (cropPath) {
          d.crop_path = cropPath;
        }
      } catch (cropErr) {
        console.warn(`Crop generation notice for ${d.field_name}:`, cropErr.message);
      }
    }
  }

  return finalDeclarations;
}

// -------------------------------------------------------------
// Field-Specific Tolerant Extraction Functions
// -------------------------------------------------------------

function findBBoxForTokens(tokens, words) {
  if (!tokens || tokens.length === 0 || !words || words.length === 0) return null;

  const cleanTokens = tokens.map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(t => t.length >= 2);
  if (cleanTokens.length === 0) return null;

  const matchedBoxes = [];
  for (const w of words) {
    if (!w.bbox || !w.text) continue;
    const cleanWord = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTokens.some(ct => cleanWord.includes(ct) || ct.includes(cleanWord))) {
      matchedBoxes.push(w.bbox);
    }
  }

  if (matchedBoxes.length === 0) return null;

  return {
    x0: Math.min(...matchedBoxes.map(b => b.x0)),
    y0: Math.min(...matchedBoxes.map(b => b.y0)),
    x1: Math.max(...matchedBoxes.map(b => b.x1)),
    y1: Math.max(...matchedBoxes.map(b => b.y1))
  };
}

function extractProductName(lines, lowerText, words, imageId) {
  // Brand recognition & prominent food terms
  const foodKeywords = [
    'hide & seek', 'hide and seek', 'parle-g', 'parle', 'britannia', 'good day',
    'marie gold', 'bourbon', 'oreo', 'maggi', 'lays', 'kurkure', 'haldiram',
    'bikano', 'amul', 'patanjali', 'aashirvaad', 'fortune', 'tata salt', 'daawat',
    'cookies', 'biscuits', 'cookie', 'biscuit', 'chakki atta', 'basmati rice',
    'mustard oil', 'refined oil', 'chips', 'noodles', 'rusk', 'namkeen'
  ];

  for (const kw of foodKeywords) {
    if (lowerText.includes(kw)) {
      const val = kw.replace(/\b\w/g, l => l.toUpperCase());
      const bbox = findBBoxForTokens(kw.split(/\s+/), words);
      return {
        field_name: 'product_name',
        extracted_value: val,
        confidence: 94,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  // Fallback to prominent top line
  for (const line of lines) {
    if (line.length > 3 && line.length < 60 && !/^(mrp|net|batch|date|pkg|mfd|exp|use|for|best|lic|fssai)/i.test(line)) {
      const bbox = findBBoxForTokens(line.split(/\s+/), words);
      return {
        field_name: 'product_name',
        extracted_value: line,
        confidence: 80,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  return {
    field_name: 'product_name',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractGenericName(lines, lowerText, words, imageId) {
  const genericTerms = [
    'chocolate chip cookies', 'cookies', 'biscuits', 'cream biscuits', 'rusk',
    'whole wheat flour', 'atta', 'basmati rice', 'rice', 'refined sunflower oil',
    'mustard oil', 'iodized salt', 'potato chips', 'instant noodles', 'pasta'
  ];

  for (const gt of genericTerms) {
    if (lowerText.includes(gt)) {
      const bbox = findBBoxForTokens(gt.split(/\s+/), words);
      return {
        field_name: 'generic_name',
        extracted_value: gt.replace(/\b\w/g, l => l.toUpperCase()),
        confidence: 88,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  if (lines.length >= 2) {
    const l2 = lines[1];
    if (l2.length > 3 && l2.length < 50 && !/(?:net|mrp|pkg|mfd|lic)/i.test(l2)) {
      return {
        field_name: 'generic_name',
        extracted_value: l2,
        confidence: 72,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox: null
      };
    }
  }

  return {
    field_name: 'generic_name',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractNetQuantity(fullText, words, imageId) {
  // Tolerant regex handling character confusion: 1OOg -> 100g, 5Og -> 50g, etc.
  const patterns = [
    /(?:net\s*(?:weight|wt|quantity|qty|content)|wt|weight|qty)[\s:.\-=–]*([0-9OIlSB.,]+\s*(?:kg|g|gm|gms|ml|l|ltr|litre|liter|units|pcs|pieces|N))\b/i,
    /(?:^|\s)([0-9OIlSB.,]+\s*(?:kg|g|gm|gms|ml|l|ltr|litre|liter))\s*(?:net|weight|wt)/i,
    /\b([0-9OIlSB.,]{1,5}\s*(?:kg|g|gm|gms|ml|l|ltr))\b/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      let rawVal = match[1].trim();
      // Clean OCR digits
      const cleanedVal = rawVal.replace(/^([0-9OIlSB.,]+)/i, (m) => fixOcrDigits(m));
      const bbox = findBBoxForTokens(rawVal.split(/\s+/), words);
      return {
        field_name: 'net_quantity',
        extracted_value: cleanedVal,
        confidence: 90,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  return {
    field_name: 'net_quantity',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractMRP(fullText, words, imageId) {
  // Search MRP, M.R.P, Maximum Retail Price, Rs, ₹, R5, Price
  const patterns = [
    /(?:mrp|m\.?r\.?p\.?|maximum\s*retail\s*price|max\s*price)[\s:.\-=–]*[₹Rs.INR5`~]*\s*([0-9OIlSB.,]+)/i,
    /[₹]\s*([0-9OIlSB.,]+)/i,
    /(?:Rs\.?|INR|R5)\s*([0-9OIlSB.,]+)/i,
    /(?:price|retail\s*price)[\s:.\-=–]*[₹Rs.INR5]*\s*([0-9OIlSB.,]+)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      let numStr = fixOcrDigits(match[1].trim());
      // Ensure it's a valid price number
      const parsed = parseFloat(numStr.replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
        const val = `₹${numStr}`;
        const bbox = findBBoxForTokens(['mrp', numStr, match[1]], words);
        return {
          field_name: 'mrp',
          extracted_value: val,
          confidence: 91,
          status: 'detected',
          is_informational: 0,
          source_image_id: imageId,
          bbox
        };
      }
    }
  }

  return {
    field_name: 'mrp',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractManufacturer(fullText, lines, words, imageId) {
  const patterns = [
    /(?:manufactured|mfg|packed|pkg|imported|marketed)\s*(?:by|&\s*packed\s*by|&\s*marketed\s*by)\s*[:\-]?\s*(.+?)(?:\n|$|,\s*(?:\d|address|fssai|lic))/i,
    /(?:manufacturer|packer|importer)\s*[:\-]?\s*(.+?)(?:\n|$)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = match[1].trim();
      if (val.length > 3 && val.length < 100) {
        const bbox = findBBoxForTokens(val.split(/\s+/).slice(0, 4), words);
        return {
          field_name: 'manufacturer_name',
          extracted_value: val,
          confidence: 88,
          status: 'detected',
          is_informational: 0,
          source_image_id: imageId,
          bbox
        };
      }
    }
  }

  for (const line of lines) {
    if (/(?:manufactured|mfg|packed|imported|marketed)\s*(?:by|&)/i.test(line)) {
      const cleaned = line.replace(/(?:manufactured|mfg|packed|imported|marketed)\s*(?:by|&\s*\w+\s*by)\s*[:\-]?\s*/i, '').trim();
      if (cleaned.length > 3) {
        const bbox = findBBoxForTokens(cleaned.split(/\s+/).slice(0, 4), words);
        return {
          field_name: 'manufacturer_name',
          extracted_value: cleaned,
          confidence: 84,
          status: 'detected',
          is_informational: 0,
          source_image_id: imageId,
          bbox
        };
      }
    }
  }

  return {
    field_name: 'manufacturer_name',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractAddress(fullText, lines, words, imageId) {
  const statePattern = /(?:andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|chandigarh|mumbai|chennai|kolkata|bengaluru|bangalore|hyderabad|ahmedabad|pune|jaipur|lucknow|indore|bhopal|noida|gurgaon|gurugram)/i;
  const pincodePattern = /\b\d{6}\b/;

  const addressParts = [];
  let foundAddress = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (statePattern.test(line) || pincodePattern.test(line)) {
      foundAddress = true;
      if (i > 0 && !addressParts.includes(lines[i - 1])) {
        const prev = lines[i - 1];
        if (!/(?:mrp|net\s*weight|customer\s*care|batch|best\s*before|ingredients)/i.test(prev)) {
          addressParts.push(prev);
        }
      }
      addressParts.push(line);
    }
  }

  if (foundAddress && addressParts.length > 0) {
    const val = addressParts.join(', ').replace(/(?:manufactured|mfg|packed)\s*(?:by|&\s*\w+\s*by)\s*[:\-]?\s*/i, '').trim();
    const bbox = findBBoxForTokens(val.split(/[\s,]+/).slice(0, 5), words);
    return {
      field_name: 'manufacturer_address',
      extracted_value: val,
      confidence: 84,
      status: 'detected',
      is_informational: 0,
      source_image_id: imageId,
      bbox
    };
  }

  return {
    field_name: 'manufacturer_address',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractDate(fullText, words, imageId) {
  const monthNames = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  const patterns = [
    new RegExp(`(?:packed|packing|manufacture|mfg|mfd|pkg|date|dated)\\s*[:\\-]?\\s*((?:${monthNames})\\s*\\d{4})`, 'i'),
    new RegExp(`(?:packed|packing|manufacture|mfg|mfd|pkg|date)\\s*[:\\-]?\\s*(\\d{1,2}[\\-/.]\\d{1,2}[\\-/.]\\d{2,4})`, 'i'),
    new RegExp(`((?:${monthNames})\\s+\\d{4})`, 'i'),
    /(\d{1,2}[\/\-]\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = match[1].trim();
      const bbox = findBBoxForTokens(val.split(/[\s/\-.]+/), words);
      return {
        field_name: 'date_of_manufacture',
        extracted_value: val,
        confidence: 85,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  return {
    field_name: 'date_of_manufacture',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractPackingDate(fullText, words, imageId) {
  const patterns = [
    /(?:pkd|packed|pkg|packing\s*date|date\s*of\s*packing)\s*[:\-.]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i,
    /(?:pkd|packed|pkg)\s*[:\-.]?\s*([a-zA-Z]{3,9}\s*[0-9]{2,4})/i,
    /(?:pkd|packed)\s*[:\-.]?\s*([0-9]{1,2}[\/\-.][0-9]{2,4})/i
  ];
  for (const p of patterns) {
    const m = fullText.match(p);
    if (m) {
      const val = m[1].trim();
      const bbox = findBBoxForTokens(val.split(/[\s/\-.]+/), words);
      return {
        field_name: 'packing_date',
        extracted_value: val,
        confidence: 86,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }
  return {
    field_name: 'packing_date',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractExpiryDate(fullText, words, imageId) {
  const patterns = [
    /(?:exp|expiry|expiry\s*date|use\s*by|use\s*by\s*date)\s*[:\-.]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i,
    /(?:exp|expiry|use\s*by)\s*[:\-.]?\s*([a-zA-Z]{3,9}\s*[0-9]{2,4})/i,
    /(?:exp|expiry)\s*[:\-.]?\s*([0-9]{1,2}[\/\-.][0-9]{2,4})/i
  ];
  for (const p of patterns) {
    const m = fullText.match(p);
    if (m) {
      const val = m[1].trim();
      const bbox = findBBoxForTokens(val.split(/[\s/\-.]+/), words);
      return {
        field_name: 'expiry_date',
        extracted_value: val,
        confidence: 88,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }
  return {
    field_name: 'expiry_date',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractBestBefore(fullText, words, imageId) {
  const patterns = [
    /(best\s*before\s*(?:end\s*)?[0-9]{1,2}\s*(?:months?|days?|years?)\s*(?:from\s*(?:packaging|pkd|mfg|manufacture))?)/i,
    /(best\s*before\s*(?:end\s*)?[:\-.]?\s*[a-zA-Z0-9\/\-.\s]{3,30})/i
  ];
  for (const p of patterns) {
    const m = fullText.match(p);
    if (m) {
      const val = m[1].trim();
      const bbox = findBBoxForTokens(val.split(/\s+/).slice(0, 4), words);
      return {
        field_name: 'best_before',
        extracted_value: val,
        confidence: 89,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }
  return {
    field_name: 'best_before',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractShelfLife(fullText, words, imageId) {
  const match = fullText.match(/(?:shelf\s*life)\s*[:\-.]?\s*([0-9]+\s*(?:months?|days?|years?))/i);
  if (match) {
    const val = match[1].trim();
    return {
      field_name: 'shelf_life',
      extracted_value: val,
      confidence: 85,
      status: 'detected',
      is_informational: 1,
      source_image_id: imageId,
      bbox: null
    };
  }
  return {
    field_name: 'shelf_life',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 1,
    source_image_id: imageId,
    bbox: null
  };
}

function extractConsumerCare(fullText, words, imageId) {
  const patterns = [
    /(?:customer\s*care|consumer\s*care|helpline|toll\s*free|feedback|complaints?)\s*[:\-]?\s*([0-9\-\s/]{8,})/i,
    /(1800[\-\s]?[0-9]{3}[\-\s]?[0-9]{4})/i,
    /((?:\+91|0)\s*[0-9\-\s]{10,})/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      let val = match[1].trim();
      const emailMatch = fullText.match(/[\w.]+@[\w.]+\.\w+/i);
      if (emailMatch) {
        val += ` / ${emailMatch[0]}`;
      }
      const bbox = findBBoxForTokens(val.split(/[\s/\-]+/).slice(0, 3), words);
      return {
        field_name: 'consumer_care',
        extracted_value: val,
        confidence: 87,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  const emailMatch = fullText.match(/[\w.]+@[\w.]+\.\w+/i);
  if (emailMatch) {
    return {
      field_name: 'consumer_care',
      extracted_value: emailMatch[0],
      confidence: 75,
      status: 'detected',
      is_informational: 0,
      source_image_id: imageId,
      bbox: null
    };
  }

  return {
    field_name: 'consumer_care',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractCountryOfOrigin(fullText, words, imageId) {
  const patterns = [
    /(?:country\s*of\s*origin|made\s*in|product\s*of|manufactured\s*in)\s*[:\-]?\s*([a-zA-Z\s]+?)(?:\.|\n|$|,)/i,
    /\b(made\s*in\s*india)\b/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = match[1].trim().replace(/\b\w/g, l => l.toUpperCase());
      const bbox = findBBoxForTokens(val.split(/\s+/), words);
      return {
        field_name: 'country_of_origin',
        extracted_value: val,
        confidence: 89,
        status: 'detected',
        is_informational: 0,
        source_image_id: imageId,
        bbox
      };
    }
  }

  // Default inference if India states/pincode found
  if (/(?:mumbai|delhi|indore|bhopal|gujarat|maharashtra|madhya pradesh)\b/i.test(fullText)) {
    return {
      field_name: 'country_of_origin',
      extracted_value: 'India (Inferred from mfg location)',
      confidence: 75,
      status: 'detected',
      is_informational: 0,
      source_image_id: imageId,
      bbox: null
    };
  }

  return {
    field_name: 'country_of_origin',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 0,
    source_image_id: imageId,
    bbox: null
  };
}

function extractFSSAI(fullText, words, imageId) {
  const patterns = [
    /(?:fssai|food\s*safety)\s*(?:lic|license|licence|no|number|reg)?\s*[:\-.]?\s*([0-9OIlSB]{10,14})/i,
    /(?:lic|license|licence)\s*(?:no|number)?\s*[:\-.]?\s*([0-9OIlSB]{10,14})/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = fixOcrDigits(match[1].trim());
      const bbox = findBBoxForTokens(['fssai', val], words);
      return {
        field_name: 'fssai_license',
        extracted_value: val,
        confidence: 88,
        status: 'detected',
        is_informational: 1,
        source_image_id: imageId,
        bbox
      };
    }
  }

  return {
    field_name: 'fssai_license',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 1,
    source_image_id: imageId,
    bbox: null
  };
}

function extractIngredients(fullText, words, imageId) {
  const match = fullText.match(/(?:ingredients?|contains?)\s*[:\-]?\s*(.+?)(?:(?:allergen|nutritional|nutrition|storage|best\s*before|mfg)|$)/is);
  if (match) {
    const val = match[1].trim().substring(0, 200);
    return {
      field_name: 'ingredients',
      extracted_value: val,
      confidence: 78,
      status: 'detected',
      is_informational: 1,
      source_image_id: imageId,
      bbox: null
    };
  }

  return {
    field_name: 'ingredients',
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    is_informational: 1,
    source_image_id: imageId,
    bbox: null
  };
}

function getEmptyDeclarations(imageId = null) {
  const fields = [
    { field_name: 'product_name', is_informational: 0 },
    { field_name: 'generic_name', is_informational: 0 },
    { field_name: 'net_quantity', is_informational: 0 },
    { field_name: 'mrp', is_informational: 0 },
    { field_name: 'manufacturer_name', is_informational: 0 },
    { field_name: 'manufacturer_address', is_informational: 0 },
    { field_name: 'manufacturing_date', is_informational: 0 },
    { field_name: 'packing_date', is_informational: 0 },
    { field_name: 'date_of_manufacture', is_informational: 0 },
    { field_name: 'expiry_date', is_informational: 0 },
    { field_name: 'use_by_date', is_informational: 0 },
    { field_name: 'best_before', is_informational: 0 },
    { field_name: 'shelf_life', is_informational: 1 },
    { field_name: 'consumer_care', is_informational: 0 },
    { field_name: 'country_of_origin', is_informational: 0 },
    { field_name: 'fssai_license', is_informational: 1 },
    { field_name: 'ingredients', is_informational: 1 }
  ];

  return fields.map(f => ({
    ...f,
    extracted_value: '',
    confidence: 0,
    status: 'missing',
    source_image_id: imageId,
    crop_path: null,
    bbox: null
  }));
}

export default {
  extractDeclarationsFromImage,
  mergeMultiImageDeclarations
};
