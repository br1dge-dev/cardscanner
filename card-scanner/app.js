/**
 * Card Scanner mit Bildvorverarbeitung für bessere OCR-Ergebnisse
 */

// Global variables
let originalImage = null;
let processedImageData = null;
let isProcessing = false;

// DOM Elements
const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const fileName = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const originalCanvas = document.getElementById('originalCanvas');
const processedCanvas = document.getElementById('processedCanvas');
const processedContainer = document.getElementById('processedContainer');
const ocrResult = document.getElementById('ocrResult');
const copyBtn = document.getElementById('copyBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const debugLog = document.getElementById('debugLog');

// Controls
const preprocessToggle = document.getElementById('preprocessToggle');
const showPreviewToggle = document.getElementById('showPreviewToggle');
const binarizeToggle = document.getElementById('binarizeToggle');
const contrastSlider = document.getElementById('contrastSlider');
const thresholdSlider = document.getElementById('thresholdSlider');
const sharpenSlider = document.getElementById('sharpenSlider');
const contrastValue = document.getElementById('contrastValue');
const thresholdValue = document.getElementById('thresholdValue');
const sharpenValue = document.getElementById('sharpenValue');
const downloadOriginalBtn = document.getElementById('downloadOriginalBtn');
const downloadProcessedBtn = document.getElementById('downloadProcessedBtn');

// Initialize
console.log('🃏 Card Scanner mit Bildvorverarbeitung geladen');
logDebug('System initialisiert');

// Event Listeners
uploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', handleImageUpload);
processBtn.addEventListener('click', performOCR);
copyBtn.addEventListener('click', copyResult);
downloadOriginalBtn.addEventListener('click', () => downloadCanvas(originalCanvas, 'original.png'));
downloadProcessedBtn.addEventListener('click', () => downloadCanvas(processedCanvas, 'processed.png'));

// Slider event listeners
contrastSlider.addEventListener('input', (e) => {
    contrastValue.textContent = e.target.value;
    if (originalImage) updatePreview();
});
thresholdSlider.addEventListener('input', (e) => {
    thresholdValue.textContent = e.target.value;
    if (originalImage) updatePreview();
});
sharpenSlider.addEventListener('input', (e) => {
    sharpenValue.textContent = e.target.value;
    if (originalImage) updatePreview();
});
binarizeToggle.addEventListener('change', () => {
    if (originalImage) updatePreview();
});
preprocessToggle.addEventListener('change', () => {
    if (originalImage) updatePreview();
});
showPreviewToggle.addEventListener('change', () => {
    processedContainer.style.display = showPreviewToggle.checked ? 'block' : 'none';
    if (originalImage && showPreviewToggle.checked) updatePreview();
});

/**
 * Log debug message
 */
function logDebug(message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'debug-entry';
    entry.textContent = `[${timestamp}] ${message}`;
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
    console.log(`[DEBUG] ${message}`);
}

/**
 * Handle image upload
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    logDebug(`Bild geladen: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            logDebug(`Bilddimensionen: ${originalImage.width}x${originalImage.height}`);
            displayOriginalImage();
            processBtn.disabled = false;
            updatePreview();
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Display original image on canvas
 */
function displayOriginalImage() {
    const ctx = originalCanvas.getContext('2d');
    
    // Set canvas size with max dimensions
    const maxWidth = 500;
    const maxHeight = 500;
    let width = originalImage.width;
    let height = originalImage.height;
    
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
    }
    
    originalCanvas.width = width;
    originalCanvas.height = height;
    ctx.drawImage(originalImage, 0, 0, width, height);
    
    logDebug(`Original Canvas: ${width}x${height}`);
}

/**
 * Update preview of processed image
 */
function updatePreview() {
    if (!preprocessToggle.checked) {
        processedContainer.style.display = 'none';
        return;
    }

    if (showPreviewToggle.checked) {
        processedContainer.style.display = 'block';
        const ctx = processedCanvas.getContext('2d');
        processedCanvas.width = originalCanvas.width;
        processedCanvas.height = originalCanvas.height;
        
        // Copy original image
        ctx.drawImage(originalCanvas, 0, 0);
        
        // Apply preprocessing
        processedImageData = preprocessImage(processedCanvas);
        ctx.putImageData(processedImageData, 0, 0);
        
        logDebug('Vorverarbeitungs-Preview aktualisiert');
    } else {
        processedContainer.style.display = 'none';
    }
}

/**
 * Preprocess image for better OCR
 * Steps:
 * 1. Grayscale - Remove color, keep luminance
 * 2. Contrast enhancement - Histogram stretching or S-curve
 * 3. Sharpen - Convolution filter (sharpen kernel)
 * 4. Binarization (optional) - Adaptive threshold for black/white
 * 5. Noise reduction - Light blur + resharpen
 */
