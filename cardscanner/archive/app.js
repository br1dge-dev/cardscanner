/**
 * Riftbound Card Scanner - OCR Vergleich
 * Unterstützt Tesseract.js und PaddleOCR
 */

// ============================================
// Globale Variablen
// ============================================
let currentImage = null;
let tesseractWorker = null;
let paddleOCRLoaded = false;
let paddleOCRModel = null;
let paddleOCRReady = false;

// PaddleOCR Konfiguration
const PADDLE_CONFIG = {
    modelPath: 'https://cdn.jsdelivr.net/npm/@paddlejs-models/ocr@2.0.0/dist/',
    warmup: true
};

// ============================================
// DOM Elemente
// ============================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const scanBtn = document.getElementById('scanBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');
const progressFill = document.getElementById('progressFill');

// Engine Optionen
const useTesseract = document.getElementById('useTesseract');
const usePaddle = document.getElementById('usePaddle');

// Ergebnis-Karten
const tesseractCard = document.getElementById('tesseractCard');
const paddleCard = document.getElementById('paddleCard');

// ============================================
// Initialisierung
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Card Scanner initialisiert');
    
    // Event Listener
    setupEventListeners();
    
    // Testbilder laden
    loadTestImages();
    
    // Tesseract Worker vorbereiten
    await initTesseract();
});

function setupEventListeners() {
    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // File Input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Engine Auswahl
    document.querySelectorAll('.engine-option').forEach(option => {
        option.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = option.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            updateEngineSelection();
        });
    });

    useTesseract.addEventListener('change', updateEngineSelection);
    usePaddle.addEventListener('change', updateEngineSelection);

    // Scan Button
    scanBtn.addEventListener('click', performOCR);
}

