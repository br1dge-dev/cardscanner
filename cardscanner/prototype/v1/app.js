/**
 * Card Scanner Prototype v1
 * Vanilla JavaScript - Keine Frameworks
 */

// DOM Elemente
const video = document.getElementById('camera-stream');
const shutterBtn = document.getElementById('shutter-btn');
const cameraError = document.getElementById('camera-error');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const loading = document.getElementById('loading');
const previewContainer = document.getElementById('preview-container');
const canvas = document.getElementById('capture-canvas');
const retakeBtn = document.getElementById('retake-btn');
const saveBtn = document.getElementById('save-btn');
const cardFrame = document.getElementById('card-frame');
const ocrLoading = document.getElementById('ocr-loading');
const ocrResult = document.getElementById('ocr-result');
const ocrError = document.getElementById('ocr-error');
const ocrText = document.getElementById('ocr-text');
const ocrConfidence = document.getElementById('ocr-confidence');

// State
let stream = null;
let isCapturing = false;
let tesseractWorker = null;
let isTesseractReady = false;

/**
 * Kamera initialisieren
 */
async function initCamera() {
    showLoading(true);
    hideError();
    
    try {
        // Alten Stream stoppen falls vorhanden
        if (stream) {
            stopCamera();
        }
        
        // Kamera Constraints
        const constraints = {
            video: {
                facingMode: 'environment', // Rückkamera bevorzugen
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };
        
        // getUserMedia API aufrufen
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Stream zum Video-Element zuweisen
        video.srcObject = stream;
        
        // Warten bis Video bereit ist
        video.onloadedmetadata = () => {
            video.play();
            showLoading(false);
            console.log('✅ Kamera erfolgreich gestartet');
            console.log('📹 Video-Abmessungen:', video.videoWidth, 'x', video.videoHeight);
        };
        
    } catch (error) {
        showLoading(false);
        handleCameraError(error);
    }
}

/**
 * Kamera stoppen
 */
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
    }
}

/**
 * Kamera-Fehler behandeln
 */
function handleCameraError(error) {
    console.error('❌ Kamera-Fehler:', error);
    
    let message = 'Ein unbekannter Fehler ist aufgetreten.';
    
    switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            message = 'Du hast den Kamera-Zugriff abgelehnt. Bitte erlaube den Zugriff in den Browser-Einstellungen und lade die Seite neu.';
            break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            message = 'Keine Kamera gefunden. Stelle sicher, dass dein Gerät eine Kamera hat.';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            message = 'Die Kamera wird bereits von einer anderen App verwendet. Schließe andere Apps und versuche es erneut.';
            break;
        case 'OverconstrainedError':
            message = 'Die Kamera unterstützt die gewünschten Einstellungen nicht. Versuche es mit Standard-Einstellungen.';
            // Fallback: Ohne spezifische Constraints versuchen
            fallbackCamera();
            return;
        case 'SecurityError':
            message = 'Kamera-Zugriff aus Sicherheitsgründen blockiert. Stelle sicher, dass die Seite über HTTPS oder localhost läuft.';
            break;
        default:
            message = `Fehler: ${error.message}`;
    }
    
    errorMessage.textContent = message;
    cameraError.classList.remove('hidden');
}

/**
 * Fallback Kamera-Init ohne spezifische Constraints
 */
async function fallbackCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            cameraError.classList.add('hidden');
            showLoading(false);
            console.log('✅ Kamera mit Fallback-Einstellungen gestartet');
        };
    } catch (error) {
        errorMessage.textContent = 'Auch der Fallback ist fehlgeschlagen: ' + error.message;
    }
}

/**
 * Foto aufnehmen
 */
function capturePhoto() {
    if (isCapturing || !stream) return;
    
    isCapturing = true;
    
    // Canvas für Capture erstellen
    const captureCanvas = document.createElement('canvas');
    const ctx = captureCanvas.getContext('2d');
    
    // Canvas-Größe = Video-Größe
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    
    // Video-Frame auf Canvas zeichnen
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Bereich des Card-Frames berechnen und zuschneiden
    const croppedImage = cropToCardFrame(captureCanvas);
    
    // Gecropptes Bild im Preview anzeigen
    canvas.width = croppedImage.width;
    canvas.height = croppedImage.height;
    canvas.getContext('2d').drawImage(croppedImage, 0, 0);
    
    // Preview anzeigen, Kamera ausblenden
    previewContainer.classList.remove('hidden');
    
    // Capture-Daten speichern für Download
    canvas.dataset.fullImage = captureCanvas.toDataURL('image/jpeg', 0.95);
    canvas.dataset.croppedImage = croppedImage.toDataURL('image/jpeg', 0.95);
    
    console.log('📸 Foto aufgenommen');
    
    isCapturing = false;
    
    // OCR automatisch starten
    performOCR();
}

/**
 * Bild auf Card-Frame-Bereich zuschneiden
 */
function cropToCardFrame(sourceCanvas) {
    const videoRect = video.getBoundingClientRect();
    const frameRect = cardFrame.getBoundingClientRect();
    
    // Skalierungsfaktor berechnen (Video-Element vs. tatsächliche Video-Auflösung)
    const scaleX = sourceCanvas.width / videoRect.width;
    const scaleY = sourceCanvas.height / videoRect.height;
    
    // Frame-Position relativ zum Video berechnen
    const frameX = (frameRect.left - videoRect.left) * scaleX;
    const frameY = (frameRect.top - videoRect.top) * scaleY;
    const frameWidth = frameRect.width * scaleX;
    const frameHeight = frameRect.height * scaleY;
    
    // Canvas für gecropptes Bild
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = frameWidth;
    croppedCanvas.height = frameHeight;
    
    const ctx = croppedCanvas.getContext('2d');
    
    // Ausschneiden
    ctx.drawImage(
        sourceCanvas,
        frameX, frameY, frameWidth, frameHeight,  // Source
        0, 0, frameWidth, frameHeight             // Destination
    );
    
    return croppedCanvas;
}

