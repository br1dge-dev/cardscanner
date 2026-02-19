/**
 * useOCR Hook - Text recognition using Google ML Kit via Capacitor plugin
 * Replaces Tesseract.js with native ML Kit implementation
 */
import { useState, useCallback } from 'react';
import { CapacitorPluginMlKitTextRecognition } from '@pantrist/capacitor-plugin-ml-kit-text-recognition';
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
    x: 0.10,
    y: 0.05,
    width: 0.80,
    height: 0.25,
    label: 'title'
  },
  {
    // Card Number Region - bottom area
    x: 0.05,
    y: 0.70,
    width: 0.90,
    height: 0.25,
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

  /**
   * Check if a bounding box is within an ROI
   */
  const isInROI = useCallback((
    box: { left: number; top: number; right: number; bottom: number },
    roi: ROIDefinition,
    imageWidth: number,
    imageHeight: number
  ): boolean => {
    // Calculate ROI in pixels
    const roiLeft = roi.x * imageWidth;
    const roiTop = roi.y * imageHeight;
    const roiRight = (roi.x + roi.width) * imageWidth;
    const roiBottom = (roi.y + roi.height) * imageHeight;

    // Check if box center is within ROI
    const boxCenterX = (box.left + box.right) / 2;
    const boxCenterY = (box.top + box.bottom) / 2;

    return boxCenterX >= roiLeft && boxCenterX <= roiRight &&
           boxCenterY >= roiTop && boxCenterY <= roiBottom;
  }, []);

  /**
   * Extract text from ML Kit result based on ROI
   */
  const extractTextFromROI = useCallback((
    result: { text: string; blocks: Array<{
      text: string;
      boundingBox: { left: number; top: number; right: number; bottom: number };
      lines: Array<{
        text: string;
        boundingBox: { left: number; top: number; right: number; bottom: number };
      }>;
    }> },
    roi: ROIDefinition,
    imageWidth: number,
    imageHeight: number
  ): string => {
    // Collect all lines that fall within this ROI
    const linesInROI: Array<{ text: string; y: number }> = [];

    for (const block of result.blocks) {
      for (const line of block.lines) {
        if (isInROI(line.boundingBox, roi, imageWidth, imageHeight)) {
          const centerY = (line.boundingBox.top + line.boundingBox.bottom) / 2;
          linesInROI.push({ text: line.text.trim(), y: centerY });
        }
      }
    }

    // Sort by vertical position (top to bottom)
    linesInROI.sort((a, b) => a.y - b.y);

    // Join lines with spaces
    return linesInROI.map(l => l.text).join(' ');
  }, [isInROI]);

  /**
   * Get image dimensions from base64 data URL
   */
  const getImageDimensions = useCallback((imageDataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageDataUrl;
    });
  }, []);

  /**
   * Convert data URL to base64 string (remove prefix)
   */
  const extractBase64 = useCallback((dataUrl: string): string => {
    const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/);
    return match ? match[1] : dataUrl;
  }, []);

  const processImage = useCallback(async (
    imageDataUrl: string
  ): Promise<ROIMetadata> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const rois = options.rois || DEFAULT_ROIS;

      // Get image dimensions for ROI calculations
      setProgress(10);
      const { width: imageWidth, height: imageHeight } = await getImageDimensions(imageDataUrl);

      // Extract base64 from data URL
      const base64Image = extractBase64(imageDataUrl);

      // Run ML Kit text detection
      setProgress(30);
      const result = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image });
      setProgress(70);

      // Debug logging
      console.log('=== ML Kit OCR DEBUG ===');
      console.log('Full text:', result.text);
      console.log('Blocks found:', result.blocks.length);

      // Find title and number ROIs
      const titleROI = rois.find(r => r.label === 'title');
      const numberROI = rois.find(r => r.label === 'number');

      // Extract text from each ROI
      let nameText = '';
      let numberText = '';

      if (titleROI) {
        nameText = extractTextFromROI(result, titleROI, imageWidth, imageHeight);
      }

      if (numberROI) {
        numberText = extractTextFromROI(result, numberROI, imageWidth, imageHeight);
      }

      setProgress(90);

      // If ROI extraction didn't find text, fall back to full text
      if (!nameText && !numberText && result.text) {
        // Simple heuristic: first line might be title, last line might be number
        const lines = result.text.split('\n').filter((l: string) => l.trim());
        if (lines.length > 0 && !nameText) {
          nameText = lines[0];
        }
        if (lines.length > 1 && !numberText) {
          numberText = lines[lines.length - 1];
        }
      }

      // Clean up extracted text
      const cleanName = nameText
        .replace(/\s+/g, ' ')
        .trim();

      const cleanNumber = numberText
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9\-]/g, '')
        .trim();

      console.log('Extracted name:', cleanName);
      console.log('Extracted number:', cleanNumber);
      console.log('=======================');

      setProgress(100);

      // Calculate confidence based on text presence
      // ML Kit doesn't provide per-text confidence, so we use heuristics
      const nameConfidence = cleanName.length > 0 ? 0.85 : 0.3;
      const numberConfidence = cleanNumber.length > 0 ? 0.90 : 0.3;

      return {
        name: cleanName,
        number: cleanNumber,
        confidence: (nameConfidence + numberConfidence) / 2
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR processing failed';
      setError(errorMessage);
      console.error('ML Kit OCR error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [options.rois, getImageDimensions, extractBase64, extractTextFromROI]);

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

  // No-op for ML Kit - no worker to terminate
  const terminateWorker = useCallback(async () => {
    // ML Kit is native, no cleanup needed
  }, []);

  return {
    processImage,
    processFile,
    isProcessing,
    progress,
    error,
    terminateWorker
  };
}