function updateEngineSelection() {
    document.querySelectorAll('.engine-option').forEach(option => {
        const engine = option.dataset.engine;
        const checkbox = document.getElementById(engine === 'tesseract' ? 'useTesseract' : 'usePaddle');
        if (checkbox.checked) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// ============================================
// Tesseract.js Initialisierung
// ============================================
async function initTesseract() {
    try {
        showLoading('Initialisiere Tesseract.js...', 'Lade OCR-Modelle...');
        
        tesseractWorker = await Tesseract.createWorker('deu+eng');
        
        hideLoading();
        console.log('✅ Tesseract.js bereit');
    } catch (error) {
        console.error('❌ Tesseract Initialisierungsfehler:', error);
        hideLoading();
    }
}

// ============================================
// PaddleOCR Initialisierung
// ============================================
async function initPaddleOCR() {
    if (paddleOCRLoaded) return;
    
    try {
        showLoading('Initialisiere PaddleOCR...', 'Lade WebGL-Modelle (~20MB)...', 0);
        
        // Prüfen ob paddleOCR global verfügbar ist
        if (typeof paddleOCR === 'undefined') {
            throw new Error('PaddleOCR Bibliothek nicht geladen. Bitte Seite neu laden.');
        }
        
        // PaddleOCR initialisieren
        await paddleOCR.init();
        
        // Fortschritt simulieren
        updateProgress(30);
        await new Promise(r => setTimeout(r, 500));
        updateProgress(60);
        await new Promise(r => setTimeout(r, 500));
        updateProgress(100);
        
        paddleOCRLoaded = true;
        hideLoading();
        console.log('✅ PaddleOCR bereit');
    } catch (error) {
        console.error('❌ PaddleOCR Initialisierungsfehler:', error);
        hideLoading();
        throw error;
    }
}

// ============================================
// Datei-Handling
// ============================================
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Bitte ein Bild hochladen');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        scanBtn.disabled = false;
        
        // Vorschau aktualisieren
        dropZone.innerHTML = `
            <img src="${currentImage}" style="max-height: 200px; border-radius: 8px;">
            <p style="margin-top: 10px; color: #888;">${file.name}</p>
            <button class="upload-btn" onclick="resetUpload()" style="margin-top: 10px;">
                Anderes Bild wählen
            </button>
        `;
        
        console.log('📸 Bild geladen:', file.name);
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    currentImage = null;
    scanBtn.disabled = true;
    fileInput.value = '';
    
    dropZone.innerHTML = `
        <p>📷 Kartenbild per Drag & Drop hier ablegen</p>
        <p style="color: #888; font-size: 13px; margin-top: 10px;">oder</p>
        <button class="upload-btn" onclick="document.getElementById('fileInput').click()">
            Bild auswählen
        </button>
        <input type="file" id="fileInput" class="file-input" accept="image/*">
    `;
    
    // Event Listener neu binden
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

// ============================================
// Testbilder laden
// ============================================
function loadTestImages() {
    const testImages = [
        { name: 'card-scan-1.jpg', path: 'test-uploads/card-scan-1.jpg' },
        { name: 'card-scan-1771340135233.jpg', path: 'test-uploads/card-scan-1771340135233.jpg' }
    ];

    const grid = document.getElementById('testImageGrid');
    
    testImages.forEach(img => {
        const item = document.createElement('div');
        item.className = 'test-image-item';
        item.innerHTML = `<img src="${img.path}" alt="${img.name}" loading="lazy">`;
        item.addEventListener('click', () => loadTestImage(img.path));
        grid.appendChild(item);
    });
}

async function loadTestImage(path) {
    try {
        const response = await fetch(path);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImage = e.target.result;
            scanBtn.disabled = false;
            
            dropZone.innerHTML = `
                <img src="${currentImage}" style="max-height: 200px; border-radius: 8px;">
                <p style="margin-top: 10px; color: #888;">Testbild: ${path.split('/').pop()}</p>
                <button class="upload-btn" onclick="resetUpload()" style="margin-top: 10px;">
                    Anderes Bild wählen
                </button>
            `;
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error('Fehler beim Laden des Testbildes:', error);
    }
}

// ============================================
// OCR Durchführung
// ============================================
async function performOCR() {
    if (!currentImage) return;

    const useTess = useTesseract.checked;
    const usePaddleOCR = usePaddle.checked;

    if (!useTess && !usePaddleOCR) {
        alert('Bitte mindestens eine OCR-Engine auswählen');
        return;
    }

    // UI zurücksetzen
    resetResults();
    scanBtn.disabled = true;
    scanBtn.classList.add('scanning');

    const results = {
        tesseract: null,
        paddle: null
    };

    try {
        // Parallel beide OCRs ausführen
        const promises = [];

        if (useTess) {
            promises.push(
                performOCRWithTesseract(currentImage)
                    .then(result => { results.tesseract = result; })
                    .catch(error => { 
                        results.tesseract = { error: error.message, text: '', time: 0 }; 
                    })
            );
        }

        if (usePaddleOCR) {
            promises.push(
                performOCRWithPaddle(currentImage)
                    .then(result => { results.paddle = result; })
                    .catch(error => { 
                        console.error('PaddleOCR Fehler:', error);
                        results.paddle = { error: error.message, text: '', time: 0 };
                        // Fallback zu Tesseract wenn Paddle fehlschlägt
                        if (!useTess && tesseractWorker) {
                            console.log('🔄 Fallback zu Tesseract.js');
                            return performOCRWithTesseract(currentImage)
                                .then(result => { results.tesseract = result; });
                        }
                    })
            );
        }

        await Promise.all(promises);

        // Ergebnisse anzeigen
        displayResults(results);

    } catch (error) {
        console.error('OCR Fehler:', error);
        alert('Fehler bei der OCR: ' + error.message);
    } finally {
        scanBtn.disabled = false;
        scanBtn.classList.remove('scanning');
    }
}

// ============================================
// Tesseract.js OCR
// ============================================
async function performOCRWithTesseract(imageData) {
    const startTime = performance.now();
    
    updateStatus('tesseract', 'loading', 'Verarbeite...');
    tesseractCard.classList.remove('hidden');
    document.getElementById('tesseractImage').src = imageData;
    document.getElementById('tesseractImage').style.display = 'block';

    try {
        if (!tesseractWorker) {
            await initTesseract();
        }

        const result = await tesseractWorker.recognize(imageData);
        const text = result.data.text;
        const time = Math.round(performance.now() - startTime);

        updateStatus('tesseract', 'success', 'Fertig');
        document.getElementById('tesseractText').textContent = text || '(Kein Text erkannt)';
        document.getElementById('tesseractText').classList.remove('empty');
        document.getElementById('tesseractTime').textContent = `⏱️ ${time}ms`;

        return { text, time, confidence: result.data.confidence };
    } catch (error) {
        updateStatus('tesseract', 'error', 'Fehler');
        document.getElementById('tesseractText').textContent = 'Fehler: ' + error.message;
        throw error;
    }
}

// ============================================
// PaddleOCR
// ============================================
async function performOCRWithPaddle(imageData) {
    const startTime = performance.now();
    
    updateStatus('paddle', 'loading', 'Verarbeite...');
    paddleCard.classList.remove('hidden');
    document.getElementById('paddleImage').src = imageData;
    document.getElementById('paddleImage').style.display = 'block';

    try {
        // PaddleOCR laden falls noch nicht geschehen
        if (!paddleOCRLoaded) {
            await initPaddleOCR();
        }

        // Bild in ein Image Objekt laden
        const img = await loadImage(imageData);
        
        // Canvas für Bildvorverarbeitung erstellen
        const processedImg = await preprocessImageForPaddle(img);
        
        // OCR durchführen
        let result;
        try {
            result = await paddleOCR.recognize(processedImg);
        } catch (recognizeError) {
            console.warn('PaddleOCR mit Vorverarbeitung fehlgeschlagen, versuche Original:', recognizeError);
            result = await paddleOCR.recognize(img);
        }
        
        // Ergebnisse verarbeiten
        let text = '';
        let confidence = 0;
        
        if (result && result.text) {
            text = result.text;
            confidence = result.confidence || 0;
        } else if (Array.isArray(result)) {
            // Falls das Ergebnis ein Array von Erkennungen ist
            text = result.map(r => r.text || r).join('\n');
            const confidences = result.map(r => r.confidence || 0).filter(c => c > 0);
            confidence = confidences.length > 0 
                ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
                : 0;
        } else if (result && result.texts) {
            // Alternative API-Struktur
            text = result.texts.join('\n');
            confidence = result.confidence || 0;
        }

        const time = Math.round(performance.now() - startTime);

        updateStatus('paddle', 'success', 'Fertig');
        document.getElementById('paddleText').textContent = text || '(Kein Text erkannt)';
        document.getElementById('paddleText').classList.remove('empty');
        document.getElementById('paddleTime').textContent = `⏱️ ${time}ms`;

        return { text, time, confidence };
    } catch (error) {
        console.error('PaddleOCR Fehler:', error);
        updateStatus('paddle', 'error', 'Fehler');
        document.getElementById('paddleText').textContent = 'Fehler: ' + error.message + '\n\nFallback: Verwende Tesseract.js als Alternative.';
        throw error;
    }
}

// ============================================
// Bildvorverarbeitung für PaddleOCR
// ============================================
async function preprocessImageForPaddle(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Original-Größe beibehalten oder skalieren für bessere Performance
    const maxDimension = 1920;
    let width = img.width;
    let height = img.height;
    
    if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width *= ratio;
        height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Bild mit besserer Qualität zeichnen
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas;
}

// ============================================
// Hilfsfunktionen
// ============================================
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function updateStatus(engine, status, text) {
    const statusEl = document.getElementById(engine + 'Status');
    statusEl.className = 'result-status ' + status;
    statusEl.textContent = text;
}

function resetResults() {
    // Status zurücksetzen
    updateStatus('tesseract', 'loading', 'Wartet...');
    updateStatus('paddle', 'loading', 'Wartet...');
    
    // Text zurücksetzen
    document.getElementById('tesseractText').textContent = 'Verarbeite...';
    document.getElementById('tesseractText').classList.add('empty');
    document.getElementById('paddleText').textContent = 'Verarbeite...';
    document.getElementById('paddleText').classList.add('empty');
    
    // Zeit zurücksetzen
    document.getElementById('tesseractTime').textContent = '';
    document.getElementById('paddleTime').textContent = '';
    
    // Karten anzeigen/verstecken
    if (useTesseract.checked) {
        tesseractCard.classList.remove('hidden');
    } else {
        tesseractCard.classList.add('hidden');
    }
    
    if (usePaddle.checked) {
        paddleCard.classList.remove('hidden');
    } else {
        paddleCard.classList.add('hidden');
    }
    
    // Summary ausblenden
    document.getElementById('summarySection').style.display = 'none';
}

function displayResults(results) {
    const summarySection = document.getElementById('summarySection');
    const tbody = document.getElementById('comparisonTableBody');
    
    tbody.innerHTML = '';
    
    // Tesseract Ergebnis
    if (results.tesseract) {
        const row = document.createElement('tr');
        const quality = results.tesseract.error ? '❌ Fehler' : 
                       (results.tesseract.confidence > 80 ? '🟢 Gut' : 
                        results.tesseract.confidence > 50 ? '🟡 Mittel' : '🔴 Schlecht');
        row.innerHTML = `
            <td>Tesseract.js</td>
            <td>${results.tesseract.time}ms</td>
            <td>${results.tesseract.text?.length || 0} Zeichen</td>
            <td>${quality}</td>
        `;
        tbody.appendChild(row);
    }
    
    // PaddleOCR Ergebnis
    if (results.paddle) {
        const row = document.createElement('tr');
        const quality = results.paddle.error ? '❌ Fehler' : 
                       (results.paddle.confidence > 80 ? '🟢 Gut' : 
                        results.paddle.confidence > 50 ? '🟡 Mittel' : '🔴 Schlecht');
        row.innerHTML = `
            <td>PaddleOCR</td>
            <td>${results.paddle.time}ms</td>
            <td>${results.paddle.text?.length || 0} Zeichen</td>
            <td>${quality}</td>
        `;
        tbody.appendChild(row);
    }
    
    summarySection.style.display = 'block';
}

// ============================================
// Loading Overlay
// ============================================
function showLoading(text, subtext = '', progress = 0) {
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    updateProgress(progress);
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
    setTimeout(() => {
        updateProgress(0);
    }, 300);
}

function updateProgress(percent) {
    progressFill.style.width = percent + '%';
}

// ============================================
// Cleanup beim Schließen
// ============================================
window.addEventListener('beforeunload', async () => {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
    }
});

console.log('📚 Card Scanner App geladen');
console.log('🔧 Verfügbare Engines: Tesseract.js, PaddleOCR');
