/**
 * useOCR Hook - Text recognition using Tesseract.js
 * Optimized for Riftbound trading card scanning
 * Uses FULL IMAGE OCR + Regex extraction (ROIs don't work well)
 */
import { useState, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { preprocessImage } from '../utils/imagePreprocessing';
import type { ROIMetadata } from '../types';

export interface OCRDebugInfo {
  rawText: string;
  confidence: number;
  processedImage: string;
  potentialTitles: string[];
  numberMatch: string | null;
}

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tesseractScheduler = useRef<Tesseract.Scheduler | null>(null);

  /**
   * Initialize Tesseract scheduler with optimized settings
   */
  const initScheduler = useCallback(async () => {
    if (!tesseractScheduler.current) {
      const scheduler = Tesseract.createScheduler();
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => console.log('Tesseract:', m),
        errorHandler: e => console.error('Tesseract error:', e)
      });
      
      // Configure for best accuracy on trading cards
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/', // Only card-relevant chars
        tessedit_pageseg_mode: '6' as any, // Assume uniform block of text
        preserve_interword_spaces: '1',
      });
      
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
    imageDataUrl: string,
    enablePreprocessing: boolean = true
  ): Promise<ROIMetadata & { debug?: OCRDebugInfo }> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      console.log('=== Tesseract OCR DEBUG ===');
      console.log('Starting OCR processing...');

      // Step 1: Initialize scheduler
      setProgress(20);
      const scheduler = await initScheduler();

      // Step 2: Preprocess image for better OCR
      setProgress(30);
      let processedImageUrl = imageDataUrl;
      if (enablePreprocessing) {
        console.log('Preprocessing image...');
        processedImageUrl = await preprocessImage(imageDataUrl);
        console.log('Image preprocessing complete');
      }

      // Step 3: OCR on FULL IMAGE (ROIs don't work well!)
      setProgress(50);
      console.log('Running OCR on full image with optimized settings...');
      console.log('Image data URL length:', processedImageUrl.length);
      
      // Add timeout and better error handling
      const fullResult = await scheduler.addJob('recognize', processedImageUrl);
      
      console.log('=== RAW TESSERACT OUTPUT ===');
      console.log('Full OCR text:', fullResult.data.text);
      console.log('Full OCR confidence:', fullResult.data.confidence);
      
      // Log detailed block info if available
      if (fullResult.data.blocks && fullResult.data.blocks.length > 0) {
        console.log('Text blocks found:', fullResult.data.blocks.length);
        fullResult.data.blocks.forEach((block: any, i: number) => {
          console.log(`Block ${i}:`, block.text, `(confidence: ${block.confidence})`);
        });
      }
      console.log('============================');
      
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
        confidence: avgConfidence,
        debug: {
          rawText,
          confidence: fullResult.data.confidence,
          processedImage: processedImageUrl,
          potentialTitles: potentialTitles.map(t => t.text),
          numberMatch: numberText
        }
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

  return {
    processImage,
    processFile,
    isProcessing,
    progress,
    error,
    terminateWorker
  };
}
