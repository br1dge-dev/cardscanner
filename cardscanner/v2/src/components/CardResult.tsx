/**
 * CardResult Component - Display scanned card with actions
 */
import React, { useState } from 'react';
import { Check, Plus, Minus, Save, X, AlertCircle } from 'lucide-react';
import type { CardMatch } from '../types';
import './CardResult.css';

interface CardResultProps {
  match: CardMatch | null;
  capturedImage?: string | null;
  onSave?: (cardId: string, quantity: number, isFoil: boolean) => void;
  onClose: () => void;
  isSaving?: boolean;
  debugMode?: boolean;
  marketplace?: 'cardmarket' | 'tcgplayer';
}

// Normalize "1"/true/etc to boolean
const toBool = (v: unknown): boolean => v === true || v === '1' || v === 1;

// Riftbound rarity → glow class
const getRarityGlow = (rarity?: string): string => {
  if (!rarity) return 'glow-common';
  const r = rarity.toLowerCase();
  if (r.includes('showcase')) return 'glow-showcase';
  if (r.includes('secret')) return 'glow-secret';
  if (r.includes('epic')) return 'glow-epic';
  if (r.includes('leader')) return 'glow-leader';
  if (r.includes('promo')) return 'glow-promo';
  if (r.includes('rare')) return 'glow-rare';
  if (r.includes('uncommon')) return 'glow-uncommon';
  return 'glow-common';
};

const getRarityLabel = (rarity?: string): string => {
  if (!rarity) return '';
  const r = rarity.toLowerCase();
  if (r.includes('showcase')) return '✦ Showcase';
  if (r.includes('secret')) return '✧ Secret';
  if (r.includes('epic')) return '◆ Epic';
  if (r.includes('leader')) return '★ Leader';
  if (r.includes('promo')) return '⊕ Promo';
  if (r.includes('rare')) return '◇ Rare';
  if (r.includes('uncommon')) return '○ Uncommon';
  return '• Common';
};

