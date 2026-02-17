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
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

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
 * Bild vorverarbeiten für besseres OCR (Grayscale + Kontrast)
 */
function preprocessImage(sourceCanvas) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');

    // Original zeichnen
    ctx.drawImage(sourceCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Grayscale + Kontrast erhöhen
    for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Kontrast erhöhen (factor 1.5)
        const contrast = 1.5;
        const adjusted = ((gray - 128) * contrast) + 128;

        // Clamp
        const value = Math.max(0, Math.min(255, adjusted));

        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        // Alpha bleibt
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
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
copyBtn.addEventListener('click', copyOCRToClipboard);
downloadBtn.addEventListener('click', saveImage);

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

        // Tesseract Parameter optimieren
        await tesseractWorker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -\'",.():;/—!',
            tessedit_pageseg_mode: '6'
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

        // Bild vorverarbeiten für besseres OCR
        const processedCanvas = preprocessImage(canvas);

        console.log('🔍 Starte OCR...');
        const result = await tesseractWorker.recognize(processedCanvas);
        
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
    
    // "Karte identifizieren" Button anzeigen
    const identifyContainer = document.getElementById('card-identify-container');
    if (identifyContainer) {
        identifyContainer.classList.remove('hidden');
        
        // Event-Listener für den Button hinzufügen
        const btn = document.getElementById('identify-btn');
        if (btn && !btn.dataset.hasListener) {
            btn.addEventListener('click', identifyCard);
            btn.dataset.hasListener = 'true';
            console.log('✅ Identify-Button sichtbar + Event-Listener hinzugefügt');
        }
    } else {
        console.warn('❌ card-identify-container nicht gefunden');
    }
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
 * OCR Text in Zwischenablage kopieren
 * Mit Fallback für iOS Safari
 */
async function copyOCRToClipboard() {
    const text = ocrText.textContent;
    if (!text || text.trim().length === 0) return;
    
    const copyBtn = document.getElementById('copy-btn');
    const copyText = document.getElementById('copy-text');
    const copyFeedback = document.getElementById('copy-feedback');
    
    try {
        // Versuche Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showCopySuccess(copyBtn, copyText, copyFeedback);
        } else {
            // Fallback für iOS Safari: Text selektieren
            selectAndCopyText(text);
        }
    } catch (err) {
        console.warn('Clipboard API fehlgeschlagen, verwende Fallback:', err);
        // Fallback: Text selektieren
        selectAndCopyText(text);
    }
}

/**
 * Zeigt Erfolgsanimation für Copy-Button
 */
function showCopySuccess(copyBtn, copyText, copyFeedback) {
    // Button-Text ändern
    const originalText = copyText.textContent;
    copyText.textContent = 'Kopiert!';
    copyBtn.classList.add('copied');
    
    // Feedback-Text anzeigen
    copyFeedback.classList.add('show');
    
    // Nach 2 Sekunden zurücksetzen
    setTimeout(() => {
        copyText.textContent = originalText;
        copyBtn.classList.remove('copied');
        copyFeedback.classList.remove('show');
    }, 2000);
    
    console.log('📋 OCR Text kopiert');
}

/**
 * Fallback: Text selektieren und native Share Sheet nutzen
 */
function selectAndCopyText(text) {
    // Erstelle temporäres Textarea-Element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    
    // Selektiere den Text
    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    
    // Versuche execCommand (ältere iOS Versionen)
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.warn('execCommand copy fehlgeschlagen:', err);
    }
    
    document.body.removeChild(textarea);
    
    const copyBtn = document.getElementById('copy-btn');
    const copyText = document.getElementById('copy-text');
    const copyFeedback = document.getElementById('copy-feedback');
    
    if (success) {
        showCopySuccess(copyBtn, copyText, copyFeedback);
    } else {
        // Letzter Fallback: Native Share API
        if (navigator.share) {
            navigator.share({
                title: 'Erkannter Text',
                text: text
            }).then(() => {
                showCopySuccess(copyBtn, copyText, copyFeedback);
            }).catch(() => {
                // Teilen abgebrochen oder fehlgeschlagen
                copyText.textContent = 'Fehlgeschlagen';
                setTimeout(() => {
                    copyText.textContent = 'Kopieren';
                }, 2000);
            });
        } else {
            copyText.textContent = 'Fehlgeschlagen';
            setTimeout(() => {
                copyText.textContent = 'Kopieren';
            }, 2000);
        }
    }
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
    
    // Kartendatenbank laden (im Hintergrund)
    loadCardDatabase().catch(err => console.warn('DB-Laden fehlgeschlagen:', err));
}

