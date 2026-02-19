/**
 * useOCR Hook - Text recognition using Tesseract.js with image preprocessing
 * Optimized for Riftbound trading card scanning
 */
import { useState, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';
import type { ROIMetadata } from '../types';

interface ROIDefinition {
  x: number;      // percentage (0-1)
  y: number;      // percentage (0-1)
  width: number;  // percentage (0-1)
  height: number; // percentage (0-1)
  label: string;
}

// ROI definitions for Riftbound card layout
// Title: Top 15-35% of card (centered)
// Number: Bottom 10-25% (left side where set code is)
export const DEFAULT_ROIS: ROIDefinition[] = [
  {
    // Card Title Region - upper area (15-35% from top)
    x: 0.15,
    y: 0.15,
    width: 0.70,
    height: 0.20,
    label: 'title'
  },
  {
    // Card Number/Set Code Region - bottom left area (10-25% from bottom)
    x: 0.05,
    y: 0.75,
    width: 0.45,
    height: 0.15,
    label: 'number'
  }
];

interface OCROptions {
  language?: string;
  rois?: ROIDefinition[];
}

/**
 * Preprocess image for better OCR results
 * - Convert to grayscale
 * - Increase contrast
 * - Apply slight brightness boost
 * - Resize to optimal OCR size (1500px width max)
 */
const preprocessImage = (imageDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Resize if too large (OCR works better at moderate sizes)
      const maxWidth = 1500;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw and apply filters
      ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
    img.src = imageDataUrl;
  });
};

/**
 * Extract region of interest from image
 */
const extractROI = (imageDataUrl: string, roi: ROIDefinition): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Calculate ROI in pixels
      const roiX = roi.x * img.width;
      const roiY = roi.y * img.height;
      const roiWidth = roi.width * img.width;
      const roiHeight = roi.height * img.height;
      
      canvas.width = roiWidth;
      canvas.height = roiHeight;
      
      // Draw the ROI region
      ctx.drawImage(
        img,
        roiX, roiY, roiWidth, roiHeight,
        0, 0, roiWidth, roiHeight
      );
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image for ROI extraction'));
    img.src = imageDataUrl;
  });
};

export function useOCR(options: OCROptions = {}) {
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
      const rois = options.rois || DEFAULT_ROIS;

      console.log('=== Tesseract OCR DEBUG ===');
      console.log('Starting OCR processing...');

      // Step 1: Preprocess the image
      setProgress(10);
      console.log('Step 1: Preprocessing image...');
      const preprocessedImage = await preprocessImage(imageDataUrl);
      console.log('Preprocessing complete');

      // Step 2: Initialize scheduler
      setProgress(20);
      const scheduler = await initScheduler();

      // Find title and number ROIs
      const titleROI = rois.find(r => r.label === 'title');
      const numberROI = rois.find(r => r.label === 'number');

      // Step 3: Extract and process title ROI
      setProgress(30);
      let nameText = '';
      let nameConfidence = 0;
      
      if (titleROI) {
        console.log('Step 3: Processing title ROI...', titleROI);
        const titleImage = await extractROI(preprocessedImage, titleROI);
        console.log('Title ROI extracted, running OCR...');
        
        const titleResult = await scheduler.addJob('recognize', titleImage);
        console.log('Title OCR result:', titleResult.data);
        
        nameText = titleResult.data.text
          .replace(/\s+/g, ' ')
          .replace(/[^a-zA-Z0-9\s\-']/g, '')
          .trim();
        nameConfidence = titleResult.data.confidence / 100;
        console.log('Extracted name:', nameText, 'Confidence:', nameConfidence);
      }

      // Step 4: Extract and process number ROI
      setProgress(60);
      let numberText = '';
      let numberConfidence = 0;
      
      if (numberROI) {
        console.log('Step 4: Processing number ROI...', numberROI);
        const numberImage = await extractROI(preprocessedImage, numberROI);
        console.log('Number ROI extracted, running OCR...');
        
        const numberResult = await scheduler.addJob('recognize', numberImage);
        console.log('Number OCR result:', numberResult.data);
        
        numberText = numberResult.data.text
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9\-]/g, '')
          .trim();
        numberConfidence = numberResult.data.confidence / 100;
        console.log('Extracted number:', numberText, 'Confidence:', numberConfidence);
      }

      setProgress(90);

      // If ROI extraction didn't find text, try full image
      if (!nameText && !numberText) {
        console.log('No text found in ROIs, trying full image...');
        const fullResult = await scheduler.addJob('recognize', preprocessedImage);
        console.log('Full image OCR result:', fullResult.data);
        
        const lines = fullResult.data.text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);
        
        if (lines.length > 0 && !nameText) {
          nameText = lines[0].replace(/[^a-zA-Z0-9\s\-']/g, '').trim();
        }
        if (lines.length > 1 && !numberText) {
          numberText = lines[lines.length - 1].replace(/[^a-zA-Z0-9\-]/g, '').trim();
        }
      }

      setProgress(100);

      // Calculate overall confidence
      const avgConfidence = (nameConfidence + numberConfidence) / 2;
      
      console.log('=== FINAL RESULTS ===');
      console.log('Name:', nameText, `(confidence: ${(nameConfidence * 100).toFixed(1)}%)`);
      console.log('Number:', numberText, `(confidence: ${(numberConfidence * 100).toFixed(1)}%)`);
      console.log('Overall confidence:', (avgConfidence * 100).toFixed(1) + '%');
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
  }, [options.rois, initScheduler]);

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
