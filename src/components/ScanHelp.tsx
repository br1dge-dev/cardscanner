/**
 * ScanHelp Component - Tutorial for scanning cards
 */
import React, { useEffect } from 'react';
import { X, HelpCircle, Sun, Move, Crosshair, Sparkles } from 'lucide-react';
import './ScanHelp.css';

interface ScanHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Tip {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const tips: Tip[] = [
  {
    icon: <Sun size={24} />,
    title: 'Good Lighting',
    description: 'Make sure the card is well-lit. Natural light works best. Avoid shadows across the card.'
  },
  {
    icon: <Move size={24} />,
    title: 'Hold Steady',
    description: 'Keep your hands steady while taking the photo. Blurry images make it harder to read the card.'
  },
  {
    icon: <Crosshair size={24} />,
    title: 'Center the Card',
    description: 'Try to get the entire card in frame. Leave a small margin around the edges if possible.'
  },
  {
    icon: <Sparkles size={24} />,
    title: 'Avoid Glare',
    description: 'Tilt the card slightly to avoid reflections and glare on glossy card surfaces.'
  }
];

export const ScanHelp: React.FC<ScanHelpProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="scan-help-overlay">
      <div className="scan-help-backdrop" onClick={onClose} />
      <div className="scan-help-modal">
        {/* Header */}
        <div className="scan-help-header">
          <div className="scan-help-title-row">
            <div className="scan-help-icon">
              <HelpCircle size={24} />
            </div>
            <h2 className="scan-help-title">How to Scan</h2>
          </div>
          <button className="scan-help-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="scan-help-content">
          <p className="scan-help-intro">
            Follow these tips to get the best results when scanning your cards:
          </p>

          <div className="scan-tips">
            {tips.map((tip, index) => (
              <div key={index} className="scan-tip">
                <div className="scan-tip-icon">{tip.icon}</div>
                <div className="scan-tip-content">
                  <h3 className="scan-tip-title">{tip.title}</h3>
                  <p className="scan-tip-description">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Example Section */}
          <div className="scan-examples">
            <h3 className="scan-examples-title">Examples</h3>
            
            <div className="scan-example-grid">
              <div className="scan-example good">
                <div className="scan-example-visual">
                  <div className="scan-example-card good-example">
                    <div className="scan-example-card-inner">
                      <span className="scan-example-card-text">Good Card</span>
                    </div>
                  </div>
                </div>
                <div className="scan-example-label">
                  <span className="scan-example-badge good">✓ Good</span>
                  <p>Well-lit, centered, no glare</p>
                </div>
              </div>

              <div className="scan-example bad">
                <div className="scan-example-visual">
                  <div className="scan-example-card bad-example-blurry">
                    <div className="scan-example-card-inner">
                      <span className="scan-example-card-text">Blurry</span>
                    </div>
                  </div>
                </div>
                <div className="scan-example-label">
                  <span className="scan-example-badge bad">✗ Bad</span>
                  <p>Blurry - hold steady</p>
                </div>
              </div>

              <div className="scan-example bad">
                <div className="scan-example-visual">
                  <div className="scan-example-card bad-example-dark">
                    <div className="scan-example-card-inner">
                      <span className="scan-example-card-text">Dark</span>
                    </div>
                  </div>
                </div>
                <div className="scan-example-label">
                  <span className="scan-example-badge bad">✗ Bad</span>
                  <p>Too dark - add more light</p>
                </div>
              </div>

              <div className="scan-example bad">
                <div className="scan-example-visual">
                  <div className="scan-example-card bad-example-glare">
                    <div className="scan-example-card-inner">
                      <span className="scan-example-card-text">Glare!</span>
                    </div>
                  </div>
                </div>
                <div className="scan-example-label">
                  <span className="scan-example-badge bad">✗ Bad</span>
                  <p>Glare - adjust angle</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="scan-help-footer">
          <button className="scan-help-done" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
