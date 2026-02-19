/**
 * Bild-Preprocessing für bessere OCR-Ergebnisse
 * Optimiert für Tesseract.js - besonders für Text auf Karten
 */

export interface PreprocessingOptions {
  contrast?: number;      // 0.5 - 3.0, default: 1.5
  threshold?: number;     // 0 - 255, default: 128
  sharpen?: number;       // 0 - 2.0, default: 1.0
  binarize?: boolean;     // default: false
  noiseReduction?: boolean; // default: true
}

export interface PreprocessingResult {
  processedImageDataUrl: string;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: PreprocessingOptions = {
  contrast: 1.2,  // Reduziert von 1.5 auf 1.2 (heller bleiben)
  threshold: 128,
  sharpen: 0.8,   // Leichte Schärfung statt aggressiv
  binarize: false, // Kein Thresholding mehr (zu aggressiv)
  noiseReduction: false // Deaktiviert - macht Bild zu dunkel
};

/**
 * Hauptfunktion: Preprocess ein Bild für OCR
 * @param imageDataUrl - Base64-String des Bildes
 * @param options - Optionale Preprocessing-Parameter
 * @returns Promise mit dem verarbeiteten Bild als Data URL
 */
export async function preprocessImage(
  imageDataUrl: string,
  options: PreprocessingOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Canvas erstellen
        const canvas = document.createElement('canvas');
        const maxDimension = 2000; // Max dimension für Performance
        
        let width = img.width;
        let height = img.height;
        
        // Skalieren wenn nötig
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Bild zeichnen
        ctx.drawImage(img, 0, 0, width, height);
        
        // ImageData holen
        let imageData = ctx.getImageData(0, 0, width, height);
        let data = imageData.data;
        
        // Original-Daten für Test-Modus speichern
        const originalData = new Uint8ClampedArray(data);
        
        // Schritt 1: Grayscale (immer)
        data = applyGrayscale(data);
        
        // Schritt 2: Kontrast-Verstärkung (sanft)
        if (opts.contrast && opts.contrast !== 1.0) {
          data = applyContrast(data, opts.contrast);
        }
        
        // Schritt 3: Leichtes Schärfen
        if (opts.sharpen && opts.sharpen > 0) {
          data = applySharpen(data, width, height, opts.sharpen);
        }
        
        // Schritt 4: Noise Reduction (optional, default: false)
        if (opts.noiseReduction) {
          data = applyNoiseReduction(data, width, height);
        }
        
        // KEIN Thresholding/Binarisierung mehr - macht zu dunkel
        
        // Test-Modus: Original leicht durchscheinen lassen (30%)
        // Das hilft OCR bei schwierigen Beleuchtungsverhältnissen
        for (let i = 0; i < data.length; i += 4) {
          const originalGray = Math.round(0.299 * originalData[i] + 0.587 * originalData[i + 1] + 0.114 * originalData[i + 2]);
          // 70% processed, 30% original
          data[i] = Math.round(data[i] * 0.7 + originalGray * 0.3);
          data[i + 1] = Math.round(data[i + 1] * 0.7 + originalGray * 0.3);
          data[i + 2] = Math.round(data[i + 2] * 0.7 + originalGray * 0.3);
        }
        
        // Zurück auf Canvas schreiben
        imageData.data.set(data);
        ctx.putImageData(imageData, 0, 0);
        
        // Als Data URL zurückgeben
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}

/**
 * Konvertiert zu Graustufen
 * Nutzt Luminanz-Formel: 0.299*R + 0.587*G + 0.114*B
 */
function applyGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Luminanz-Formel für bessere Wahrnehmung
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha (i + 3) bleibt unverändert
  }
  return data;
}

/**
 * Kontrast-Verstärkung mit Histogram-Stretching
 * Angepasst: Weniger aggressiv, helleres Ergebnis
 */
function applyContrast(data: Uint8ClampedArray, amount: number): Uint8ClampedArray {
  // Sanfterer Kontrast-Faktor - verhindert zu dunkle Bereiche
  const factor = (259 * (amount * 80 + 255)) / (255 * (259 - amount * 80));
  const midpoint = 110; // Niedrigerer Mittelpunkt = helleres Bild
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor * (data[i] - midpoint) + midpoint + 15); // +15 Brightness boost
    data[i + 1] = clamp(factor * (data[i + 1] - midpoint) + midpoint + 15);
    data[i + 2] = clamp(factor * (data[i + 2] - midpoint) + midpoint + 15);
  }
  return data;
}

