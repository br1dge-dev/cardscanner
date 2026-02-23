/**
 * Image Preprocessing Utilities - LIGHT version
 * Gentle optimizations for OCR without destroying image quality
 */

export async function preprocessImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Use original dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // LIGHT processing pipeline - keep it bright!
      applyGrayscale(data);
      applyContrast(data, 1.15); // Only 15% contrast increase (was 40%)
      applyLightSharpening(data, canvas.width, canvas.height);
      // NO thresholding - keeps image bright

      // Put processed data back
      ctx.putImageData(imageData, 0, 0);

      // Return as data URL
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}

/**
 * Convert to grayscale
 */
function applyGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

/**
 * Adjust contrast - GENTLE
 */
function applyContrast(data: Uint8ClampedArray, factor: number): void {
  const intercept = 128 * (1 - factor);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * data[i] + intercept));
    data[i + 1] = Math.min(255, Math.max(0, factor * data[i + 1] + intercept));
    data[i + 2] = Math.min(255, Math.max(0, factor * data[i + 2] + intercept));
  }
}

/**
 * Very light sharpening - don't overdo it
 */
function applyLightSharpening(data: Uint8ClampedArray, width: number, height: number): void {
  const output = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Gentler sharpen kernel
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const top = data[((y - 1) * width + x) * 4 + c];
        const bottom = data[((y + 1) * width + x) * 4 + c];
        const left = data[(y * width + x - 1) * 4 + c];
        const right = data[(y * width + x + 1) * 4 + c];
        
        // Reduced sharpening strength
        const sharpened = center + 0.3 * (center - (top + bottom + left + right) / 4);
        output[idx + c] = Math.min(255, Math.max(0, sharpened));
      }
    }
  }
  
  // Copy output back
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
}
