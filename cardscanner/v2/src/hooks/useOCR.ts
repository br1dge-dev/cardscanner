/**
 * useOCR Hook - Text recognition using Tesseract.js
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

// ROI definitions for card scanning
// Card layout: Title in upper-middle, number in lower portion
export const DEFAULT_ROIS: ROIDefinition[] = [
  {
    // Card Title Region - upper middle area
    x: 0.15,
    y: 0.08,
    width: 0.70,
    height: 0.12,
    label: 'title'
  },
  {
    // Card Number Region - bottom area
    x: 0.10,
    y: 0.82,
    width: 0.80,
    height: 0.10,
    label: 'number'
  }
];

interface OCROptions {
  language?: string;
  rois?: ROIDefinition[];
}

export function useOCR(options: OCROptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  const initWorker = useCallback(async () => {
    if (!workerRef.current) {
      workerRef.current = await Tesseract.createWorker('eng');
    }
    return workerRef.current;
  }, []);

  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const cropImageToROI = useCallback((
    imageDataUrl: string, 
    roi: ROIDefinition
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        const x = roi.x * img.width;
        const y = roi.y * img.height;
        const width = roi.width * img.width;
        const height = roi.height * img.height;

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageDataUrl;
    });
  }, []);

  const processROI = useCallback(async (
    worker: Tesseract.Worker,
    imageDataUrl: string,
    roi: ROIDefinition
  ): Promise<{ text: string; confidence: number }> => {
    const croppedImage = await cropImageToROI(imageDataUrl, roi);
    const result = await worker.recognize(croppedImage);
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence
    };
  }, [cropImageToROI]);

  const processImage = useCallback(async (
    imageDataUrl: string
  ): Promise<ROIMetadata> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const rois = options.rois || DEFAULT_ROIS;
      const worker = await initWorker();
      
      let nameResult = { text: '', confidence: 0 };
      let numberResult = { text: '', confidence: 0 };

      // Process title ROI
      const titleROI = rois.find(r => r.label === 'title');
      if (titleROI) {
        setProgress(25);
        nameResult = await processROI(worker, imageDataUrl, titleROI);
      }

      // Process number ROI
      const numberROI = rois.find(r => r.label === 'number');
      if (numberROI) {
        setProgress(75);
        numberResult = await processROI(worker, imageDataUrl, numberROI);
      }

      setProgress(100);

      // Clean up extracted text
      const cleanName = nameResult.text
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const cleanNumber = numberResult.text
        .replace(/\n/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9\-]/g, '')
        .trim();

      return {
        name: cleanName,
        number: cleanNumber,
        confidence: (nameResult.confidence + numberResult.confidence) / 2
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR processing failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [options.rois, initWorker, processROI]);

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