function preprocessImage(canvas) {
    logDebug('Starte Bildvorverarbeitung...');
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get image data
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    
    const contrast = parseFloat(contrastSlider.value);
    const threshold = parseInt(thresholdSlider.value);
    const sharpenAmount = parseFloat(sharpenSlider.value);
    const shouldBinarize = binarizeToggle.checked;
    
    logDebug(`Parameter: Kontrast=${contrast}, Threshold=${threshold}, Schärfen=${sharpenAmount}, Binarisierung=${shouldBinarize}`);
    
    // Step 1: Grayscale
    logDebug('Schritt 1: Grayscale...');
    data = applyGrayscale(data);
    
    // Step 2: Contrast Enhancement
    logDebug('Schritt 2: Kontrast erhöhen...');
    data = applyContrast(data, contrast);
    
    // Step 3: Sharpen
    if (sharpenAmount > 0) {
        logDebug('Schritt 3: Schärfen...');
        data = applySharpen(data, width, height, sharpenAmount);
    }
    
    // Step 4: Binarization (optional)
    if (shouldBinarize) {
        logDebug('Schritt 4: Binarisierung...');
        data = applyBinarization(data, threshold);
    }
    
    // Step 5: Noise Reduction (mild blur + resharpen)
    if (!shouldBinarize) {
        logDebug('Schritt 5: Noise Reduction...');
        data = applyNoiseReduction(data, width, height);
    }
    
    // Put processed data back
    imageData.data.set(data);
    
    logDebug('Bildvorverarbeitung abgeschlossen');
    return imageData;
}

/**
 * Apply grayscale conversion
 * Uses luminance formula: 0.299*R + 0.587*G + 0.114*B
 */
function applyGrayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Luminance formula
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // Alpha remains unchanged
    }
    return data;
}

/**
 * Apply contrast enhancement
 * Uses histogram stretching with S-curve
 */
function applyContrast(data, amount) {
    // Contrast factor
    const factor = (259 * (amount * 100 + 255)) / (255 * (259 - amount * 100));
    
    for (let i = 0; i < data.length; i += 4) {
        // Apply contrast to each channel
        data[i] = clamp(factor * (data[i] - 128) + 128);
        data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
        data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
    }
    return data;
}

/**
 * Apply sharpening using convolution
 * Sharpen kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
 */
function applySharpen(data, width, height, amount) {
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
 * Apply binarization (threshold)
 */
function applyBinarization(data, threshold) {
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]; // All channels are same after grayscale
        const value = gray > threshold ? 255 : 0;
        
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }
    return data;
}

/**
 * Apply noise reduction
 * Light Gaussian blur followed by mild sharpen
 */
function applyNoiseReduction(data, width, height) {
    // Light Gaussian blur kernel
    const blurKernel = [
        1/16, 2/16, 1/16,
        2/16, 4/16, 2/16,
        1/16, 2/16, 1/16
    ];
    
    const blurred = new Uint8ClampedArray(data);
    
    // Apply blur
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
    
    // Mild resharpen
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
 * Clamp value to 0-255 range
 */
function clamp(value) {
    return Math.max(0, Math.min(255, value));
}

/**
 * Perform OCR using Tesseract.js
 */
async function performOCR() {
    if (isProcessing) return;
    
    isProcessing = true;
    processBtn.disabled = true;
    processBtn.textContent = '⏳ Verarbeite...';
    ocrResult.value = '';
    progressContainer.style.display = 'block';
    logDebug('Starte OCR...');
    
    try {
        // Determine which canvas to use
        let sourceCanvas = originalCanvas;
        
        if (preprocessToggle.checked) {
            // Create a temporary canvas with processed image
            sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = processedCanvas.width;
            sourceCanvas.height = processedCanvas.height;
            const ctx = sourceCanvas.getContext('2d');
            
            // Apply preprocessing
            processedImageData = preprocessImage(originalCanvas);
            ctx.putImageData(processedImageData, 0, 0);
            
            logDebug('Vorverarbeitetes Bild für OCR verwendet');
        } else {
            logDebug('Originalbild für OCR verwendet');
        }
        
        // Configure Tesseract with optimized settings
        const config = {
            lang: 'deu+eng',
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `${progress}%`;
                }
                logDebug(`Tesseract: ${m.status} - ${Math.round(m.progress * 100)}%`);
            },
            errorHandler: (err) => console.error(err),
            // OCR configuration
            psm: 6, // Assume a single uniform block of text
            oem: 3, // LSTM neural net mode only
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,;:!?()-_\/\'"&@#$%*+= ',
        };
        
        logDebug('Tesseract-Konfiguration:');
        logDebug(`  PSM: ${config.psm} (einzelner Textblock)`);
        logDebug(`  OEM: ${config.oem} (LSTM only)`);
        logDebug(`  Sprachen: ${config.lang}`);
        
        // Create worker and recognize
        const worker = await Tesseract.createWorker('deu+eng');
        
        // Set parameters
        await worker.setParameters({
            tessedit_pageseg_mode: config.psm,
            tessedit_ocr_engine_mode: config.oem,
            tessedit_char_whitelist: config.tessedit_char_whitelist,
        });
        
        const result = await worker.recognize(sourceCanvas);
        await worker.terminate();
        
        // Display result
        ocrResult.value = result.data.text;
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        logDebug(`OCR abgeschlossen! Konfidenz: ${result.data.confidence.toFixed(1)}%`);
        logDebug(`Erkannte Wörter: ${result.data.words.length}`);
        
    } catch (error) {
        console.error('OCR Error:', error);
        ocrResult.value = `Fehler bei der OCR: ${error.message}`;
        logDebug(`FEHLER: ${error.message}`);
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        processBtn.textContent = '🔍 OCR starten';
    }
}

/**
 * Copy OCR result to clipboard
 */
function copyResult() {
    ocrResult.select();
    document.execCommand('copy');
    
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Kopiert!';
    setTimeout(() => {
        copyBtn.textContent = originalText;
    }, 2000);
    
    logDebug('OCR-Ergebnis in Zwischenablage kopiert');
}

/**
 * Download canvas as image
 */
function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    logDebug(`Bild heruntergeladen: ${filename}`);
}