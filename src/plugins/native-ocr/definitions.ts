import { registerPlugin } from '@capacitor/core';

export interface TextBlock {
  text: string;
  confidence: number;
}

export interface RecognizeTextResult {
  text: string;
  blocks: TextBlock[];
}

export interface NativeOCRPlugin {
  recognizeText(options: { base64: string }): Promise<RecognizeTextResult>;
}

const NativeOCR = registerPlugin<NativeOCRPlugin>('NativeOCR');

export default NativeOCR;
