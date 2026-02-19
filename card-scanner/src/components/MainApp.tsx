import React, { useState, useRef, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useOCR, OCRResult } from '../hooks/useOCR';
import { PreprocessingOptions } from '../utils/imagePreprocessing';
import './MainApp.css';

interface DebugInfo {
  rawText: string;
  cardNumber: string | null;
  cardName: string | null;
  confidence: number;
  matchedCard: string | null;
  processingTime: number;
}

export const MainApp: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [preprocessEnabled, setPreprocessEnabled] = useState(true);
  const [usePSMTesting, setUsePSMTesting] = useState(false);
  const [preprocessingOptions, setPreprocessingOptions] = useState<PreprocessingOptions>({
    contrast: 1.2,
    sharpen: 0.8,
    noiseReduction: false,
    binarize: false,
    threshold: 128
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingStartTime = useRef<number>(0);
  
  const {
    isProcessing,
    progress,
    result,
    error,
    recognize,
    rescan,
    reset
  } = useOCR({
    preprocess: preprocessEnabled,
    preprocessingOptions
  });

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setSelectedImage(imageData);
      setDebugInfo(null);
      reset();
    };
    reader.readAsDataURL(file);
  }, [reset]);

  /**
   * Direkt Kamera öffnen (skip Zwischenscreen)
   */
  const handleTakePhoto = useCallback(async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
        allowEditing: false,
        saveToGallery: false
      });

      if (photo.dataUrl) {
        setSelectedImage(photo.dataUrl);
        setDebugInfo(null);
        reset();
      }
    } catch (err) {
      console.error('Camera error:', err);
      // Benutzer hat abgebrochen oder Berechtigung verweigert
    }
  }, [reset]);

  const handleScan = useCallback(async () => {
    if (!selectedImage) return;

    processingStartTime.current = Date.now();
    const ocrResult = await recognize(selectedImage, undefined, usePSMTesting);

    if (ocrResult) {
      const processingTime = Date.now() - processingStartTime.current;

      // Simuliere Card Matching (in echter App würde hier gegen DB geprüft)
      const matchedCard = simulateCardMatching(ocrResult);

      setDebugInfo({
        rawText: ocrResult.rawText,
        cardNumber: ocrResult.cardNumber,
        cardName: ocrResult.cardName,
        confidence: ocrResult.confidence,
        matchedCard,
        processingTime
      });
    }
  }, [selectedImage, recognize, usePSMTesting]);

  const handleRescan = useCallback(async () => {
    processingStartTime.current = Date.now();
    const ocrResult = await rescan();
    
    if (ocrResult) {
      const processingTime = Date.now() - processingStartTime.current;
      const matchedCard = simulateCardMatching(ocrResult);
      
      setDebugInfo({
        rawText: ocrResult.rawText,
        cardNumber: ocrResult.cardNumber,
        cardName: ocrResult.cardName,
        confidence: ocrResult.confidence,
        matchedCard,
        processingTime
      });
    }
  }, [rescan]);

  const handleReset = useCallback(() => {
    setSelectedImage(null);
    setDebugInfo(null);
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [reset]);

  // Simuliert Card Matching (in echter App gegen Datenbank)
  const simulateCardMatching = (ocrResult: OCRResult): string | null => {
    if (ocrResult.cardNumber && ocrResult.cardName) {
      return `${ocrResult.cardName} (${ocrResult.cardNumber})`;
    } else if (ocrResult.cardNumber) {
      return `Karte #${ocrResult.cardNumber}`;
    } else if (ocrResult.cardName) {
      return ocrResult.cardName;
    }
    return null;
  };

  return (
    <div className="main-app">
      {/* Header */}
      <header className="app-header">
        <h1>🃏 Card Scanner</h1>
        <p className="subtitle">OCR mit Bildvorverarbeitung</p>
        
        {/* Debug Toggle */}
        <button
          className={`debug-toggle ${debugMode ? 'active' : ''}`}
          onClick={() => setDebugMode(!debugMode)}
          title="Debug-Modus umschalten"
        >
          🐛 Debug {debugMode ? 'AN' : 'AUS'}
        </button>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {/* Upload Section */}
        {!selectedImage && (
          <div className="upload-section">
            {/* Haupt-Button: Direkt Kamera */}
            <button className="camera-button" onClick={handleTakePhoto}>
              <span className="upload-icon">📷</span>
              <span>Tap to scan</span>
            </button>

            <div className="upload-divider">
              <span>oder</span>
            </div>

            {/* Sekundär: Datei auswählen */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden-input"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="upload-button secondary">
              <span className="upload-icon-small">🖼️</span>
              <span>Bild auswählen</span>
            </label>
          </div>
        )}

        {/* Image Preview & Controls */}
        {selectedImage && (
          <div className="scan-section">
            <div className="image-preview">
              <img src={selectedImage} alt="Zu scannende Karte" />
              
              {/* Preprocessing Preview (nur im Debug-Modus) */}
              {debugMode && result?.processedImageDataUrl && (
                <div className="processed-preview">
                  <h4>Vorverarbeitetes Bild</h4>
                  <img src={result.processedImageDataUrl} alt="Vorverarbeitet" />
                </div>
              )}
            </div>

            {/* Preprocessing Options */}
            <div className="options-panel">
              <h3>🔧 Optionen</h3>
              
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={preprocessEnabled}
                  onChange={(e) => setPreprocessEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                Bildvorverarbeitung
              </label>

              {debugMode && (
                <div className="advanced-options">
                  <label className="toggle-option">
                    <input
                      type="checkbox"
                      checked={usePSMTesting}
                      onChange={(e) => setUsePSMTesting(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    PSM-Modus Testing (langsamer)
                  </label>

                  {preprocessEnabled && (
                    <>
                      <div className="slider-group">
                        <label>Kontrast: {preprocessingOptions.contrast?.toFixed(1)}</label>
                        <input
                          type="range"
                          min="0.5"
                          max="3.0"
                          step="0.1"
                          value={preprocessingOptions.contrast}
                          onChange={(e) => setPreprocessingOptions(prev => ({
                            ...prev,
                            contrast: parseFloat(e.target.value)
                          }))}
                        />
                      </div>

                      <div className="slider-group">
                        <label>Schärfen: {preprocessingOptions.sharpen?.toFixed(1)}</label>
                        <input
                          type="range"
                          min="0"
                          max="2.0"
                          step="0.1"
                          value={preprocessingOptions.sharpen}
                          onChange={(e) => setPreprocessingOptions(prev => ({
                            ...prev,
                            sharpen: parseFloat(e.target.value)
                          }))}
                        />
                      </div>

                      <label className="toggle-option">
                        <input
                          type="checkbox"
                          checked={preprocessingOptions.binarize}
                          onChange={(e) => setPreprocessingOptions(prev => ({
                            ...prev,
                            binarize: e.target.checked
                          }))}
                        />
                        <span className="toggle-slider"></span>
                        Binarisierung (Schwarz/Weiß)
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={handleScan}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Verarbeite...' : '🔍 OCR starten'}
              </button>
              
              {result && (
                <button
                  className="btn btn-secondary"
                  onClick={handleRescan}
                  disabled={isProcessing}
                >
                  🔄 Re-scan
                </button>
              )}
              
              <button
                className="btn btn-outline"
                onClick={handleReset}
                disabled={isProcessing}
              >
                🗑️ Neues Bild
              </button>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {progress.status} ({progress.progress}%)
                </span>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="error-message">
                ❌ Fehler: {error}
              </div>
            )}

            {/* OCR Result */}
            {result && !debugMode && (
              <div className="result-section">
                <h3>📝 Ergebnis</h3>
                <div className="result-content">
                  {result.cardName && (
                    <div className="result-item">
                      <span className="label">Name:</span>
                      <span className="value">{result.cardName}</span>
                    </div>
                  )}
                  {result.cardNumber && (
                    <div className="result-item">
                      <span className="label">Nummer:</span>
                      <span className="value">{result.cardNumber}</span>
                    </div>
                  )}
                  <div className="result-item">
                    <span className="label">Confidence:</span>
                    <span className={`value confidence ${result.confidence > 80 ? 'high' : result.confidence > 50 ? 'medium' : 'low'}`}>
                      {result.confidence}%
                    </span>
                  </div>
                </div>
                <textarea
                  className="result-text"
                  readOnly
                  value={result.rawText}
                  rows={6}
                />
              </div>
            )}

            {/* Debug View */}
            {debugMode && debugInfo && (
              <div className="debug-view">
                <h3>🐛 Debug-Informationen</h3>
                
                <div className="debug-grid">
                  {/* Roher OCR-Text */}
                  <div className="debug-card">
                    <h4>📄 Roher OCR-Text</h4>
                    <pre className="debug-text">{debugInfo.rawText || '(Kein Text erkannt)'}</pre>
                  </div>

                  {/* Extrahierte Daten */}
                  <div className="debug-card">
                    <h4>🔍 Extrahierte Daten</h4>
                    <div className="debug-data">
                      <div className="data-row">
                        <span className="data-label">Karten-Nummer:</span>
                        <span className="data-value">
                          {debugInfo.cardNumber || '—'}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Karten-Name:</span>
                        <span className="data-value">
                          {debugInfo.cardName || '—'}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Confidence:</span>
                        <span className={`data-value confidence ${debugInfo.confidence > 80 ? 'high' : debugInfo.confidence > 50 ? 'medium' : 'low'}`}>
                          {debugInfo.confidence}%
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Verarbeitungszeit:</span>
                        <span className="data-value">{debugInfo.processingTime}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Matching-Ergebnis */}
                  <div className="debug-card">
                    <h4>✅ Matching-Ergebnis</h4>
                    <div className="matching-result">
                      {debugInfo.matchedCard ? (
                        <>
                          <span className="match-found">✓ Karte gefunden</span>
                          <span className="match-name">{debugInfo.matchedCard}</span>
                        </>
                      ) : (
                        <span className="match-not-found">✗ Keine Karte erkannt</span>
                      )}
                    </div>
                  </div>

                  {/* Confidence Details */}
                  <div className="debug-card">
                    <h4>📊 Confidence Details</h4>
                    {result?.words && result.words.length > 0 ? (
                      <div className="words-list">
                        {result.words.slice(0, 20).map((word, idx) => (
                          <div
                            key={idx}
                            className={`word-item ${word.confidence > 80 ? 'high' : word.confidence > 50 ? 'medium' : 'low'}`}
                          >
                            <span className="word-text">"{word.text}"</span>
                            <span className="word-confidence">{Math.round(word.confidence)}%</span>
                          </div>
                        ))}
                        {result.words.length > 20 && (
                          <div className="word-more">
                            ...und {result.words.length - 20} weitere Wörter
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="no-words">Keine Wörter erkannt</p>
                    )}
                  </div>
                </div>

                {/* Re-scan Button im Debug Mode */}
                <div className="debug-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleRescan}
                    disabled={isProcessing}
                  >
                    🔄 Re-scan mit gleichem Bild
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Card Scanner v2.0 • Mit Tesseract.js & Bildvorverarbeitung</p>
      </footer>
    </div>
  );
};
