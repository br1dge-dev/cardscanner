/**
 * Camera Component with ROI Overlay
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera as CameraIcon, X, RefreshCw, Aperture } from 'lucide-react';
import './Camera.css';

interface CameraProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export const Camera: React.FC<CameraProps> = ({ 
  onCapture, 
  onClose,
  isProcessing = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    } catch (err) {
      setError('Failed to access camera. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Initialize on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Handle video ready
  const handleVideoReady = () => {
    setIsReady(true);
  };

  // Capture image
  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(imageData);
  }, [isReady, onCapture]);

  // Restart camera
  const restartCamera = useCallback(() => {
    stopCamera();
    setError(null);
    setIsReady(false);
    setTimeout(startCamera, 100);
  }, [stopCamera, startCamera]);

  return (
    <div className="camera-container">
      <div className="camera-header">
        <button className="camera-btn icon-only" onClick={onClose}>
          <X size={24} />
        </button>
        <span className="camera-title">Scan Card</span>
        <button className="camera-btn icon-only" onClick={restartCamera}>
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="camera-viewport">
        {error ? (
          <div className="camera-error">
            <CameraIcon size={48} />
            <p>{error}</p>
            <button className="camera-btn" onClick={restartCamera}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoReady}
              className="camera-video"
            />
            
            {/* ROI Overlay */}
            <div className="roi-overlay">
              {/* Title ROI */}
              <div className="roi-box roi-title">
                <span className="roi-label">Card Title</span>
              </div>
              
              {/* Number ROI */}
              <div className="roi-box roi-number">
                <span className="roi-label">Card Number</span>
              </div>

              {/* Corner markers */}
              <div className="corner-marker top-left" />
              <div className="corner-marker top-right" />
              <div className="corner-marker bottom-left" />
              <div className="corner-marker bottom-right" />
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}
      </div>

      <div className="camera-controls">
        <button 
          className="capture-btn"
          onClick={capture}
          disabled={!isReady || isProcessing}
        >
          {isProcessing ? (
            <span className="spinner" />
          ) : (
            <Aperture size={32} />
          )}
        </button>
        <p className="capture-hint">
          {isProcessing ? 'Processing...' : 'Position card within frame and tap to scan'}
        </p>
      </div>
    </div>
  );
};
