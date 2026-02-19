import { useState, useCallback, useRef } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { preprocessImage, PreprocessingOptions, extractCardNumber, extractCardName, calculateConfidence } from '../utils/imagePreprocessing';

export interface OCRWord {
  text: string;
  confidence: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null;
}

export interface OCRResult {
  rawText: string;
  cardNumber: string | null;
  cardName: string | null;
  confidence: number;
  words: OCRWord[];
  processedImageDataUrl: string | null;
}

export interface OCRProgress {
  status: string;
  progress: number;
}

export interface UseOCROptions {
  language?: string;
  preprocess?: boolean;
  preprocessingOptions?: PreprocessingOptions;
}

const DEFAULT_OPTIONS: UseOCROptions = {
  language: 'deu+eng',
  preprocess: true,
  preprocessingOptions: {
    contrast: 1.2,
    sharpen: 0.8,
    noiseReduction: false,
    binarize: false
  }
};

export function useOCR(options: UseOCROptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OCRProgress>({ status: '', progress: 0 });
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const lastImageRef = useRef<string | null>(null);

  /**
   * Initialisiert den Tesseract Worker mit optimierten Einstellungen
   */
  const initWorker = useCallback(async (): Promise<Worker> => {
    if (workerRef.current) {
      return workerRef.current;
    }
    
    // Worker mit 2 Threads für bessere Performance
    const worker = await createWorker(opts.language || 'deu+eng', 2);
    
    // OCR-Parameter optimiert für TCG-Karten
    await worker.setParameters({
      tessedit_pageseg_mode: '3', // PSM_AUTO - automatische Segmentierung (besser für Karten)
      tessedit_ocr_engine_mode: '3', // LSTM only (OEM_LSTM_ONLY)
      // Erweiterte Whitelist für TCG-spezifische Zeichen
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,;:!?()-_/\'"&@#$%*+=°©®™♀♂♠♣♥♦[]{}',
      // Höhere Qualität
      tessjs_create_tsv: '1',
      tessjs_create_box: '1',
      // Bessere Erkennung von kleinem Text
      textord_min_xheight: '8',
      textord_max_xheight: '40',
    });
    
    workerRef.current = worker;
    return worker;
  }, [opts.language]);

  /**
   * Testet verschiedene PSM-Modi und gibt das beste Ergebnis zurück
   */
  const testPSMModes = useCallback(async (
    imageDataUrl: string
  ): Promise<{ result: OCRResult | null; bestMode: string }> => {
    const psmModes = ['3', '1', '6', '11', '12'];
    let bestResult: OCRResult | null = null;
    let bestMode = '3';
    let bestScore = 0;
    
    for (const psm of psmModes) {
      try {
        const testWorker = await createWorker(opts.language || 'deu+eng', 1);
        await testWorker.setParameters({
          tessedit_pageseg_mode: psm,
          tessedit_ocr_engine_mode: '3',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,;:!?()-_/\'"&@#$%*+=°©®™',
        });
        
        const ocrResult = await testWorker.recognize(imageDataUrl);
        await testWorker.terminate();
        
        // Scoring: Confidence + Anzahl erkannter Wörter + Kartennummer gefunden
        const words = ocrResult.data.words || [];
        const hasCardNumber = /\d{1,3}\s*\/\s*\d{1,3}/.test(ocrResult.data.text);
        const score = (words.reduce((sum, w) => sum + w.confidence, 0) / (words.length || 1)) 
                      + (words.length * 2) 
                      + (hasCardNumber ? 50 : 0);
        
        if (score > bestScore) {
          bestScore = score;
          bestMode = psm;
          bestResult = {
            rawText: ocrResult.data.text,
            cardNumber: extractCardNumber(ocrResult.data.text),
            cardName: extractCardName(ocrResult.data.text),
            confidence: words.length > 0 ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length : 0,
            words: words.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })),
            processedImageDataUrl: null
          };
        }
      } catch (e) {
        console.warn(`PSM Mode ${psm} failed:`, e);
      }
    }
    
    return { result: bestResult, bestMode };
  }, [opts.language]);

  /**
   * Beendet den Worker
   */
  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  /**
   * Führt OCR auf einem Bild durch
   */
  const recognize = useCallback(async (
    imageDataUrl: string,
    customOptions?: Partial<UseOCROptions>,
    usePSMTesting: boolean = false
  ): Promise<OCRResult | null> => {
    const currentOpts = { ...opts, ...customOptions };
    lastImageRef.current = imageDataUrl;
    
    setIsProcessing(true);
    setProgress({ status: 'Initialisiere...', progress: 0 });
    setError(null);
    
    try {
      let processedImage: string = imageDataUrl;
      
      // Schritt 1: Preprocessing
      if (currentOpts.preprocess) {
        setProgress({ status: 'Bildvorverarbeitung...', progress: 10 });
        processedImage = await preprocessImage(imageDataUrl, currentOpts.preprocessingOptions);
      }
      
      // Schritt 2: OCR (mit optionaler PSM-Testing)
      setProgress({ status: 'OCR läuft...', progress: 30 });
      
      if (usePSMTesting) {
        // Teste verschiedene PSM-Modi für beste Ergebnisse
        const { result: psmResult } = await testPSMModes(processedImage);
        if (psmResult) {
          setResult(psmResult);
          setIsProcessing(false);
          return psmResult;
        }
      }
      
      const worker = await initWorker();
      
      const ocrResult = await worker.recognize(processedImage, {}, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const prog = Math.round(30 + m.progress * 70); // 30-100%
            setProgress({ status: 'Erkenne Text...', progress: prog });
          }
        }
      });
      
      setProgress({ status: 'Verarbeite Ergebnis...', progress: 100 });
      
      // Extrahiere Informationen
      const rawText = ocrResult.data.text;
      const cardNumber = extractCardNumber(rawText);
      const cardName = extractCardName(rawText);
      
      // Wörter mit Confidence extrahieren
      const words: OCRWord[] = ocrResult.data.words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      }));
      
      const confidence = calculateConfidence(words);
      
      const result: OCRResult = {
        rawText,
        cardNumber,
        cardName,
        confidence,
        words,
        processedImageDataUrl: currentOpts.preprocess ? processedImage : null
      };
      
      setResult(result);
      return result;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      console.error('OCR Error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [opts, initWorker, testPSMModes]);

  /**
   * Scannt das letzte Bild erneut (für Re-scan)
   */
  const rescan = useCallback(async (
    customOptions?: Partial<UseOCROptions>,
    usePSMTesting: boolean = false
  ): Promise<OCRResult | null> => {
    if (!lastImageRef.current) {
      setError('Kein Bild zum erneuten Scannen vorhanden');
      return null;
    }
    return recognize(lastImageRef.current, customOptions, usePSMTesting);
  }, [recognize]);

  /**
   * Setzt den State zurück
   */
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress({ status: '', progress: 0 });
    lastImageRef.current = null;
  }, []);

  return {
    isProcessing,
    progress,
    result,
    error,
    recognize,
    rescan,
    reset,
    terminateWorker,
    testPSMModes
  };
}
