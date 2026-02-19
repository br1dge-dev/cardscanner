/**
 * Image Preprocessing Utilities
 * Optimizes card images for better OCR results
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

      // Apply processing pipeline
      applyGrayscale(data);
      applyContrast(data, 1.4); // Increase contrast by 40%
      applySharpening(data, canvas.width, canvas.height);
      applyThreshold(data, 120); // Light thresholding

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
 * Adjust contrast
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
 * Simple sharpening filter
 */
function applySharpening(data: Uint8ClampedArray, width: number, height: number): void {
  const output = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Sharpen kernel
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const top = data[((y - 1) * width + x) * 4 + c];
        const bottom = data[((y + 1) * width + x) * 4 + c];
        const left = data[(y * width + x - 1) * 4 + c];
        const right = data[(y * width + x + 1) * 4 + c];
        
        const sharpened = 5 * center - top - bottom - left - right;
        output[idx + c] = Math.min(255, Math.max(0, sharpened));
      }
    }
  }
  
  // Copy output back
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
}

/**
 * Apply threshold to make text more distinct
 */
function applyThreshold(data: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const newValue = gray > threshold ? Math.min(255, gray + 20) : Math.max(0, gray - 20);
    data[i] = newValue;
    data[i + 1] = newValue;
    data[i + 2] = newValue;
  }
}
