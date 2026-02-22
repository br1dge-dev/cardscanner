import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

const FLAVOR_LINES = [
  'Undusting ancient boxes…',
  'Sorting runes by taste…',
  'Sharpening the card edges…',
  'Consulting the flavor text oracle…',
  'Bribing the shopkeeper…',
  'Rolling for initiative…',
  'Polishing legendary borders…',
  'Waking the card catalog golem…',
  'Counting mana crystals…',
  'Aligning the rift portals…',
];

export const SplashScreen: React.FC = () => {
  const [lineIndex, setLineIndex] = useState(() => Math.floor(Math.random() * FLAVOR_LINES.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setLineIndex(prev => (prev + 1) % FLAVOR_LINES.length);
        setFade(true);
      }, 250);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        {/* Logo — scope */}
        <svg className="splash-logo" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
        <h1 className="splash-title">PORO SCOPE</h1>
        <div className="splash-flavor-wrap">
          <p className={`splash-flavor ${fade ? 'visible' : ''}`}>
            {FLAVOR_LINES[lineIndex]}
          </p>
        </div>
        <div className="splash-loader">
          <div className="splash-loader-fill" />
        </div>
      </div>
    </div>
  );
};