// App starten wenn DOM bereit
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ==================== KARTENDATENBANK INTEGRATION ====================

// Kartendatenbank
let cardDatabase = [];
let currentSearchResults = [];
let currentResultIndex = 0;

// DOM Elemente für Card Identification
let identifyBtn = null;
let cardResultOverlay = document.getElementById('card-result-overlay');

/**
 * Kartendatenbank laden
 */
async function loadCardDatabase() {
    try {
        console.log('🔄 Lade Kartendatenbank...');
        const response = await fetch('data/cards.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        cardDatabase = await response.json();
        console.log(`✅ ${cardDatabase.length} Karten geladen`);
        return true;
    } catch (error) {
        console.error('❌ Fehler beim Laden der Kartendatenbank:', error);
        return false;
    }
}

/**
 * MULTI-FAKTOR-EXTRACTION - Extrahiert alle Merkmale aus OCR-Text
 */

/**
 * Kartennummer aus OCR-Text extrahieren (40% Gewichtung)
 * Patterns: "170/298", "OGN-170", "OGN 170/298", "170"
 */
function extractCardNumber(ocrText) {
    if (!ocrText) return null;
    
    // Pattern 1: "170/298" oder "170 / 298" -> extrahiere 170
    const slashMatch = ocrText.match(/(\d{1,3})\s*\/\s*\d{1,3}/);
    if (slashMatch) {
        return slashMatch[1].replace(/^0+/, ''); // Führende Nullen entfernen
    }
    
    // Pattern 2: "OGN-170" oder "OGN 170" -> extrahiere 170
    const setMatch = ocrText.match(/[A-Z]{2,3}[-\s]?(\d{1,3})/i);
    if (setMatch) {
        return setMatch[1].replace(/^0+/, '');
    }
    
    // Pattern 3: Einfach eine 1-3 stellige Zahl
    const numberMatch = ocrText.match(/\b(\d{1,3})\b/);
    if (numberMatch) {
        return numberMatch[1].replace(/^0+/, '');
    }
    
    return null;
}

/**
 * Kartentitel aus OCR-Text extrahieren (40% Gewichtung)
 * Erste saubere Zeile ohne Sonderzeichen
 */
function extractCardTitle(ocrText) {
    if (!ocrText) return null;
    
    // Text in Zeilen aufteilen
    const lines = ocrText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    // Kandidaten sammeln und bewerten
    const candidates = [];
    
    for (const line of lines) {
        // Überspringe Zeilen mit nur Zahlen, Slashes oder bekannten Set-Codes
        if (/^\d+$/.test(line)) continue;
        if (/^\d+\s*\/\s*\d+$/.test(line)) continue;
        if (/^[A-Z]{2,3}[-\s]?\d+$/i.test(line)) continue;
        if (/^(Spell|Unit|Gear|Legend|Battlefield|Champion|Action|Reaction|Play|Return|When|Each|You may)$/i.test(line)) continue;
        
        // Bereinige die Zeile
        let cleaned = line
            .replace(/[^\w\s\-'\.]/g, '')
            .trim();
        
        if (cleaned.length >= 2) {
            // Bewertung: Länge + Großbuchstaben am Anfang
            let score = cleaned.length;
            if (/^[A-Z]/.test(cleaned)) score += 10; // Bonus für Großbuchstabe am Anfang
            if (cleaned.split(/\s+/).length >= 2) score += 5; // Bonus für mehrere Wörter
            
            candidates.push({ text: cleaned, score: score });
        }
    }
    
    // Sortiere nach Score (höchste zuerst)
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates.length > 0 ? candidates[0].text : null;
}

/**
 * Set-Code oder Set-Name aus OCR-Text extrahieren (15% Gewichtung)
 */
function extractSetInfo(ocrText) {
    if (!ocrText) return { code: null, name: null };
    
    // Set-Codes: OGN, SFD, OGS
    const codeMatch = ocrText.match(/\b(OGN|SFD|OGS)\b/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : null;
    
    // Set-Namen: Origins, Spiritforged, Proving Grounds
    const namePatterns = [
        { pattern: /\bOrigins\b/i, name: 'Origins' },
        { pattern: /\bSpiritforged\b/i, name: 'Spiritforged' },
        { pattern: /\bProving Grounds\b/i, name: 'Proving Grounds' }
    ];
    
    for (const { pattern, name } of namePatterns) {
        if (pattern.test(ocrText)) {
            return { code, name };
        }
    }
    
    return { code, name: null };
}

/**
 * Kartentyp aus OCR-Text extrahieren (5% Gewichtung)
 */
function extractCardType(ocrText) {
    if (!ocrText) return null;
    
    const types = ['Spell', 'Unit', 'Gear', 'Legend', 'Battlefield', 'Champion'];
    const textLower = ocrText.toLowerCase();
    
    for (const type of types) {
        if (textLower.includes(type.toLowerCase())) {
            return type;
        }
    }
    
    return null;
}

/**
 * Ähnlichkeit zwischen zwei Strings berechnen (Levenshtein-Distanz)
 */
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().replace(/[^\w]/g, '');
    const s2 = str2.toLowerCase().replace(/[^\w]/g, '');
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    // Levenshtein-Distanz
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            const cost = s2[i - 1] === s1[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
}

/**
 * Fuzzy-Match: Berechnet Ähnlichkeit zwischen zwei Strings
 * Verwendet Levenshtein-Distanz für Fuzzy-Matching
 */
function fuzzyMatch(query, target, threshold = 0.5) {
    if (!query || !target) return { matches: false, score: 0 };
    
    const q = query.toLowerCase().replace(/[^\w]/g, '');
    const t = target.toLowerCase().replace(/[^\w]/g, '');
    
    if (q === t) return { matches: true, score: 1.0 };
    if (q.length === 0 || t.length === 0) return { matches: false, score: 0 };
    
    // Levenshtein-Distanz
    const matrix = [];
    for (let i = 0; i <= t.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= q.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= t.length; i++) {
        for (let j = 1; j <= q.length; j++) {
            const cost = t[i - 1] === q[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    
    const distance = matrix[t.length][q.length];
    const maxLength = Math.max(q.length, t.length);
    const similarity = 1 - distance / maxLength;
    
    return {
        matches: similarity >= threshold,
        score: similarity
    };
}

/**
 * INTELLIGENTE KEYWORD-BASIERTE SUCHE
 * 
 * Extrahiert alle relevanten Keywords aus OCR und matched gegen alle DB-Felder:
 * - Kartentitel (hohe Gewichtung)
 * - Flavor-Text-Zitate
 * - Effekt-Keywords
 * - Kartennummer
 * - Set-Code/Name
 * - Kartentyp
 * - Künstlername
 * 
 * Gibt Top-5 Treffer zurück mit detaillierten Match-Informationen
 */

/**
 * Extrahiert alle relevanten Keywords aus OCR-Text
 */
function extractAllKeywords(ocrText) {
    if (!ocrText) return [];
    
    const keywords = [];
    const lines = ocrText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    // 1. Kartentitel-Kandidaten (2-5 Wörter, Großbuchstaben)
    for (const line of lines) {
        const words = line.split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2 && words.length <= 6 && /^[A-Z]/.test(line)) {
            // Bereinigen
            const cleaned = line.replace(/[^\w\s\-'\.]/g, '').trim();
            if (cleaned.length >= 4 && !/^(Play|Return|When|Each|You|Action|Reaction|Spell|Unit)$/i.test(cleaned)) {
                keywords.push({
                    text: cleaned,
                    type: 'title',
                    weight: 50,
                    source: line
                });
            }
        }
    }
    
    // 2. Flavor-Text-Zitate (in Anführungszeichen oder nach —)
    const flavorMatch = ocrText.match(/["""]([^"""]+)["""]/g);
    if (flavorMatch) {
        flavorMatch.forEach(quote => {
            const cleaned = quote.replace(/["""]/g, '').trim();
            if (cleaned.length > 5) {
                keywords.push({
                    text: cleaned,
                    type: 'flavor',
                    weight: 30,
                    source: quote
                });
            }
        });
    }
    
    // 3. Charakter-Namen (nach — oder am Ende von Flavor)
    const charMatch = ocrText.match(/—\s*([A-Za-z\s\.]+?)(?:\n|$)/);
    if (charMatch) {
        const name = charMatch[1].trim();
        if (name.length > 2 && name.length < 30) {
            keywords.push({
                text: name,
                type: 'character',
                weight: 25,
                source: charMatch[0]
            });
        }
    }
    
    // 4. Kartennummer (XXX/YYY oder OGN-170)
    const numMatch = ocrText.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (numMatch) {
        keywords.push({
            text: numMatch[1],
            fullNumber: `${numMatch[1]}/${numMatch[2]}`,
            type: 'number',
            weight: 40,
            source: numMatch[0]
        });
    }
    
    // Set-Code (OGN, SFD, OGS)
    const setMatch = ocrText.match(/\b(OGN|SFD|OGS)\b/i);
    if (setMatch) {
        keywords.push({
            text: setMatch[1].toUpperCase(),
            type: 'setcode',
            weight: 20,
            source: setMatch[0]
        });
    }
    
    // 5. Kartentyp
    const typeMatch = ocrText.match(/\b(Spell|Unit|Gear|Champion|Legend|Action|Reaction)\b/i);
    if (typeMatch) {
        keywords.push({
            text: typeMatch[1],
            type: 'cardtype',
            weight: 10,
            source: typeMatch[0]
        });
    }
    
    // 6. Effekt-Keywords (Action, Reaction, buff, conquer, etc.)
    const effectKeywords = ['Action', 'Reaction', 'conquer', 'buff', 'kill', 'destroy', 'return', 'draw', 'discard'];
    for (const kw of effectKeywords) {
        if (ocrText.toLowerCase().includes(kw.toLowerCase())) {
            keywords.push({
                text: kw,
                type: 'effect',
                weight: 15,
                source: kw
            });
        }
    }
    
    // 7. Alle Zeilen als potentielle Titel (mit niedrigerer Gewichtung)
    for (const line of lines) {
        if (line.length > 3 && line.length < 50) {
            const alreadyExists = keywords.some(k => 
                k.source === line || 
                (k.type === 'title' && k.text.includes(line))
            );
            if (!alreadyExists) {
                keywords.push({
                    text: line.replace(/[^\w\s\-'\.]/g, '').trim(),
                    type: 'text',
                    weight: 5,
                    source: line
                });
            }
        }
    }
    
    console.log('🔑 Extrahierte Keywords:', keywords.map(k => `${k.text} (${k.type}, ${k.weight})`));
    return keywords;
}

/**
 * Sucht in allen Feldern einer Karte nach Keywords
 */
function searchCardFields(card, keyword) {
    const matches = [];
    const searchFields = [
        { field: 'name', weight: 1.0 },
        { field: 'flavor', weight: 0.9 },
        { field: 'effect', weight: 0.8 },
        { field: 'type', weight: 0.6 },
        { field: 'set_name', weight: 0.5 },
        { field: 'id', weight: 0.7 }
    ];
    
    for (const { field, weight } of searchFields) {
        if (!card[field]) continue;
        
        const fieldValue = String(card[field]).toLowerCase();
        const keywordLower = keyword.text.toLowerCase();
        
        // Exakter Match
        if (fieldValue === keywordLower) {
            matches.push({ field, score: 1.0 * weight, exact: true });
        }
        // Enthält Match
        else if (fieldValue.includes(keywordLower)) {
            matches.push({ field, score: 0.8 * weight, exact: false });
        }
        // Fuzzy Match
        else {
            const fuzzy = fuzzyMatch(keyword.text, card[field], 0.6);
            if (fuzzy.matches) {
                matches.push({ field, score: fuzzy.score * 0.6 * weight, exact: false, fuzzy: true });
            }
        }
    }
    
    return matches;
}

/**
 * INTELLIGENTE KEYWORD-SUCHE
 * 
 * Hauptfunktion die alle Keywords extrahiert und gegen die DB matched
 */
function findCardMultiFactor(ocrText) {
    if (!cardDatabase.length) {
        console.warn('⚠️ Kartendatenbank nicht geladen');
        return [];
    }
    
    // Alle Keywords extrahieren
    const keywords = extractAllKeywords(ocrText);
    
    if (keywords.length === 0) {
        console.warn('⚠️ Keine Keywords extrahiert');
        return [];
    }
    
    console.log(`🔍 Suche mit ${keywords.length} Keywords in ${cardDatabase.length} Karten...`);
    
    const results = [];
    
    // Jede Karte bewerten
    for (const card of cardDatabase) {
        let totalScore = 0;
        const matchedKeywords = [];
        
        for (const keyword of keywords) {
            const fieldMatches = searchCardFields(card, keyword);
            
            if (fieldMatches.length > 0) {
                // Besten Match für dieses Keyword nehmen
                const bestMatch = fieldMatches.reduce((a, b) => a.score > b.score ? a : b);
                const keywordScore = bestMatch.score * keyword.weight;
                
                totalScore += keywordScore;
                matchedKeywords.push({
                    keyword: keyword.text,
                    type: keyword.type,
                    field: bestMatch.field,
                    score: keywordScore
                });
            }
        }
        
        // Nur Karten mit relevantem Score behalten
        if (totalScore > 15) {
            results.push({
                card: card,
                score: totalScore,
                matchPercent: Math.min(Math.round(totalScore), 100),
                matchedKeywords: matchedKeywords.sort((a, b) => b.score - a.score).slice(0, 5)
            });
        }
    }
    
    // Nach Score sortieren
    results.sort((a, b) => b.score - a.score);
    
    console.log(`✅ ${results.length} Treffer gefunden`);
    if (results.length > 0) {
        console.log('🏆 Top-Treffer:', results[0].card.name, `(${results[0].matchPercent}%)`);
    }
    
    // Top-5 zurückgeben
    return results.slice(0, 5);
}

/**
 * UI für Karten-Identification erstellen (Multi-Faktor mit Top-3)
 */
function createCardIdentificationUI() {
    // Button in OCR-Result-Bereich einfügen
    const ocrActions = document.querySelector('.preview-actions');
    if (!ocrActions || document.getElementById('identify-btn')) return;
    
    identifyBtn = document.createElement('button');
    identifyBtn.id = 'identify-btn';
    identifyBtn.className = 'btn btn-primary';
    identifyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Karte identifizieren</span>
    `;
    identifyBtn.addEventListener('click', identifyCard);
    
    ocrActions.insertBefore(identifyBtn, ocrActions.firstChild);
    
    // Overlay für Ergebnis erstellen
    cardResultOverlay = document.createElement('div');
    cardResultOverlay.id = 'card-result-overlay';
    cardResultOverlay.className = 'card-overlay hidden';
    cardResultOverlay.innerHTML = `
        <div class="card-overlay-content">
            <button class="card-overlay-close" aria-label="Schließen">&times;</button>
            
            <h3 class="card-result-title">🔍 Gefundene Karten</h3>
            
            <!-- Haupt-Treffer -->
            <div class="card-main-result">
                <div class="card-result-image">
                    <img id="result-card-image" src="" alt="Gefundene Karte">
                </div>
                <div class="card-result-info">
                    <h3 id="result-card-name"></h3>
                    <p class="card-result-set" id="result-card-set"></p>
                    <p class="card-result-number" id="result-card-number"></p>
                    <p class="card-result-price" id="result-card-price"></p>
                    <div class="match-score" id="result-match-score">
                        <span class="match-percent"></span>
                        <div class="match-bar"><div class="match-fill"></div></div>
                    </div>
                    <div class="match-breakdown" id="match-breakdown"></div>
                </div>
            </div>
            
            <!-- Alternative Treffer (Top 2+3) -->
            <div class="card-alternatives" id="card-alternatives"></div>
            
            <div class="card-result-actions">
                <button id="save-card-btn" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Das ist es!</span>
                </button>
                <button id="next-match-btn" class="btn btn-secondary hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    <span>Nächster Treffer</span>
                </button>
            </div>
            
            <div class="card-result-counter hidden" id="result-counter"></div>
        </div>
    `;
    
    document.body.appendChild(cardResultOverlay);
    
    // Event Listener für Overlay
    cardResultOverlay.querySelector('.card-overlay-close').addEventListener('click', hideCardResult);
    cardResultOverlay.addEventListener('click', (e) => {
        if (e.target === cardResultOverlay) hideCardResult();
    });
    
    document.getElementById('save-card-btn').addEventListener('click', saveIdentifiedCard);
    document.getElementById('next-match-btn').addEventListener('click', showNextMatch);
}

/**
 * Karte identifizieren basierend auf OCR-Text
 * Verwendet Multi-Faktor-Fuzzy-Suche
 */
function identifyCard() {
    const text = ocrText.textContent;
    if (!text || text.trim().length === 0) {
        console.warn('⚠️ Kein OCR-Text vorhanden');
        return;
    }
    
    console.log('🔍 Identifiziere Karte aus OCR-Text...');
    console.log('OCR Text:', text);
    
    // Multi-Faktor-Suche durchführen
    currentSearchResults = findCardMultiFactor(text);
    currentResultIndex = 0;
    
    if (currentSearchResults.length === 0) {
        alert('Keine passende Karte gefunden. Versuche es mit besserer Beleuchtung oder halte die Karte gerade.');
        return;
    }
    
    console.log(`✅ ${currentSearchResults.length} Treffer gefunden`);
    
    // Ergebnis anzeigen
    showCardResult();
}

/**
 * Karten-Ergebnis anzeigen mit Top-3 Treffern
 */
function showCardResult() {
    if (currentSearchResults.length === 0) return;
    
    const result = currentSearchResults[currentResultIndex];
    const card = result.card;
    
    // Haupt-Treffer anzeigen
    const img = document.getElementById('result-card-image');
    if (!img) {
        console.error('❌ result-card-image nicht gefunden');
        return;
    }
    img.src = card.image;
    img.alt = card.name;
    
    const nameEl = document.getElementById('result-card-name');
    const setEl = document.getElementById('result-card-set');
    const numberEl = document.getElementById('result-card-number');
    
    if (nameEl) nameEl.textContent = card.name;
    if (setEl) setEl.textContent = card.set_name;
    if (numberEl) numberEl.textContent = `ID: ${card.id}`;
    
    const priceEl = document.getElementById('result-card-price');
    if (card.price > 0) {
        priceEl.textContent = `Preis: $${card.price.toFixed(2)}`;
        priceEl.classList.remove('hidden');
    } else {
        priceEl.classList.add('hidden');
    }
    
    // Match-Score anzeigen
    const scoreEl = document.getElementById('result-match-score');
    scoreEl.querySelector('.match-percent').textContent = `${result.matchPercent}% Match`;
    scoreEl.querySelector('.match-fill').style.width = `${result.matchPercent}%`;
    
    // Match-Breakdown mit Keywords
    const breakdownEl = document.getElementById('match-breakdown');
    if (result.matchedKeywords && result.matchedKeywords.length > 0) {
        const topKeywords = result.matchedKeywords.slice(0, 4);
        breakdownEl.innerHTML = topKeywords.map(k => 
            `<span class="match-tag" title="Gefunden in: ${k.field}">${k.keyword} (${Math.round(k.score)})</span>`
        ).join(' ');
    } else {
        breakdownEl.innerHTML = 'Keine Details';
    }
    
    // Alternative Treffer anzeigen (Top 2+3)
    const alternativesEl = document.getElementById('card-alternatives');
    alternativesEl.innerHTML = '';
    
    if (currentSearchResults.length > 1) {
        const alternatives = currentSearchResults.filter((_, i) => i !== currentResultIndex).slice(0, 2);
        
        alternatives.forEach((alt, idx) => {
            const altCard = alt.card;
            const altEl = document.createElement('div');
            altEl.className = 'card-alternative-item';
            altEl.innerHTML = `
                <img src="${altCard.image}" alt="${altCard.name}" loading="lazy">
                <div class="alt-info">
                    <span class="alt-name">${altCard.name}</span>
                    <span class="alt-match">${alt.matchPercent}% Match</span>
                </div>
            `;
            altEl.addEventListener('click', () => {
                // Finde den richtigen Index
                const realIndex = currentSearchResults.findIndex(r => r.card.id === altCard.id);
                currentResultIndex = realIndex;
                showCardResult();
            });
            alternativesEl.appendChild(altEl);
        });
        
        alternativesEl.classList.remove('hidden');
    } else {
        alternativesEl.classList.add('hidden');
    }
    
    // Counter anzeigen wenn mehrere Treffer
    const counterEl = document.getElementById('result-counter');
    const nextBtn = document.getElementById('next-match-btn');
    
    if (currentSearchResults.length > 1) {
        counterEl.textContent = `${currentResultIndex + 1} / ${currentSearchResults.length}`;
        counterEl.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
    } else {
        counterEl.classList.add('hidden');
        nextBtn.classList.add('hidden');
    }
    
    // Overlay anzeigen
    cardResultOverlay.classList.remove('hidden');
}

/**
 * Nächsten Treffer anzeigen
 */
function showNextMatch() {
    currentResultIndex = (currentResultIndex + 1) % currentSearchResults.length;
    showCardResult();
}

/**
 * Ergebnis-Overlay ausblenden
 */
function hideCardResult() {
    cardResultOverlay.classList.add('hidden');
}

/**
 * Identifizierte Karte speichern
 */
function saveIdentifiedCard() {
    if (currentSearchResults.length === 0) return;
    
    const result = currentSearchResults[currentResultIndex];
    const card = result.card;
    
    // Hier könnte die Speicherlogik implementiert werden
    // Z.B. in localStorage oder an einen Server senden
    
    const savedCards = JSON.parse(localStorage.getItem('cardscanner-saved') || '[]');
    savedCards.push({
        ...card,
        scannedAt: new Date().toISOString(),
        ocrText: ocrText.textContent
    });
    localStorage.setItem('cardscanner-saved', JSON.stringify(savedCards));
    
    // Feedback
    const btn = document.getElementById('save-card-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Gespeichert!</span>
    `;
    btn.classList.add('saved');
    
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('saved');
        hideCardResult();
    }, 1500);
    
    console.log('💾 Karte gespeichert:', card.name);
}

// ==================== APP START ====================
// App wird über init() gestartet (siehe oben)

// Event-Listener für statische Overlay-Buttons
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-overlay');
    const saveBtn = document.getElementById('save-card-btn');
    const nextBtn = document.getElementById('next-match-btn');
    
    if (closeBtn) closeBtn.addEventListener('click', hideCardResult);
    if (saveBtn) saveBtn.addEventListener('click', saveIdentifiedCard);
    if (nextBtn) nextBtn.addEventListener('click', showNextMatch);
});

// Aufräumen beim Verlassen
window.addEventListener('beforeunload', stopCamera);
