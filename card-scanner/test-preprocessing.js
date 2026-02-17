/**
 * Test-Skript für Bildvorverarbeitung
 */

const fs = require('fs');
const path = require('path');

// Import canvas for Node.js
let Canvas, Image;
try {
    const canvas = require('canvas');
    Canvas = canvas.Canvas;
    Image = canvas.Image;
    console.log('✅ Canvas-Modul geladen');
} catch (e) {
    console.log('⚠️ Canvas-Modul nicht verfügbar, installiere es...');
    process.exit(1);
}

// Test image path
const testImagePath = path.join(__dirname, '..', 'cardscanner', 'test-uploads', 'card-scan-1.jpg');
const outputDir = path.join(__dirname, 'test-preprocessing');

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Preprocess image for better OCR
 */
function preprocessImage(canvas, contrast = 1.5, threshold = 128, sharpenAmount = 1.0, shouldBinarize = false) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get image data
    let imageData = ctx.getImageData(0, 0, width, height);
    let data = imageData.data;
    
    console.log(`🎨 Verarbeite Bild: ${width}x${height}`);
    console.log(`   Parameter: Kontrast=${contrast}, Threshold=${threshold}, Schärfen=${sharpenAmount}, Binarisierung=${shouldBinarize}`);
    
    // Step 1: Grayscale
    console.log('   Step 1: Grayscale...');
    data = applyGrayscale(data);
    
    // Step 2: Contrast Enhancement
    console.log('   Step 2: Kontrast erhöhen...');
    data = applyContrast(data, contrast);
    
    // Step 3: Sharpen
    if (sharpenAmount > 0) {
        console.log('   Step 3: Schärfen...');
        data = applySharpen(data, width, height, sharpenAmount);
    }
    
    // Step 4: Binarization (optional)
    if (shouldBinarize) {
        console.log('   Step 4: Binarisierung...');
        data = applyBinarization(data, threshold);
    }
    
    // Step 5: Noise Reduction
    if (!shouldBinarize) {
        console.log('   Step 5: Noise Reduction...');
        data = applyNoiseReduction(data, width, height);
    }
    
    // Put processed data back
    imageData.data.set(data);
    return imageData;
}

function applyGrayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    return data;
}

function applyContrast(data, amount) {
    const factor = (259 * (amount * 100 + 255)) / (255 * (259 - amount * 100));
    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(factor * (data[i] - 128) + 128);
        data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128);
        data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128);
    }
    return data;
}

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

function applyBinarization(data, threshold) {
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        const value = gray > threshold ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }
    return data;
}

function applyNoiseReduction(data, width, height) {
    const blurKernel = [
        1/16, 2/16, 1/16,
        2/16, 4/16, 2/16,
        1/16, 2/16, 1/16
    ];
    
    const blurred = new Uint8ClampedArray(data);
    
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

function clamp(value) {
    return Math.max(0, Math.min(255, value));
}

// Test verschiedene Vorverarbeitungs-Konfigurationen
async function testPreprocessing() {
    console.log('\n🧪 Teste Bildvorverarbeitung\n');
    console.log('=' .repeat(50));
    
    // Load image
    console.log(`\n📂 Lade Testbild: ${testImagePath}`);
    const img = new Image();
    img.src = fs.readFileSync(testImagePath);
    
    console.log(`📐 Bildgröße: ${img.width}x${img.height}`);
    
    // Test 1: Original
    console.log('\n--- Test 1: Original (ohne Vorverarbeitung) ---');
    const canvas1 = new Canvas(img.width, img.height);
    const ctx1 = canvas1.getContext('2d');
    ctx1.drawImage(img, 0, 0);
    const buffer1 = canvas1.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '01_original.png'), buffer1);
    console.log('✅ Gespeichert: 01_original.png');
    
    // Test 2: Standard-Vorverarbeitung
    console.log('\n--- Test 2: Standard-Vorverarbeitung ---');
    const canvas2 = new Canvas(img.width, img.height);
    const ctx2 = canvas2.getContext('2d');
    ctx2.drawImage(img, 0, 0);
    const processed2 = preprocessImage(canvas2, 1.5, 128, 1.0, false);
    ctx2.putImageData(processed2, 0, 0);
    const buffer2 = canvas2.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '02_preprocessed_standard.png'), buffer2);
    console.log('✅ Gespeichert: 02_preprocessed_standard.png');
    
    // Test 3: Hoher Kontrast
    console.log('\n--- Test 3: Hoher Kontrast ---');
    const canvas3 = new Canvas(img.width, img.height);
    const ctx3 = canvas3.getContext('2d');
    ctx3.drawImage(img, 0, 0);
    const processed3 = preprocessImage(canvas3, 2.5, 128, 1.0, false);
    ctx3.putImageData(processed3, 0, 0);
    const buffer3 = canvas3.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '03_high_contrast.png'), buffer3);
    console.log('✅ Gespeichert: 03_high_contrast.png');
    
    // Test 4: Mit Binarisierung
    console.log('\n--- Test 4: Mit Binarisierung ---');
    const canvas4 = new Canvas(img.width, img.height);
    const ctx4 = canvas4.getContext('2d');
    ctx4.drawImage(img, 0, 0);
    const processed4 = preprocessImage(canvas4, 1.5, 128, 1.0, true);
    ctx4.putImageData(processed4, 0, 0);
    const buffer4 = canvas4.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '04_binarized.png'), buffer4);
    console.log('✅ Gespeichert: 04_binarized.png');
    
    // Test 5: Niedriger Threshold (mehr Schwarz)
    console.log('\n--- Test 5: Niedriger Threshold ---');
    const canvas5 = new Canvas(img.width, img.height);
    const ctx5 = canvas5.getContext('2d');
    ctx5.drawImage(img, 0, 0);
    const processed5 = preprocessImage(canvas5, 1.5, 100, 1.0, true);
    ctx5.putImageData(processed5, 0, 0);
    const buffer5 = canvas5.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '05_low_threshold.png'), buffer5);
    console.log('✅ Gespeichert: 05_low_threshold.png');
    
    // Test 6: Hoher Threshold (mehr Weiß)
    console.log('\n--- Test 6: Hoher Threshold ---');
    const canvas6 = new Canvas(img.width, img.height);
    const ctx6 = canvas6.getContext('2d');
    ctx6.drawImage(img, 0, 0);
    const processed6 = preprocessImage(canvas6, 1.5, 180, 1.0, true);
    ctx6.putImageData(processed6, 0, 0);
    const buffer6 = canvas6.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, '06_high_threshold.png'), buffer6);
    console.log('✅ Gespeichert: 06_high_threshold.png');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Alle Tests abgeschlossen!');
    console.log(`📁 Ergebnisse in: ${outputDir}\n`);
}

// Run tests
testPreprocessing().catch(console.error);