/**
 * Schärfen mit Convolution-Kernel
 * Kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
 */
function applySharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data);
  const kernel = [
    0, -1 * amount, 0,
    -1 * amount, 1 + 4 * amount, -1 * amount,
    0, -1 * amount, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kidx = (ky + 1) * 3 + (kx + 1);
          
          r += data[idx] * kernel[kidx];
          g += data[idx + 1] * kernel[kidx];
          b += data[idx + 2] * kernel[kidx];
        }
      }
      
      const idx = (y * width + x) * 4;
      output[idx] = clamp(r);
      output[idx + 1] = clamp(g);
      output[idx + 2] = clamp(b);
    }
  }
  
  return output;
}

/**
 * Binarisierung (Schwarz/Weiß) mit Threshold
 */
function applyBinarization(data: Uint8ClampedArray, threshold: number): Uint8ClampedArray {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]; // Alle Kanäle sind gleich nach Grayscale
    const value = gray > threshold ? 255 : 0;
    
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return data;
}

/**
 * Noise Reduction mit Gaussian Blur + leichtem Resharpen
 */
function applyNoiseReduction(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  // Gaussian Blur Kernel (3x3)
  const blurKernel = [
    1/16, 2/16, 1/16,
    2/16, 4/16, 2/16,
    1/16, 2/16, 1/16
  ];
  
  const blurred = new Uint8ClampedArray(data);
  
  // Blur anwenden
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kidx = (ky + 1) * 3 + (kx + 1);
          
          r += data[idx] * blurKernel[kidx];
          g += data[idx + 1] * blurKernel[kidx];
          b += data[idx + 2] * blurKernel[kidx];
        }
      }
      
      const idx = (y * width + x) * 4;
      blurred[idx] = clamp(r);
      blurred[idx + 1] = clamp(g);
      blurred[idx + 2] = clamp(b);
    }
  }
  
  // Leichtes Resharpen
  const sharpenKernel = [
    0, -0.5, 0,
    -0.5, 3, -0.5,
    0, -0.5, 0
  ];
  
  const output = new Uint8ClampedArray(blurred);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kidx = (ky + 1) * 3 + (kx + 1);
          
          r += blurred[idx] * sharpenKernel[kidx];
          g += blurred[idx + 1] * sharpenKernel[kidx];
          b += blurred[idx + 2] * sharpenKernel[kidx];
        }
      }
      
      const idx = (y * width + x) * 4;
      output[idx] = clamp(r);
      output[idx + 1] = clamp(g);
      output[idx + 2] = clamp(b);
    }
  }
  
  return output;
}

/**
 * Hilfsfunktion: Wert auf 0-255 begrenzen
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Extrahiert Karten-Nummer aus OCR-Text
 * Sucht nach Mustern wie "123/456" oder "#123"
 */
export function extractCardNumber(text: string): string | null {
  // Muster: 3 Ziffern / 3 Ziffern (Pokémon-Karten)
  const pokemonPattern = /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/;
  const match = text.match(pokemonPattern);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  
  // Muster: #123 oder No. 123
  const hashPattern = /#\s*(\d{1,3})/i;
  const hashMatch = text.match(hashPattern);
  if (hashMatch) {
    return hashMatch[1];
  }
  
  return null;
}

/**
 * Extrahiert Karten-Namen aus OCR-Text
 * Nimmt die erste längere Zeile als Titel
 */
export function extractCardName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Suche nach der ersten Zeile mit mehr als 3 Zeichen
  for (const line of lines) {
    if (line.length > 3 && line.length < 50 && !line.match(/^\d+\/\d+$/)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Berechnet Confidence-Score basierend auf OCR-Daten
 */
export function calculateConfidence(words: Array<{ text: string; confidence: number }>): number {
  if (words.length === 0) return 0;
  const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  return Math.round(avgConfidence * 10) / 10; // Auf 1 Dezimalstelle runden
}
