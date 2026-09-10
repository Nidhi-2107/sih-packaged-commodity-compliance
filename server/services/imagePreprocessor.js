/**
 * Image Preprocessing Service
 * 
 * Generates multiple preprocessing variants for multi-pass OCR
 * to handle real-world Indian food-package packaging:
 * - Rotated / phone camera EXIF orientation
 * - Shiny, metallic or reflective foil packages (chips, biscuits)
 * - Low-contrast, curved, or shadowed lighting
 * - Tiny legal print (Net Wt, MRP, FSSAI, Batch, Date)
 * 
 * Also extracts visual evidence crops given bounding box coordinates.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Generates preprocessing variants for a single image.
 * Returns an array of variants: [{ name, label, buffer }]
 */
export async function generatePreprocessingVariants(imagePath) {
  const variants = [];

  try {
    const baseSharp = sharp(imagePath).rotate(); // auto-orient by EXIF
    const metadata = await baseSharp.metadata();
    const origWidth = metadata.width || 1200;
    const targetWidth = Math.min(2400, Math.max(1600, origWidth));

    // Variant 1: Standard Normalized Grayscale + Sharpen
    // Best for general text, headings, and brands
    try {
      const v1Buffer = await sharp(imagePath)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: false })
        .grayscale()
        .normalise()
        .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 })
        .toBuffer();
      variants.push({
        name: 'enhanced_contrast',
        label: 'Standard Contrast Enhanced',
        buffer: v1Buffer
      });
    } catch (err) {
      console.warn('Preprocessing Variant 1 notice:', err.message);
    }

    // Variant 2: High-Contrast Binarized / Thresholded
    // Solves reflective cellophane, metallic foil, and dark printed packaging
    try {
      const v2Buffer = await sharp(imagePath)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: false })
        .grayscale()
        .threshold(140) // Binarize: separates dark ink from packaging background
        .sharpen({ sigma: 1.5 })
        .toBuffer();
      variants.push({
        name: 'binarized_threshold',
        label: 'High-Contrast Binarized',
        buffer: v2Buffer
      });
    } catch (err) {
      console.warn('Preprocessing Variant 2 notice:', err.message);
    }

    // Variant 3: Edge-Enhanced Fine Print
    // Best for tiny legal metrology text (Net wt, MRP, FSSAI, packed dates)
    try {
      const v3Buffer = await sharp(imagePath)
        .rotate()
        .resize({ width: Math.min(2800, Math.round(targetWidth * 1.25)), withoutEnlargement: false })
        .grayscale()
        .linear(1.3, -15) // dynamic range stretching
        .sharpen({ sigma: 2.0, m1: 2.0, m2: 4.0 })
        .toBuffer();
      variants.push({
        name: 'fine_print_stretch',
        label: 'Fine-Print Edge Enhanced',
        buffer: v3Buffer
      });
    } catch (err) {
      console.warn('Preprocessing Variant 3 notice:', err.message);
    }

  } catch (error) {
    console.warn('Image preprocessing failed to generate variants, falling back to raw buffer:', error.message);
  }

  // Fallback if variants failed
  if (variants.length === 0) {
    try {
      const fallbackBuf = fs.readFileSync(imagePath);
      variants.push({
        name: 'raw_fallback',
        label: 'Raw Image',
        buffer: fallbackBuf
      });
    } catch (e) {
      console.error('Failed to read image file:', e);
    }
  }

  return variants;
}

/**
 * Extracts a visual evidence crop from an image around bounding box coordinates [x0, y0, x1, y1]
 * with padding. Saves to uploads/crops/{inspectionId}/...
 */
export async function createEvidenceCrop(imagePath, bbox, inspectionId, fieldName) {
  if (!bbox || !imagePath) return null;
  try {
    const uploadBase = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(process.cwd(), 'uploads');
    const safeId = String(inspectionId).replace(/[^a-zA-Z0-9_-]/g, '');
    const cropsDir = path.join(uploadBase, 'crops', safeId);
    if (!fs.existsSync(cropsDir)) {
      fs.mkdirSync(cropsDir, { recursive: true });
    }

    const img = sharp(imagePath).rotate();
    const meta = await img.metadata();
    const imgWidth = meta.width;
    const imgHeight = meta.height;

    if (!imgWidth || !imgHeight) return null;

    // bbox: { x0, y0, x1, y1 }
    // Add generous contextual padding around the detected text
    const padX = Math.round((bbox.x1 - bbox.x0) * 0.35) + 20;
    const padY = Math.round((bbox.y1 - bbox.y0) * 0.5) + 15;

    let left = Math.max(0, Math.floor(bbox.x0 - padX));
    let top = Math.max(0, Math.floor(bbox.y0 - padY));
    let width = Math.min(imgWidth - left, Math.ceil((bbox.x1 - bbox.x0) + padX * 2));
    let height = Math.min(imgHeight - top, Math.ceil((bbox.y1 - bbox.y0) + padY * 2));

    if (width <= 10 || height <= 10) return null;

    const cropFilename = `crop_${fieldName}_${Date.now()}.png`;
    const cropFullPath = path.join(cropsDir, cropFilename);

    await img
      .extract({ left, top, width, height })
      .resize({ width: Math.min(600, width * 2), fit: 'inside' })
      .png()
      .toFile(cropFullPath);

    return `/uploads/crops/${inspectionId}/${cropFilename}`;
  } catch (err) {
    console.warn(`Failed to create evidence crop for ${fieldName}:`, err.message);
    return null;
  }
}

/**
 * Prepares an image for direct Vision AI model analysis:
 * - Automatically corrects EXIF phone orientation
 * - Resizes / upscales low-res or downscales excessive sizes to optimal reading range (1600-2400px)
 * - Enhances contrast for reflective / low-light packaging
 * - Returns JPEG buffer with metadata
 */
export async function prepareImageForVisionAI(imagePath) {
  try {
    const baseSharp = sharp(imagePath).rotate();
    const meta = await baseSharp.metadata();
    const origWidth = meta.width || 1600;
    const targetWidth = Math.min(2400, Math.max(1400, origWidth));

    const processedBuffer = await sharp(imagePath)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: false })
      .normalise()
      .jpeg({ quality: 90 })
      .toBuffer();

    const finalMeta = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: finalMeta.width || targetWidth,
      height: finalMeta.height || 1200,
      mimeType: 'image/jpeg'
    };
  } catch (err) {
    console.warn('prepareImageForVisionAI fallback to raw image:', err.message);
    const rawBuf = fs.readFileSync(imagePath);
    return {
      buffer: rawBuf,
      width: 1600,
      height: 1200,
      mimeType: 'image/jpeg'
    };
  }
}

export default {
  generatePreprocessingVariants,
  createEvidenceCrop,
  prepareImageForVisionAI
};
