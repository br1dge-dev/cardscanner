/**
 * CardResult Component - Display scanned card results
 */
import React, { useState } from 'react';
import { Check, Plus, Minus, Save, X, AlertCircle } from 'lucide-react';
import type { CardMatch } from '../types';
import './CardResult.css';

interface CardResultProps {
  match: CardMatch | null;
  capturedImage?: string | null;
  onSave?: (cardId: string, quantity: number) => void;
  onClose: () => void;
  isSaving?: boolean;
}

export const CardResult: React.FC<CardResultProps> = ({ 
  match, 
  capturedImage,
  onSave, 
  onClose,
  isSaving = false
}) => {
  const [quantity, setQuantity] = useState(1);
  const [showCapturedImage, setShowCapturedImage] = useState(false);

  if (!match) {
    return (
      <div className="card-result-overlay" onClick={onClose}>
        <div className="card-result-modal no-match" onClick={e => e.stopPropagation()}>
          <div className="card-result-header">
            <h3>No Match Found</h3>
            <button className="close-btn" onClick={onClose} style={{padding: '12px', minWidth: '44px', minHeight: '44px'}}>
              <X size={24} />
            </button>
          </div>
          <div className="no-match-content">
            <AlertCircle size={48} className="no-match-icon" />
            <p>Could not identify the card.</p>
            <p style={{fontSize: '14px', color: '#666', marginTop: '8px'}}>
              Tip: Try better lighting or tap outside this box to close
            </p>
            <button 
              onClick={onClose}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { card, confidence } = match;

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => Math.max(1, q - 1));

  const handleSave = () => {
    onSave?.(card.id, quantity);
  };

  const getRarityClass = (rarity?: string) => {
    if (!rarity) return '';
    const r = rarity.toLowerCase();
    if (r.includes('leader')) return 'rarity-leader';
    if (r.includes('secret')) return 'rarity-secret';
    if (r.includes('rare')) return 'rarity-rare';
    if (r.includes('uncommon')) return 'rarity-uncommon';
    return 'rarity-common';
  };

  return (
    <div className="card-result-overlay" onClick={onClose}>
      <div className="card-result-modal" onClick={e => e.stopPropagation()}>
        <div className="card-result-header">
          <div className="match-badge">
            <Check size={14} />
            <span>{Math.round(confidence * 100)}% match</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="card-result-content">
          {capturedImage && showCapturedImage ? (
            <div className="captured-preview-container">
              <div className="captured-image-wrapper">
                <img 
                  src={capturedImage} 
                  alt="Captured card"
                  className="captured-preview-image"
                />
                {/* ROI Overlay on captured image */}
                <div className="roi-overlay-static">
                  <div className="roi-box-static roi-title-static">
                    <span className="roi-label-static">Card Title</span>
                  </div>
                  <div className="roi-box-static roi-number-static">
                    <span className="roi-label-static">Card Number</span>
                  </div>
                </div>
              </div>
              <button 
                className="toggle-image-btn"
                onClick={() => setShowCapturedImage(false)}
              >
                Show Card Data
              </button>
            </div>
          ) : (
            <>
              <div className="card-image-container">
                {card.imageUrl ? (
                  <img 
                    src={card.imageUrl} 
                    alt={card.name}
                    className="card-image"
                  />
                ) : (
                  <div className="card-image-placeholder">
                    <span>{card.name[0]}</span>
                  </div>
                )}
              </div>

              <div className="card-info">
                <h3 className="card-name">{card.name}</h3>
                
                <div className="card-meta">
                  <span className="card-number">{card.number}</span>
                  {card.set && <span className="card-set">{card.set}</span>}
                  {card.rarity && (
                    <span className={`card-rarity ${getRarityClass(card.rarity)}`}>
                      {card.rarity}
                    </span>
                  )}
                </div>

                {card.type && (
                  <div className="card-details">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{card.type}</span>
                  </div>
                )}

                {(card.power || card.cost) && (
                  <div className="card-stats">
                    {card.cost && (
                      <div className="stat">
                        <span className="stat-label">Cost</span>
                        <span className="stat-value">{card.cost}</span>
                      </div>
                    )}
                    {card.power && (
                      <div className="stat">
                        <span className="stat-label">Power</span>
                        <span className="stat-value">{card.power}</span>
                      </div>
                    )}
                    {card.life && (
                      <div className="stat">
                        <span className="stat-label">Life</span>
                        <span className="stat-value">{card.life}</span>
                      </div>
                    )}
                  </div>
                )}

                {card.attributes && card.attributes.length > 0 && (
                  <div className="card-attributes">
                    {card.attributes.map((attr, idx) => (
                      <span key={idx} className="attribute-tag">{attr}</span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="card-result-actions">
          {capturedImage && !showCapturedImage && (
            <button 
              className="view-captured-btn"
              onClick={() => setShowCapturedImage(true)}
            >
              View Captured Image
            </button>
          )}
          
          <div className="quantity-selector">
            <button 
              className="qty-btn" 
              onClick={decrement}
              disabled={quantity <= 1}
            >
              <Minus size={16} />
            </button>
            <span className="qty-value">{quantity}</span>
            <button className="qty-btn" onClick={increment}>
              <Plus size={16} />
            </button>
          </div>

          <button 
            className="save-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="spinner-small" />
            ) : (
              <>
                <Save size={18} />
                Add to Collection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
