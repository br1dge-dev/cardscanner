/**
 * BatchSetup Component - Mode picker before starting batch scan
 */
import React from 'react';
import type { BatchAction } from '../types';
import './BatchSetup.css';

interface BatchSetupProps {
  onStart: (action: BatchAction) => void;
  onCancel: () => void;
}

export const BatchSetup: React.FC<BatchSetupProps> = ({ onStart, onCancel }) => {
  return (
    <div className="batch-setup-overlay" onClick={onCancel}>
      <div className="batch-setup-modal" onClick={e => e.stopPropagation()}>
        <h3 className="batch-setup-title">⚡ Batch Scan</h3>
        <p className="batch-setup-desc">What should happen with matched cards?</p>

        <div className="batch-setup-options">
          <button className="batch-option batch-option-primary" onClick={() => onStart('auto-add-standard')}>
            <span className="batch-option-icon">📥</span>
            <div className="batch-option-text">
              <span className="batch-option-label">Auto-Add +1 Standard</span>
              <span className="batch-option-hint">Scan → match → add → next. Fastest.</span>
            </div>
          </button>

          <button className="batch-option" onClick={() => onStart('auto-add-foil')}>
            <span className="batch-option-icon">✨</span>
            <div className="batch-option-text">
              <span className="batch-option-label">Auto-Add +1 Foil</span>
              <span className="batch-option-hint">Same, but saves as foil variant.</span>
            </div>
          </button>

          <button className="batch-option" onClick={() => onStart('review-each')}>
            <span className="batch-option-icon">👁️</span>
            <div className="batch-option-text">
              <span className="batch-option-label">Review Each</span>
              <span className="batch-option-hint">Scan → review → decide → next.</span>
            </div>
          </button>
        </div>

        <button className="batch-setup-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};
