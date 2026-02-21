/**
 * MainApp Component - Main application with home screen navigation
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Menu } from './Menu';
import { Camera } from './Camera';
import { CardResult } from './CardResult';
import { useCards } from '../hooks/useCards';
import { useNativeOCR, type OCRDebugInfo } from '../hooks/useNativeOCR';
import { useCardMatching } from '../hooks/useCardMatching';
import { useScanHistory } from '../hooks/useScanHistory';
import { dotGGClient } from '../api/dotgg';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { User, CardMatch, Game } from '../types';
import './MainApp.css';

interface MainAppProps {
  user: User;
  onLogout: () => void;
}

type ViewMode = 'home' | 'scanner' | 'collection' | 'history' | 'help' | 'settings';

const SUPPORTED_GAMES: { id: Game; name: string; enabled: boolean }[] = [
  { id: 'riftbound', name: 'Riftbound', enabled: true },
  { id: 'lorcana', name: 'Lorcana', enabled: false },
  { id: 'magic', name: 'Magic: The Gathering', enabled: false },
  { id: 'pokemon', name: 'Pokémon TCG', enabled: false },
];

export const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false);

  const [currentGame, setCurrentGame] = useState<Game>(() => {
    const saved = localStorage.getItem('cardscanner_game') as Game;
    return saved || 'riftbound';
  });

  // Collection state
  const [collectionCount, setCollectionCount] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [nickname, setNickname] = useState(user.username);

  // Scan state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CardMatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not_found' | 'saved' | 'error'>('idle');

  // Debug & preferences
  const [debugMode, setDebugMode] = useState(false);
  const [ocrDebugInfo, setOcrDebugInfo] = useState<OCRDebugInfo | null>(null);
  const [marketplace, setMarketplace] = useState<'cardmarket' | 'tcgplayer'>(() => {
    return (localStorage.getItem('cardscanner_marketplace') as 'cardmarket' | 'tcgplayer') || 'cardmarket';
  });

  const { cards, isLoading: cardsLoading, error: cardsError } = useCards();
  const { processImage, isProcessing } = useNativeOCR();
  const { findMatches, isMatching } = useCardMatching(cards);
  const { history, addEntry } = useScanHistory();

  useEffect(() => { localStorage.setItem('cardscanner_game', currentGame); }, [currentGame]);
  useEffect(() => { localStorage.setItem('cardscanner_marketplace', marketplace); }, [marketplace]);

  useEffect(() => { loadCollection(); }, [user]);

  const loadCollection = async () => {
    const result = await dotGGClient.getUserData(user);
    if (result.success && result.data) {
      if (result.data.user?.nickname) setNickname(result.data.user.nickname);
      const totalCards = result.data.collection.reduce((sum, item) =>
        sum + (parseInt(item.standard) || 0) + (parseInt(item.foil) || 0), 0);
      const uniqueCards = result.data.collection.filter(item =>
        (parseInt(item.standard) || 0) + (parseInt(item.foil) || 0) > 0).length;
      setCollectionCount(totalCards);
      setUniqueCount(uniqueCards);
    }
  };

  const handleGameSelect = (game: Game) => {
    const g = SUPPORTED_GAMES.find(g => g.id === game);
    if (!g?.enabled) return;
    setCurrentGame(game);
    setIsGameSelectorOpen(false);
  };

  // ---- Scan Logic ----
  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setScanStatus('scanning');
    setOcrDebugInfo(null);
    try {
      const ocrData = await processImage(imageData);
      if (ocrData.debug) setOcrDebugInfo(ocrData.debug);
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
      setOcrDebugInfo(prev => prev ?? {
        rawText: `[ERROR] ${err instanceof Error ? err.message : String(err)}`,
        confidence: 0, blocks: [], potentialTitles: [], numberMatch: null
      });
      setScanStatus('error');
      setShowCamera(false);
    }
  }, [processImage, findMatches]);

  const handleDirectCameraCapture = useCallback(async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 95, allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera, width: 2000
      });
      if (image.base64String) {
        handleCapture(`data:image/jpeg;base64,${image.base64String}`);
      }
    } catch (err) {
      console.log('Camera cancelled:', err);
    }
  }, [handleCapture, cards.length]);

  const handleSaveCard = useCallback(async (cardId: string, quantity: number, isFoil: boolean = false) => {
    setIsSaving(true);
    const isRemoval = quantity < 0;
    const apiQuantity = isRemoval ? 0 : quantity; // API: 0 removes, positive adds
    try {
      const result = await dotGGClient.addCardToCollection(user, cardId, apiQuantity, isFoil);
      if (result.success) {
        if (scanResult) {
          addEntry({
            cardId: scanResult.card.id,
            cardName: scanResult.card.name,
            cardNumber: scanResult.card.number,
            cardImage: scanResult.card.imageUrl || scanResult.card.image || '',
            action: isRemoval ? 'removed' : 'added',
            isFoil,
            quantity: Math.abs(quantity)
          });
        }
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
    } catch { setScanStatus('error'); }
    finally { setIsSaving(false); }
  }, [user, scanResult, addEntry]);

  const handleCloseResult = useCallback(() => {
    // Log skip to history
    if (scanResult) {
      addEntry({
        cardId: scanResult.card.id,
        cardName: scanResult.card.name,
        cardNumber: scanResult.card.number,
        cardImage: scanResult.card.imageUrl || scanResult.card.image || '',
        action: 'skipped', isFoil: false, quantity: 0
      });
    }
    setScanResult(null);
    setCapturedImage(null);
    setScanStatus('idle');
  }, [scanResult, addEntry]);

  // ---- Time formatting ----
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // ---- Render Views ----

  const renderHome = () => (
    <div className="home-view">
      {/* Greeting */}
      <div className="home-greeting">
        <h2 className="greeting-text">Welcome back,</h2>
        <h1 className="greeting-name">{nickname}</h1>
      </div>

      {/* Collection Card – Riftbound branded */}
      <div className="home-stats-card">
        <div className="stats-card-header">
          <span className="stats-game-badge">⚔️ Riftbound</span>
          <span className="stats-game-set">Origins · Spiritforged</span>
        </div>
        <div className="stats-row">
          <div className="stat-block">
            <span className="stat-number">{collectionCount}</span>
            <span className="stat-desc">Total Cards</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-block">
            <span className="stat-number">{uniqueCount}</span>
            <span className="stat-desc">Unique</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-block">
            <span className="stat-number">{cards.length}</span>
            <span className="stat-desc">Database</span>
          </div>
        </div>
      </div>

      {/* Action Tiles */}
      <div className="home-actions">
        <button className="action-tile action-scan" onClick={handleDirectCameraCapture}>
          <div className="action-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <span className="action-label">Scan</span>
          <span className="action-hint">Open camera</span>
        </button>
        <button className="action-tile action-library" onClick={() => setViewMode('collection')}>
          <div className="action-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <path d="M2 8h20"/>
              <path d="M9 3v5"/>
            </svg>
          </div>
          <span className="action-label">Library</span>
          <span className="action-hint">{uniqueCount} unique</span>
        </button>
        <button className="action-tile action-setup" onClick={() => setViewMode('settings')}>
          <div className="action-icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </div>
          <span className="action-label">Setup</span>
          <span className="action-hint">Game & account</span>
        </button>
      </div>

      {/* Recent Scans */}
      {history.length > 0 && (
        <div className="home-history">
          <div className="section-header">
            <h3>Recent Scans</h3>
            <button className="link-btn" onClick={() => setViewMode('history')}>
              View All
            </button>
          </div>
          <div className="history-list">
            {history.slice(0, 5).map((entry, i) => (
              <div
                key={i}
                className={`history-item ${entry.action === 'skipped' ? 'resumable' : ''}`}
                onClick={() => {
                  if (entry.action === 'skipped') {
                    // Resume: find card and re-open result
                    const card = cards.find(c => c.id === entry.cardId);
                    if (card) {
                      setScanResult({ card, confidence: 1, matchedBy: 'number' });
                      setScanStatus('found');
                    }
                  }
                }}
              >
                <div className="history-thumb">
                  {entry.cardImage ? (
                    <img src={entry.cardImage} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : null}
                  <span className="history-thumb-fallback">{entry.cardName[0]}</span>
                </div>
                <div className="history-info">
                  <span className="history-name">{entry.cardName}</span>
                  <span className="history-number">{entry.cardNumber}</span>
                </div>
                <div className="history-meta">
                  <span className={`history-badge ${entry.action}`}>
                    {entry.action === 'added' ? `✅ +${entry.quantity}${entry.isFoil ? ' ✨' : ''}`
                      : entry.action === 'removed' ? `🔻 −${entry.quantity}`
                      : '⏭ Tap to resume'}
                  </span>
                  <span className="history-time">{timeAgo(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state if no history */}
      {history.length === 0 && (
        <div className="home-empty-history">
          <p className="empty-hint">No scans yet — tap <strong>Scan Card</strong> to start!</p>
        </div>
      )}
    </div>
  );

  const renderScanner = () => (
    <>
      {showCamera ? (
        <Camera
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
          isProcessing={isProcessing || isMatching}
        />
      ) : (
        <div className="scanner-view">
          <div className="scanner-guide" onClick={handleDirectCameraCapture}>
            {/* Illustrated card frame */}
            <div className="scanner-card-illustration">
              <div className="illust-card">
                <div className="illust-card-art">
                  <span className="illust-icon">⚔️</span>
                </div>
                <div className="illust-card-name">Card Name</div>
                <div className="illust-card-text">
                  <div className="illust-line"></div>
                  <div className="illust-line short"></div>
                </div>
                <div className="illust-card-number">
                  <span className="illust-highlight">OGN-001</span>
                </div>
              </div>
              {/* Scan target corners */}
              <div className="scan-corners">
                <span className="corner top-left"></span>
                <span className="corner top-right"></span>
                <span className="corner bottom-left"></span>
                <span className="corner bottom-right"></span>
              </div>
              {/* Pulse ring */}
              <div className="scan-pulse"></div>
            </div>

            <div className="scanner-instructions">
              <h3>Tap to Scan</h3>
              <p>Hold your Riftbound card steady in good light.</p>
              <p className="scanner-tip">💡 Make sure the <strong>card number</strong> at the bottom is visible</p>
            </div>
          </div>

          {/* Scanning overlay */}
          {scanStatus === 'scanning' && (
            <div className="scanning-overlay">
              <div className="scanning-content">
                <div className="scanning-spinner" />
                <p>Analyzing card...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan failure overlay */}
      {(scanStatus === 'not_found' || scanStatus === 'error') && (
        <div className="scan-status-overlay">
          <div className="scan-status-content scan-status-detailed">
            <div className="scan-status-icon">{scanStatus === 'error' ? '⚠️' : '❓'}</div>
            <h3>{scanStatus === 'error' ? 'Scan failed' : 'No card recognized'}</h3>
            {ocrDebugInfo && (
              <div className="scan-diagnostics">
                <div className="diag-section">
                  <span className="diag-label">OCR Text:</span>
                  <pre className="diag-text">{ocrDebugInfo.rawText || '(nothing detected)'}</pre>
                </div>
                {ocrDebugInfo.numberMatch && (
                  <div className="diag-section">
                    <span className="diag-label">Number found:</span>
                    <span className="diag-value">{ocrDebugInfo.numberMatch}</span>
                  </div>
                )}
                <div className="diag-section">
                  <span className="diag-label">Confidence:</span>
                  <span className="diag-value">{(ocrDebugInfo.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            {capturedImage && <img src={capturedImage} alt="Scanned" className="scan-thumb" />}
            <div className="scan-status-actions">
              <button className="btn-primary" onClick={() => { setScanStatus('idle'); handleDirectCameraCapture(); }}>
                🔄 Try Again
              </button>
              <button className="btn-secondary" onClick={() => { setScanStatus('idle'); setOcrDebugInfo(null); setCapturedImage(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderCollection = () => (
    <div className="view-page">
      <div className="view-page-header">
        <button className="back-btn" onClick={() => setViewMode('home')}>← Back</button>
        <h2>My Collection</h2>
      </div>
      <div className="view-page-body">
        <div className="collection-stats-row">
          <div className="collection-stat">
            <span className="cs-value">{collectionCount}</span>
            <span className="cs-label">Total</span>
          </div>
          <div className="collection-stat">
            <span className="cs-value">{uniqueCount}</span>
            <span className="cs-label">Unique</span>
          </div>
          <div className="collection-stat">
            <span className="cs-value">{cards.length}</span>
            <span className="cs-label">Known</span>
          </div>
        </div>
        <p className="placeholder-text">Collection grid coming soon...</p>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="view-page">
      <div className="view-page-header">
        <button className="back-btn" onClick={() => setViewMode('home')}>← Back</button>
        <h2>Activity Log</h2>
      </div>
      <div className="view-page-body">
        {history.length === 0 ? (
          <p className="placeholder-text">No activity yet.</p>
        ) : (
          <div className="activity-log">
            {history.map((entry, i) => (
              <div key={i} className="activity-entry">
                <div className="activity-dot-line">
                  <div className={`activity-dot ${entry.action}`} />
                  {i < history.length - 1 && <div className="activity-line" />}
                </div>
                <div className="activity-content">
                  <p className="activity-text">
                    {entry.action === 'added'
                      ? <>Added <strong>{entry.cardName}</strong>{entry.isFoil ? ' (Foil)' : ''} ×{entry.quantity} to Riftbound Collection</>
                      : <>Scanned <strong>{entry.cardName}</strong> — skipped</>
                    }
                  </p>
                  <div className="activity-detail">
                    <span className="activity-number">{entry.cardNumber}</span>
                    <span className="activity-time">{timeAgo(entry.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="view-page">
      <div className="view-page-header">
        <button className="back-btn" onClick={() => setViewMode('home')}>← Back</button>
        <h2>Setup</h2>
      </div>
      <div className="view-page-body">
        <div className="settings-section">
          <h3 className="settings-title">Account</h3>
          <div className="settings-card">
            <div className="settings-row">
              <span className="settings-label">Username</span>
              <span className="settings-value">{nickname}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Email</span>
              <span className="settings-value">{user.email}</span>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3 className="settings-title">Game</h3>
          <div className="settings-card">
            <button className="settings-row clickable" onClick={() => setIsGameSelectorOpen(true)}>
              <span className="settings-label">Current Game</span>
              <span className="settings-value">{currentGame.charAt(0).toUpperCase() + currentGame.slice(1)} →</span>
            </button>
          </div>
        </div>
        <div className="settings-section">
          <h3 className="settings-title">Marketplace</h3>
          <div className="settings-card">
            <button className="settings-row clickable" onClick={() => setMarketplace(marketplace === 'cardmarket' ? 'tcgplayer' : 'cardmarket')}>
              <span className="settings-label">Price Source</span>
              <span className="settings-value">{marketplace === 'cardmarket' ? 'Cardmarket' : 'TCGPlayer'}</span>
            </button>
          </div>
        </div>
        <div className="settings-section">
          <h3 className="settings-title">Tools</h3>
          <div className="settings-card">
            <button className="settings-row clickable" onClick={() => setDebugMode(!debugMode)}>
              <span className="settings-label">Debug Mode</span>
              <span className="settings-value">{debugMode ? '🐛 ON' : 'OFF'}</span>
            </button>
            <button className="settings-row clickable" onClick={() => setViewMode('history')}>
              <span className="settings-label">Activity Log</span>
              <span className="settings-value">{history.length} entries →</span>
            </button>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'home': return renderHome();
      case 'scanner': return renderScanner();
      case 'collection': return renderCollection();
      case 'history': return renderHistory();
      case 'settings': return renderSettings();
      case 'help': return renderScanner(); // redirect to scanner
      default: return renderHome();
    }
  };

  return (
    <div className="main-app">
      {/* Header */}
      <header className="app-header">
        <button className="menu-toggle-btn" onClick={() => setIsMenuOpen(true)} aria-label="Open menu">
          <span className="hamburger-icon">☰</span>
        </button>
        <h1 className="app-title">Riftbound Scanner</h1>
        {viewMode !== 'home' && (
          <button className="header-home-btn" onClick={() => setViewMode('home')} aria-label="Home">
            <span>🏠</span>
          </button>
        )}
        {viewMode === 'home' && <div style={{ width: 40 }} />}
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

      {/* Toast */}
      {scanStatus === 'saved' && (
        <div className="recent-scan-toast success">✅ Card added to collection!</div>
      )}

      {/* Slide-out Menu */}
      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        currentGame={currentGame}
        onSelectGame={() => { setIsMenuOpen(false); setIsGameSelectorOpen(true); }}
        onViewCollection={() => { setIsMenuOpen(false); setViewMode('collection'); }}
        onViewHelp={() => { setIsMenuOpen(false); setViewMode('scanner'); }}
        onViewSettings={() => { setIsMenuOpen(false); setViewMode('settings'); }}
        onLogout={onLogout}
      />

      {/* Game Selector */}
      {isGameSelectorOpen && (
        <div className="game-selector-modal" onClick={() => setIsGameSelectorOpen(false)}>
          <div className="game-selector-content" onClick={e => e.stopPropagation()}>
            <h3>Select Game</h3>
            {SUPPORTED_GAMES.map(game => (
              <button
                key={game.id}
                className={`game-option ${currentGame === game.id ? 'active' : ''} ${!game.enabled ? 'disabled' : ''}`}
                onClick={() => handleGameSelect(game.id)}
                disabled={!game.enabled}
              >
                <span className="game-option-name">{game.name}</span>
                {!game.enabled && <span className="coming-soon-badge">Coming Soon</span>}
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
          debugMode={debugMode}
          marketplace={marketplace}
        />
      )}

      {/* Debug View */}
      {debugMode && ocrDebugInfo && (
        <div className="debug-modal" onClick={() => setOcrDebugInfo(null)}>
          <div className="debug-content" onClick={e => e.stopPropagation()}>
            <div className="debug-header">
              <h3>🔍 OCR Debug Info</h3>
              <button className="debug-close" onClick={() => setOcrDebugInfo(null)}>✕</button>
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
              {scanResult && (
                <div className="debug-section debug-match">
                  <h4>✓ Matched Card</h4>
                  <p><strong>{scanResult.card.name}</strong></p>
                  <p>{scanResult.card.number} ({scanResult.matchedBy})</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
