/**
 * QR Code & Barcode Detector / Decoder Service
 * 
 * Deterministically decodes physical QR codes and Barcodes from packaging images:
 * - Uses Sharp for pixel buffer extraction
 * - Uses jsQR for 2D QR Code recognition
 * - Uses @zxing/library for 1D/2D Barcode recognition (EAN-13, UPC, Code 128, QR)
 * - Returns supplementary evidence with strict attribution
 * - Zero hallucination: Never invents payload or assumes compliance
 */

import sharp from 'sharp';
import jsQR from 'jsqr';
import {
  MultiFormatReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  DecodeHintType,
  BarcodeFormat
} from '@zxing/library';

/**
 * Attempts to decode QR codes and Barcodes from an image file path or buffer
 * @param {string|Buffer} imageInput - File path or Buffer
 * @param {string} [originalName] - Image filename
 * @returns {Promise<Object>} Decoded result
 */
export async function decodeCodesFromImage(imageInput, originalName = '') {
  try {
    const sharpInstance = sharp(imageInput);
    const metadata = await sharpInstance.metadata();

    // 1. First attempt: jsQR on raw RGBA buffer
    const { data: rgbaData, info } = await sharpInstance
      .clone()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const qrResult = jsQR(new Uint8ClampedArray(rgbaData), info.width, info.height, {
      inversionAttempts: 'attemptBoth'
    });

    if (qrResult && qrResult.data) {
      const content = qrResult.data.trim();
      let supplementaryInfo = `Decoded QR code from ${originalName || 'package image'}.`;
      
      try {
        if (content.startsWith('http://') || content.startsWith('https://')) {
          const url = new URL(content);
          supplementaryInfo += ` Embedded URL points to ${url.hostname}${url.pathname}.`;
        } else if (content.startsWith('{') && content.endsWith('}')) {
          const json = JSON.parse(content);
          const keys = Object.keys(json).slice(0, 5).join(', ');
          supplementaryInfo += ` Structured JSON data found with fields: ${keys}.`;
        }
      } catch (_) {}

      return {
        code_present: true,
        code_type: 'QR',
        status: 'DECODED',
        raw_content: content,
        supplementary_info: supplementaryInfo,
        source: 'QR Code',
        location: qrResult.location || null,
        confidence: 100
      };
    }

    // 2. Second attempt: @zxing/library MultiFormatReader (EAN-13, UPC-A, Code 128, QR)
    try {
      // Downscale or prepare 1-channel or grayscale buffer for ZXing
      const { data: grayData, info: grayInfo } = await sharp(imageInput)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Convert grayscale buffer to RGB Luminance
      const rgbBuffer = new Uint8ClampedArray(grayInfo.width * grayInfo.height * 4);
      for (let i = 0; i < grayData.length; i++) {
        const val = grayData[i];
        const idx = i * 4;
        rgbBuffer[idx] = val;
        rgbBuffer[idx + 1] = val;
        rgbBuffer[idx + 2] = val;
        rgbBuffer[idx + 3] = 255;
      }

      const luminanceSource = new RGBLuminanceSource(rgbBuffer, grayInfo.width, grayInfo.height);
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

      const reader = new MultiFormatReader();
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39
      ]);
      reader.setHints(hints);

      const zxingResult = reader.decode(binaryBitmap);
      if (zxingResult) {
        const formatName = BarcodeFormat[zxingResult.getBarcodeFormat()] || 'BARCODE';
        const content = zxingResult.getText().trim();
        return {
          code_present: true,
          code_type: formatName.includes('QR') ? 'QR' : 'BARCODE',
          status: 'DECODED',
          raw_content: content,
          supplementary_info: `Decoded ${formatName} barcode from ${originalName || 'package image'}. Value: "${content}".`,
          source: formatName.includes('QR') ? 'QR Code' : 'Barcode',
          confidence: 100
        };
      }
    } catch (_) {
      // ZXing throws NotFoundException if no barcode found, ignore and continue
    }

    // No code decodable from this image
    return {
      code_present: false,
      code_type: null,
      status: 'NOT_DETECTED',
      raw_content: null,
      supplementary_info: null,
      source: 'Package Image',
      confidence: 0
    };
  } catch (err) {
    console.warn(`[QR/Barcode Service] Error processing ${originalName}:`, err.message);
    return {
      code_present: false,
      code_type: null,
      status: 'ERROR',
      error: err.message,
      source: 'Package Image'
    };
  }
}

/**
 * Analyzes multiple uploaded images for QR and Barcodes
 * @param {Array<Object>} imagesList - Array of { path, buffer, original_name, originalName }
 * @returns {Promise<Object>} Consolidated QR / Barcode results
 */
export async function analyzeImagesForCodes(imagesList = []) {
  const detectedCodes = [];

  for (const img of imagesList) {
    const input = img.buffer || img.path;
    if (!input) continue;

    const result = await decodeCodesFromImage(input, img.original_name || img.originalName || '');
    if (result.code_present && result.status === 'DECODED') {
      detectedCodes.push({
        ...result,
        image_name: img.original_name || img.originalName || 'package_image.jpg'
      });
    }
  }

  if (detectedCodes.length > 0) {
    const primary = detectedCodes[0];
    return {
      code_present: true,
      code_type: primary.code_type,
      status: primary.status,
      raw_content: primary.raw_content,
      supplementary_info: primary.supplementary_info,
      source: primary.source,
      all_codes: detectedCodes
    };
  }

  return {
    code_present: false,
    code_type: null,
    status: 'NOT_DETECTED',
    raw_content: null,
    supplementary_info: 'No decodable QR code or barcode found on uploaded packaging panels.',
    source: 'Package Image',
    all_codes: []
  };
}

export default {
  decodeCodesFromImage,
  analyzeImagesForCodes
};