/**
 * Bild speichern (Download)
 */
function saveImage() {
    const link = document.createElement('a');
    link.download = `card-scan-${Date.now()}.jpg`;
    link.href = canvas.dataset.croppedImage || canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    console.log('💾 Bild gespeichert');
}

/**
 * Neue Aufnahme
 */
function retake() {
    previewContainer.classList.add('hidden');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    
    // OCR zurücksetzen
    hideOCRResult();
    hideOCRError();
    showOCRLoading(false);
    
    console.log('🔄 Neue Aufnahme');
}

/**
 * UI Hilfsfunktionen
 */
function showLoading(show) {
    loading.classList.toggle('hidden', !show);
}

function hideError() {
    cameraError.classList.add('hidden');
}

/**
 * Event Listener
 */
shutterBtn.addEventListener('click', capturePhoto);
retryBtn.addEventListener('click', initCamera);
retakeBtn.addEventListener('click', retake);
saveBtn.addEventListener('click', saveImage);

// Tastatur-Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && previewContainer.classList.contains('hidden')) {
        e.preventDefault();
        capturePhoto();
    }
    if (e.code === 'Escape' && !previewContainer.classList.contains('hidden')) {
        retake();
    }
});

// Touch-Events für bessere Mobile-Erfahrung
shutterBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shutterBtn.classList.add('active');
});

shutterBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    shutterBtn.classList.remove('active');
    capturePhoto();
});

/**
 * Tesseract.js Worker initialisieren
 */
async function initTesseract() {
    try {
        console.log('🔄 Initialisiere Tesseract.js...');
        
        if (!window.Tesseract) {
            console.error('❌ Tesseract.js nicht geladen');
            return;
        }
        
        tesseractWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`📖 OCR Fortschritt: ${(m.progress * 100).toFixed(1)}%`);
                }
            }
        });
        
        isTesseractReady = true;
        console.log('✅ Tesseract.js bereit (englisch)');
    } catch (error) {
        console.error('❌ Tesseract Initialisierungsfehler:', error);
        isTesseractReady = false;
    }
}

/**
 * OCR auf dem aufgenommenen Bild ausführen
 */
async function performOCR() {
    if (!isTesseractReady || !tesseractWorker) {
        console.warn('⚠️ Tesseract nicht bereit, überspringe OCR');
        showOCRError();
        return;
    }
    
    // Lade-Zustand anzeigen
    showOCRLoading(true);
    hideOCRResult();
    hideOCRError();
    
    try {
        // Canvas als Bild für OCR verwenden
        const canvas = document.getElementById('capture-canvas');
        
        console.log('🔍 Starte OCR...');
        const result = await tesseractWorker.recognize(canvas);
        
        console.log('✅ OCR abgeschlossen:', result);
        
        // Ergebnis anzeigen
        if (result.data && result.data.text && result.data.text.trim().length > 0) {
            showOCRResult(result.data.text, result.data.confidence);
        } else {
            showOCRError();
        }
    } catch (error) {
        console.error('❌ OCR Fehler:', error);
        showOCRError();
    } finally {
        showOCRLoading(false);
    }
}

/**
 * OCR Lade-Zustand anzeigen/verstecken
 */
function showOCRLoading(show) {
    ocrLoading.classList.toggle('hidden', !show);
}

/**
 * OCR Ergebnis anzeigen
 */
function showOCRResult(text, confidence) {
    ocrText.textContent = text.trim();
    
    // Confidence als Badge anzeigen
    const confidencePercent = Math.round(confidence);
    let confidenceClass = 'low';
    if (confidencePercent >= 80) confidenceClass = 'high';
    else if (confidencePercent >= 50) confidenceClass = 'medium';
    
    ocrConfidence.textContent = `${confidencePercent}%`;
    ocrConfidence.className = `confidence-badge ${confidenceClass}`;
    
    ocrResult.classList.remove('hidden');
}

/**
 * OCR Ergebnis verstecken
 */
function hideOCRResult() {
    ocrResult.classList.add('hidden');
    ocrText.textContent = '';
}

/**
 * OCR Fehler anzeigen
 */
function showOCRError() {
    ocrError.classList.remove('hidden');
}

/**
 * OCR Fehler verstecken
 */
function hideOCRError() {
    ocrError.classList.add('hidden');
}

/**
 * App initialisieren
 */
async function init() {
    console.log('🚀 Card Scanner v1 initialisiert');
    
    // Feature Detection
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        errorMessage.textContent = 'Dein Browser unterstützt die Kamera-API nicht. Bitte verwende einen modernen Browser (Chrome, Safari, Firefox).';
        cameraError.classList.remove('hidden');
        console.error('❌ getUserMedia nicht unterstützt');
        return;
    }
    
    // HTTPS Check (getUserMedia erfordert sicheren Kontext)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('⚠️ Kamera erfordert HTTPS oder localhost');
        errorMessage.textContent = 'Kamera-Zugriff erfordert eine sichere Verbindung (HTTPS). Bitte lade die Seite über HTTPS oder localhost.';
        cameraError.classList.remove('hidden');
        return;
    }
    
    // Tesseract parallel initialisieren
    initTesseract();
    
    // Kamera starten
    initCamera();
}

// App starten wenn DOM bereit
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Aufräumen beim Verlassen
window.addEventListener('beforeunload', stopCamera);
