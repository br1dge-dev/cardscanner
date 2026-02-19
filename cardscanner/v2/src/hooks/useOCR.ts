/**
 * useOCR Hook - Text recognition using Tesseract.js
 * Optimized for Riftbound trading card scanning
 * Uses FULL IMAGE OCR + Regex extraction (ROIs don't work well)
 */
import { useState, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';
import type { ROIMetadata } from '../types';

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tesseractScheduler = useRef<Tesseract.Scheduler | null>(null);

  /**
   * Initialize Tesseract scheduler for parallel processing
   */
  const initScheduler = useCallback(async () => {
    if (!tesseractScheduler.current) {
      const scheduler = Tesseract.createScheduler();
      const worker = await Tesseract.createWorker('eng');
      await scheduler.addWorker(worker);
      tesseractScheduler.current = scheduler;
    }
    return tesseractScheduler.current;
  }, []);

  /**
   * Terminate Tesseract scheduler
   */
  const terminateWorker = useCallback(async () => {
    if (tesseractScheduler.current) {
      await tesseractScheduler.current.terminate();
      tesseractScheduler.current = null;
    }
  }, []);

  const processImage = useCallback(async (
    imageDataUrl: string
  ): Promise<ROIMetadata> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      console.log('=== Tesseract OCR DEBUG ===');
      console.log('Starting OCR processing...');

      // Step 1: Initialize scheduler
      setProgress(20);
      const scheduler = await initScheduler();

      // Step 2: OCR on FULL IMAGE (ROIs don't work well!)
      setProgress(40);
      console.log('Running OCR on full image...');
      const fullResult = await scheduler.addJob('recognize', imageDataUrl);
      console.log('Full OCR text:', fullResult.data.text);
      console.log('Full OCR confidence:', fullResult.data.confidence);
      
      const rawText = fullResult.data.text;
      
      // Step 3: Extract card number using regex (most reliable)
      setProgress(60);
      // Pattern: 2-3 uppercase letters, optional space/dash/dot, 3 digits
      // Matches: OGN-170, OGN - 170, OGN•170, SFD-001
      const cardNumberPattern = /([A-Z]{2,3})\s*[-•.]?\s*(\d{3})/;
      const numberMatch = rawText.match(cardNumberPattern);
      
      let numberText = '';
      let numberConfidence = 0;
      
      if (numberMatch) {
        numberText = `${numberMatch[1]}-${numberMatch[2]}`;
        numberConfidence = 0.85;
        console.log('✓ Found card number:', numberText);
      } else {
        console.log('✗ No card number pattern found');
      }
      
      // Step 4: Extract card name
      setProgress(80);
      let nameText = '';
      let nameConfidence = 0;
      
      // Split by lines and look for title-like text
      const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3 && l.length < 40); // Reasonable title length
      
      // Heuristic: Title is usually a clean line with words (not symbols)
      // Filter out lines that are mostly special characters or too short
      const potentialTitles = lines
        .map(l => ({ 
          text: l.replace(/[^a-zA-Z0-9\s\-']/g, '').trim(),
          original: l 
        }))
        .filter(l => l.text.length > 3)
        .filter(l => {
          // Should have multiple words or be reasonably long
          const words = l.text.split(/\s+/).filter(w => w.length > 1);
          return words.length >= 1 && l.text.length > 5;
        });
      
      console.log('Potential title lines:', potentialTitles.map(t => t.text));
      
      if (potentialTitles.length > 0) {
        // Take the first reasonable-looking title
        nameText = potentialTitles[0].text;
        nameConfidence = 0.7;
        console.log('✓ Selected title:', nameText);
      } else if (lines.length > 0) {
        // Fallback to first clean line
        nameText = lines[0].replace(/[^a-zA-Z0-9\s\-']/g, '').trim();
        nameConfidence = 0.5;
      }

      setProgress(100);

      // Calculate overall confidence
      const avgConfidence = numberText && nameText ? 
        (nameConfidence + numberConfidence) / 2 :
        (numberText ? numberConfidence : nameConfidence);
      
      console.log('=== FINAL RESULTS ===');
      console.log('Name:', nameText, `(confidence: ${(nameConfidence * 100).toFixed(0)}%)`);
      console.log('Number:', numberText, `(confidence: ${(numberConfidence * 100).toFixed(0)}%)`);
      console.log('Overall confidence:', (avgConfidence * 100).toFixed(0) + '%');
      console.log('=====================');

      return {
        name: nameText,
        number: numberText,
        confidence: avgConfidence
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR processing failed';
      setError(errorMessage);
      console.error('Tesseract OCR error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [initScheduler]);

  const processFile = useCallback(async (
    file: File
  ): Promise<ROIMetadata> => {
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

  return {
    processImage,
    processFile,
    isProcessing,
    progress,
    error,
    terminateWorker
  };
}
