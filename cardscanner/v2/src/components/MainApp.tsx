/**
 * MainApp Component - Main application with menu navigation
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Menu } from './Menu';
import { Camera } from './Camera';
import { CardResult } from './CardResult';
import { useCards } from '../hooks/useCards';
import { useOCR, type OCRDebugInfo } from '../hooks/useOCR';
import { useCardMatching } from '../hooks/useCardMatching';
import { dotGGClient } from '../api/dotgg';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { User, CardMatch, Game } from '../types';
import './MainApp.css';

interface MainAppProps {
  user: User;
  onLogout: () => void;
}

type ViewMode = 'camera' | 'collection' | 'help' | 'settings';

export const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('camera');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false);
  
  // Game state
  const [currentGame, setCurrentGame] = useState<Game>(() => {
    const saved = localStorage.getItem('cardscanner_game') as Game;
    return saved || 'riftbound';
  });
  
  // Collection state
  const [collectionCount, setCollectionCount] = useState(0);
  
  // Scan state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CardMatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not_found' | 'saved' | 'error'>('idle');
  
  // Debug state
  const [debugMode, setDebugMode] = useState(false);
  const [ocrDebugInfo, setOcrDebugInfo] = useState<OCRDebugInfo | null>(null);

  const { cards, isLoading: cardsLoading, error: cardsError } = useCards();
  const { processImage, isProcessing } = useOCR();
  const { findMatches, isMatching } = useCardMatching(cards);

  // Save game selection
  useEffect(() => {
    localStorage.setItem('cardscanner_game', currentGame);
  }, [currentGame]);

  // Load collection on mount
  useEffect(() => {
    loadCollection();
  }, [user]);

  const loadCollection = async () => {
    const result = await dotGGClient.getUserData(user);
    if (result.success && result.data) {
      const totalCards = result.data.collection.reduce((sum, item) => {
        return sum + (parseInt(item.standard) || 0);
      }, 0);
      setCollectionCount(totalCards);
    }
  };

  const handleGameSelect = (game: Game) => {
    setCurrentGame(game);
    setIsGameSelectorOpen(false);
    // TODO: Reload card database for new game
  };

  // Direct camera capture - opens native camera immediately
const handleDirectCameraCapture = useCallback(async () => {
  try {
    const image = await CapacitorCamera.getPhoto({
      quality: 95,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      width: 2000
    });

    if (image.base64String) {
      const imageData = `data:image/jpeg;base64,${image.base64String}`;
      handleCapture(imageData);
    }
  } catch (err) {
    // User cancelled or error
    console.log('Camera cancelled or error:', err);
  }
}, []);

const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setScanStatus('scanning');
    setOcrDebugInfo(null);
    
    try {
      const ocrData = await processImage(imageData);
      
      // Save debug info if available
      if (ocrData.debug) {
        setOcrDebugInfo(ocrData.debug);
      }
      
      const result = await findMatches(ocrData);
      
      if (result.bestMatch) {
        setScanResult(result.bestMatch);
        setScanStatus('found');
      } else {
        setScanResult(null);
        setScanStatus('not_found');
      }
      setShowCamera(false);
    } catch (err) {
      console.error('Scan error:', err);
      setScanStatus('error');
      setShowCamera(false);
    }
  }, [processImage, findMatches]);

  const handleSaveCard = useCallback(async (cardId: string, quantity: number, isFoil: boolean = false) => {
    setIsSaving(true);

    try {
      const result = await dotGGClient.addCardToCollection(user, cardId, quantity, isFoil);
      
      if (result.success) {
        setScanStatus('saved');
        await loadCollection();
        setTimeout(() => {
          setScanResult(null);
          setCapturedImage(null);
          setScanStatus('idle');
        }, 1500);
      } else {
        setScanStatus('error');
      }
    } catch (err) {
      setScanStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const handleCloseResult = useCallback(() => {
    setScanResult(null);
    setCapturedImage(null);
    setScanStatus('idle');
  }, []);

  // Render different views
  const renderContent = () => {
    if (viewMode === 'collection') {
      return (
        <div className="placeholder-view">
          <h2>My Collection</h2>
          <p>{collectionCount} cards total</p>
          <button onClick={() => setViewMode('camera')}>Back to Scanner</button>
        </div>
      );
    }

    if (viewMode === 'help') {
      return (
        <div className="placeholder-view">
          <h2>How to Scan</h2>
          <ul>
            <li>📷 Hold card steady in good light</li>
            <li>🎯 Center the card in the frame</li>
            <li>✨ Avoid glare and shadows</li>
            <li>🔍 Make sure text is readable</li>
          </ul>
          <button onClick={() => setViewMode('camera')}>Back to Scanner</button>
        </div>
      );
    }

    // Camera view (default)
    return (
      <>
        {/* Camera Preview */}
        {showCamera ? (
          <Camera 
            onCapture={handleCapture}
            onClose={() => setShowCamera(false)}
            isProcessing={isProcessing || isMatching}
          />
        ) : (
          <div className="camera-placeholder-container" onClick={handleDirectCameraCapture}>
            <div className="camera-preview-box">
              <div className="camera-icon-large">📷</div>
              <p className="camera-tap-text">Tap to scan a card</p>
              <p className="camera-hint">Center the card in frame</p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-item">
            <span className="stat-value">{collectionCount}</span>
            <span className="stat-label">cards</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{currentGame}</span>
            <span className="stat-label">game</span>
          </div>
        </div>

        {/* Scan Status Feedback */}
        {scanStatus === 'saved' && (
          <div className="recent-scan-toast success">
            ✅ Card added to collection!
          </div>
        )}
        
        {scanStatus === 'not_found' && (
          <div className="scan-status-overlay">
            <div className="scan-status-content">
              <div className="scan-status-icon">❓</div>
              <h3>No card recognized</h3>
              <p>Try again with better lighting and hold the card steady</p>
              {debugMode && ocrDebugInfo && (
                <button 
                  className="btn-debug"
                  onClick={() => {
                    setScanStatus('idle'); // Close overlay to show debug modal
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  🔍 View Debug Info
                </button>
              )}
              <div className="scan-status-actions">
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setScanStatus('idle');
                    setShowCamera(true);
                  }}
                >
                  🔄 Try Again
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setScanStatus('idle')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {scanStatus === 'error' && (
          <div className="scan-status-overlay">
            <div className="scan-status-content">
              <div className="scan-status-icon">⚠️</div>
              <h3>Scan failed</h3>
              <p>Something went wrong. Please try again.</p>
              {debugMode && ocrDebugInfo && (
                <button 
                  className="btn-debug"
                  onClick={() => {
                    setScanStatus('idle'); // Close overlay to show debug modal
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  🔍 View Debug Info
                </button>
              )}
              <div className="scan-status-actions">
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setScanStatus('idle');
                    setShowCamera(true);
                  }}
                >
                  🔄 Retry
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setScanStatus('idle')}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="main-app">
      {/* Header with Menu Button */}
      <header className="app-header">
        <button 
          className="menu-toggle-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open menu"
        >
          <span className="hamburger-icon">☰</span>
        </button>
        <h1 className="app-title">Card Scanner</h1>
        <button 
          className="debug-toggle-btn"
          onClick={() => setDebugMode(!debugMode)}
          aria-label="Toggle debug mode"
          title={debugMode ? "Debug mode ON" : "Debug mode OFF"}
        >
          <span className={debugMode ? "debug-active" : "debug-inactive"}>🐛</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {cardsLoading ? (
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Loading {currentGame} cards...</p>
          </div>
        ) : cardsError ? (
          <div className="error-state">
            <p>Failed to load cards</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Slide-out Menu */}
      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        currentGame={currentGame}
        onSelectGame={() => {
          setIsMenuOpen(false);
          setIsGameSelectorOpen(true);
        }}
        onViewCollection={() => {
          setIsMenuOpen(false);
          setViewMode('collection');
        }}
        onViewHelp={() => {
          setIsMenuOpen(false);
          setViewMode('help');
        }}
        onViewSettings={() => {
          setIsMenuOpen(false);
          setViewMode('settings');
        }}
        onLogout={onLogout}
      />

      {/* Game Selector Modal */}
      {isGameSelectorOpen && (
        <div className="game-selector-modal" onClick={() => setIsGameSelectorOpen(false)}>
          <div className="game-selector-content" onClick={e => e.stopPropagation()}>
            <h3>Select Game</h3>
            {['riftbound', 'lorcana', 'magic', 'pokemon'].map(game => (
              <button
                key={game}
                className={`game-option ${currentGame === game ? 'active' : ''}`}
                onClick={() => handleGameSelect(game as Game)}
              >
                {game.charAt(0).toUpperCase() + game.slice(1)}
              </button>
            ))}
            <button onClick={() => setIsGameSelectorOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Card Result Modal */}
      {scanResult !== null && (
        <CardResult
          match={scanResult}
          capturedImage={capturedImage}
          onSave={handleSaveCard}
          onClose={handleCloseResult}
          isSaving={isSaving}
        />
      )}
      
      {/* Debug View Modal */}
      {debugMode && ocrDebugInfo && (
        <div className="debug-modal" onClick={() => setOcrDebugInfo(null)}>
          <div className="debug-content" onClick={e => e.stopPropagation()}>
            <div className="debug-header">
              <h3>🔍 OCR Debug Info</h3>
              <button 
                className="debug-close"
                onClick={() => setOcrDebugInfo(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="debug-body">
              <div className="debug-section">
                <h4>Raw OCR Text</h4>
                <pre className="debug-text">{ocrDebugInfo.rawText || '(no text)'}</pre>
              </div>
              
              <div className="debug-grid">
                <div className="debug-section">
                  <h4>Detected Number</h4>
                  <p className="debug-value">{ocrDebugInfo.numberMatch || 'None'}</p>
                </div>
                
                <div className="debug-section">
                  <h4>OCR Confidence</h4>
                  <p className="debug-value">{ocrDebugInfo.confidence?.toFixed(1) || 'N/A'}%</p>
                </div>
              </div>
              
              <div className="debug-section">
                <h4>Potential Titles ({ocrDebugInfo.potentialTitles?.length || 0})</h4>
                <ul className="debug-list">
                  {ocrDebugInfo.potentialTitles?.map((title, i) => (
                    <li key={i}>{title}</li>
                  )) || <li>No titles found</li>}
                </ul>
              </div>
              
              {scanResult && (
                <div className="debug-section debug-match">
                  <h4>✓ Matched Card</h4>
                  <p><strong>{scanResult.card.name}</strong></p>
                  <p>{scanResult.card.number} ({scanResult.matchedBy})</p>
                  <p>Match confidence: {(scanResult.confidence * 100).toFixed(0)}%</p>
                </div>
              )}
              
              {capturedImage && (
                <div className="debug-section">
                  <h4>Processed Image</h4>
                  <img 
                    src={ocrDebugInfo.processedImage || capturedImage} 
                    alt="Processed"
                    className="debug-image"
                  />
                </div>
              )}
              
              <div className="debug-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setOcrDebugInfo(null);
                    setShowCamera(true);
                  }}
                >
                  📷 New Scan
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    // Retry with same image
                    if (capturedImage) {
                      setOcrDebugInfo(null);
                      handleCapture(capturedImage);
                    }
                  }}
                >
                  🔄 Re-scan Same
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
