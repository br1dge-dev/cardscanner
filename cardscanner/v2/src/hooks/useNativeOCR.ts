/**
 * useNativeOCR Hook - Text recognition using Apple Vision (iOS) / ML Kit (Android)
 * Drop-in replacement for useOCR (Tesseract.js)
 */
import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import NativeOCR from '../plugins/native-ocr/definitions';
import type { ROIMetadata } from '../types';

export interface OCRDebugInfo {
  rawText: string;
  confidence: number;
  blocks: Array<{ text: string; confidence: number }>;
  potentialTitles: string[];
  numberMatch: string | null;
}

export function useNativeOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async (
    imageDataUrl: string,
    _enablePreprocessing: boolean = false
  ): Promise<ROIMetadata & { debug?: OCRDebugInfo }> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // Check if running on native platform
      if (!Capacitor.isNativePlatform()) {
        console.warn('Native OCR is only available on device. Using mock for web.');
        setProgress(100);
        return {
          name: '',
          number: '',
          confidence: 0,
          debug: {
            rawText: '[Web platform - native OCR unavailable]',
            confidence: 0,
            blocks: [],
            potentialTitles: [],
            numberMatch: null
          }
        };
      }

      console.log('=== Native OCR DEBUG ===');

      // Step 1: Extract base64 from data URL
      setProgress(20);
      const base64Match = imageDataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid image data URL format');
      }
      const base64 = base64Match[1];

      // Step 2: Call native OCR
      setProgress(40);
      console.log('Calling native OCR...');
      const result = await NativeOCR.recognizeText({ base64 });
      
      console.log('=== RAW NATIVE OCR OUTPUT ===');
      console.log('Full text:', result.text);
      console.log('Blocks:', result.blocks.length);
      result.blocks.forEach((block, i) => {
        console.log(`Block ${i}: "${block.text}" (confidence: ${(block.confidence * 100).toFixed(1)}%)`);
      });
      console.log('=============================');

      const rawText = result.text;

      // Step 3: Extract card number using regex
      setProgress(60);
      const cardNumberPattern = /([A-Z]{2,3})\s*[-–•.\s]?\s*(\d{3})/;
      const numberMatch = rawText.match(cardNumberPattern);

      let numberText = '';
      let numberConfidence = 0;

      if (numberMatch) {
        numberText = `${numberMatch[1]}-${numberMatch[2]}`;
        numberConfidence = 0.95; // Native OCR is much more reliable
        console.log('✓ Found card number:', numberText);
      } else {
        console.log('✗ No card number pattern found in:', rawText);
      }

      // Step 4: Extract card name
      setProgress(80);
      let nameText = '';
      let nameConfidence = 0;

      // Use blocks for better structured extraction
      // Card name is typically one of the larger/more prominent text blocks
      const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3 && l.length < 50);

      const potentialTitles = lines
        .map(l => ({
          text: l.replace(/[^a-zA-Z0-9\s\-'.,]/g, '').trim(),
          original: l
        }))
        .filter(l => l.text.length > 3)
        .filter(l => {
          // Filter out lines that look like card numbers
          if (/^[A-Z]{2,3}\s*[-–]?\s*\d{3}$/.test(l.text)) return false;
          // Filter out lines that are mostly numbers
          const letterRatio = (l.text.match(/[a-zA-Z]/g) || []).length / l.text.length;
          return letterRatio > 0.5;
        });

      console.log('Potential title lines:', potentialTitles.map(t => t.text));

      if (potentialTitles.length > 0) {
        nameText = potentialTitles[0].text;
        nameConfidence = 0.85;
        console.log('✓ Selected title:', nameText);
      }

      setProgress(100);

      // Calculate overall confidence
      const avgConfidence = numberText && nameText
        ? (nameConfidence + numberConfidence) / 2
        : (numberText ? numberConfidence : nameConfidence);

      // Also factor in native OCR block confidences
      const blockAvgConfidence = result.blocks.length > 0
        ? result.blocks.reduce((sum, b) => sum + b.confidence, 0) / result.blocks.length
        : 0;

      console.log('=== FINAL RESULTS ===');
      console.log('Name:', nameText, `(confidence: ${(nameConfidence * 100).toFixed(0)}%)`);
      console.log('Number:', numberText, `(confidence: ${(numberConfidence * 100).toFixed(0)}%)`);
      console.log('Overall confidence:', (avgConfidence * 100).toFixed(0) + '%');
      console.log('Native block avg confidence:', (blockAvgConfidence * 100).toFixed(0) + '%');
      console.log('=====================');

      return {
        name: nameText,
        number: numberText,
        confidence: avgConfidence,
        debug: {
          rawText,
          confidence: blockAvgConfidence,
          blocks: result.blocks,
          potentialTitles: potentialTitles.map(t => t.text),
          numberMatch: numberText || null
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Native OCR processing failed';
      setError(errorMessage);
      console.error('Native OCR error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processFile = useCallback(async (
    file: File
  ): Promise<ROIMetadata & { debug?: OCRDebugInfo }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = await processImage(e.target?.result as string);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, [processImage]);

  // No-op: native OCR doesn't need worker cleanup
  const terminateWorker = useCallback(async () => {}, []);

  return {
    processImage,
    processFile,
    isProcessing,
    progress,
    error,
    terminateWorker
  };
}