export const CardResult: React.FC<CardResultProps> = ({
  match,
  capturedImage,
  onSave,
  onClose,
  isSaving = false,
  debugMode = false,
  marketplace = 'cardmarket'
}) => {
  const [quantity, setQuantity] = useState(1);
  const [showCapturedImage, setShowCapturedImage] = useState(false);

  if (!match) {
    return (
      <div className="card-result-overlay" onClick={onClose}>
        <div className="card-result-modal no-match" onClick={e => e.stopPropagation()}>
          <div className="card-result-header">
            <h3>No Match Found</h3>
            <button className="close-btn" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="no-match-content">
            <AlertCircle size={48} className="no-match-icon" />
            <p>Could not identify the card.</p>
            <button className="btn-primary" onClick={onClose}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const { card, confidence } = match;
  const hasFoil = toBool(card.hasFoil);
  const hasNormal = toBool(card.hasNormal);
  const isFoilOnly = hasFoil && !hasNormal;
  const canBeFoil = hasFoil && hasNormal;
  const [isFoil, setIsFoil] = useState(isFoilOnly);

  const isRemove = quantity < 0;
  const absQuantity = Math.abs(quantity);

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => q - 1); // Allow negative for removal

  const handleSave = () => {
    onSave?.(card.id, quantity, isFoil);
  };

  // Price display based on marketplace preference
  const renderPrice = () => {
    if (marketplace === 'cardmarket') {
      const p = Number(card.cmPrice);
      const fp = Number(card.cmFoilPrice);
      const d7 = Number(card.cmDelta7dPrice);
      if (!p && !fp) return null;
      const displayPrice = isFoil && fp ? fp : p;
      return (
        <div className="card-prices">
          <div className="price-row">
            <span className="price-source">Cardmarket{isFoil ? ' (Foil)' : ''}</span>
            <span className="price-value">{displayPrice?.toFixed(2)}€</span>
            {d7 != null && d7 !== 0 && !isFoil && (
              <span className={`price-delta ${d7 > 0 ? 'up' : 'down'}`}>
                {d7 > 0 ? '↑' : '↓'}{Math.abs(d7).toFixed(2)}€
              </span>
            )}
          </div>
          {card.cmurl && (
            <a href={card.cmurl} target="_blank" rel="noopener noreferrer" className="cm-link">
              View on Cardmarket →
            </a>
          )}
        </div>
      );
    } else {
      // TCGPlayer (stored as price/foilPrice in API)
      const p = Number(card.price);
      const fp = Number(card.foilPrice);
      const d7 = Number(card.delta7dPrice);
      if (!p && !fp) return null;
      const displayPrice = isFoil && fp ? fp : p;
      return (
        <div className="card-prices">
          <div className="price-row">
            <span className="price-source">TCGPlayer{isFoil ? ' (Foil)' : ''}</span>
            <span className="price-value">${displayPrice?.toFixed(2)}</span>
            {d7 != null && d7 !== 0 && !isFoil && (
              <span className={`price-delta ${d7 > 0 ? 'up' : 'down'}`}>
                {d7 > 0 ? '↑' : '↓'}${Math.abs(d7).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      );
    }
  };

  const glowClass = getRarityGlow(card.rarity);

  return (
    <div className="card-result-overlay" onClick={onClose}>
      <div className={`card-result-modal ${glowClass}`} onClick={e => e.stopPropagation()}>
        <div className="card-result-header">
          <div className="match-badge">
            <Check size={14} />
            <span>{Math.round(confidence * 100)}%</span>
          </div>
          <span className={`rarity-badge ${glowClass}`}>{getRarityLabel(card.rarity)}</span>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="card-result-content">
          {debugMode && capturedImage && showCapturedImage ? (
            <div className="captured-preview-container">
              <img src={capturedImage} alt="Captured" className="captured-preview-image" />
              <button className="toggle-image-btn" onClick={() => setShowCapturedImage(false)}>
                Show Card Data
              </button>
            </div>
          ) : (
            <>
              <div className={`card-image-container ${glowClass}`}>
                {(card.imageUrl || card.image) ? (
                  <img
                    src={card.imageUrl || card.image}
                    alt={card.name}
                    className="card-image"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
                  {card.set_name && <span className="card-set">{card.set_name}</span>}
                </div>

                {renderPrice()}
              </div>
            </>
          )}
        </div>

        <div className="card-result-actions">
          {/* Debug: view captured image */}
          {debugMode && capturedImage && !showCapturedImage && (
            <button className="view-captured-btn" onClick={() => setShowCapturedImage(true)}>
              🔍 View Captured Image
            </button>
          )}

          {/* Foil toggle */}
          {isFoilOnly && (
            <div className="foil-badge">✨ Foil Only</div>
          )}
          {canBeFoil && (
            <button
              className={`foil-toggle-btn ${isFoil ? 'active' : ''}`}
              onClick={() => setIsFoil(!isFoil)}
            >
              ✨ {isFoil ? 'Foil' : 'Standard'}
            </button>
          )}

          {/* Quantity with negative for removal */}
          <div className="quantity-selector">
            <button className="qty-btn" onClick={decrement}>
              <Minus size={16} />
            </button>
            <span className={`qty-value ${isRemove ? 'remove' : ''}`}>
              {isRemove ? `−${absQuantity}` : quantity === 0 ? '0' : `+${quantity}`}
            </span>
            <button className="qty-btn" onClick={increment}>
              <Plus size={16} />
            </button>
          </div>

          <button
            className={`save-btn ${isRemove ? 'remove-btn' : ''} ${isFoil ? 'foil-btn' : ''}`}
            onClick={handleSave}
            disabled={isSaving || quantity === 0}
          >
            {isSaving ? (
              <span className="spinner-small" />
            ) : (
              <>
                <Save size={18} />
                {quantity === 0
                  ? 'Select quantity'
                  : isRemove
                    ? `Remove ${absQuantity} from Collection`
                    : isFoil
                      ? `Add ${quantity} Foil to Collection`
                      : `Add ${quantity} to Collection`
                }
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
