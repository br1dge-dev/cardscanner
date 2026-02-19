/**
 * Camera Component - Uses native Capacitor Camera (reliable on iOS)
 */
import React from 'react';
import { Camera as CameraIcon, X } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
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
  const handleTakePhoto = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (image.base64String) {
        const imageData = `data:image/jpeg;base64,${image.base64String}`;
        onCapture(imageData);
      }
    } catch (err) {
      console.error('Camera error:', err);
      // User cancelled or error - just close
      onClose();
    }
  };

  return (
    <div className="camera-container native-camera">
      <div className="camera-header">
        <button className="camera-btn icon-only" onClick={onClose}>
          <X size={24} />
        </button>
        <span className="camera-title">Scan Card</span>
        <div style={{ width: 44 }} /> {/* Spacer for alignment */}
      </div>

      <div className="camera-viewport center-content">
        <div className="camera-placeholder">
          <CameraIcon size={64} className="camera-icon" />
          <p className="camera-placeholder-text">
            Tap the button below to open your camera
          </p>
        </div>
      </div>

      <div className="camera-controls">
        <button 
          className="capture-btn large"
          onClick={handleTakePhoto}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="spinner" />
          ) : (
            <>
              <CameraIcon size={28} />
              <span>Take Photo</span>
            </>
          )}
        </button>
        <p className="capture-hint">
          {isProcessing ? 'Processing...' : 'Native camera will open'}
        </p>
      </div>
    </div>
  );
};
