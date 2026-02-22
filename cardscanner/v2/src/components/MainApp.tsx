/**
 * MainApp Component - Main application with home screen navigation
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Menu } from './Menu';
import { Camera } from './Camera';
import { CardResult } from './CardResult';
import { BatchSetup } from './BatchSetup';
import { BatchSummary } from './BatchSummary';
import { useCards } from '../hooks/useCards';
import { useNativeOCR, type OCRDebugInfo } from '../hooks/useNativeOCR';
import { useCardMatching } from '../hooks/useCardMatching';
import { useScanHistory } from '../hooks/useScanHistory';
import { dotGGClient } from '../api/dotgg';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { User, CardMatch, Game, UserData, BatchAction, BatchResultEntry } from '../types';
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
  const [collectionValue, setCollectionValue] = useState(0);
  const [nickname, setNickname] = useState(user.username);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Batch scan state
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [batchAction, setBatchAction] = useState<BatchAction>('auto-add-standard');
  const [batchResults, setBatchResults] = useState<BatchResultEntry[]>([]);
  const [showBatchSetup, setShowBatchSetup] = useState(false);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const [batchToast, setBatchToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  // Gyroscope / device motion for parallax
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const x = Math.max(-15, Math.min(15, (e.gamma || 0) * 0.3));
      const y = Math.max(-15, Math.min(15, ((e.beta || 0) - 45) * 0.3));
      tiltRef.current = { x, y };
    };
    const animate = () => {
      setTilt(prev => ({
        x: prev.x + (tiltRef.current.x - prev.x) * 0.08,
        y: prev.y + (tiltRef.current.y - prev.y) * 0.08
      }));
      rafId = requestAnimationFrame(animate);
    };
    let rafId = requestAnimationFrame(animate);
    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const tiltStyle = (intensity: number = 1) => ({
    transform: `translate(${tilt.x * intensity}px, ${tilt.y * intensity}px)`,
  });

  useEffect(() => { localStorage.setItem('cardscanner_game', currentGame); }, [currentGame]);
  useEffect(() => { localStorage.setItem('cardscanner_marketplace', marketplace); }, [marketplace]);

  const loadCollection = useCallback(async () => {
    const result = await dotGGClient.getUserData(user);
    if (result.success && result.data) {
      if (result.data.user?.nickname) setNickname(result.data.user.nickname);
      setUserData(result.data);
      let total = 0, unique = 0, value = 0;
      for (const item of result.data.collection) {
        const std = parseInt(item.standard) || 0;
        const foil = parseInt(item.foil) || 0;
        const count = std + foil;
        if (count > 0) {
          total += count;
          unique++;
          // Match to card data for price
          const card = cards.find(c => c.id === item.card);
          if (card) {
            const useCardmarket = marketplace === 'cardmarket';
            const stdPrice = useCardmarket ? (card.cmPrice || 0) : (card.price || 0);
            const foilPr = useCardmarket ? (card.cmFoilPrice || 0) : (card.foilPrice || 0);
            value += std * stdPrice + foil * (foilPr || stdPrice);
          }
        }
      }
      setCollectionCount(total);
      setUniqueCount(unique);
      setCollectionValue(value);
    }
  }, [user, cards, marketplace]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  const handleGameSelect = (game: Game) => {
    const g = SUPPORTED_GAMES.find(g => g.id === game);
    if (!g?.enabled) return;
    setCurrentGame(game);
    setIsGameSelectorOpen(false);
  };

  // ---- Batch helpers ----
  const showBatchToast = useCallback((message: string, type: 'success' | 'error') => {
    setBatchToast({ message, type });
    setTimeout(() => setBatchToast(null), type === 'success' ? 600 : 500);
  }, []);

  const continueBatchScan = useCallback(() => {
    // Small delay then trigger next camera capture
    setTimeout(() => {
      setScanResult(null);
      setCapturedImage(null);
      setScanStatus('idle');
      setOcrDebugInfo(null);
      handleDirectCameraCapture();
    }, 300);
  }, [/* handleDirectCameraCapture added below via ref */]);

  // Use ref to break circular dependency
  const continueBatchScanRef = useRef(continueBatchScan);
  continueBatchScanRef.current = continueBatchScan;

  const batchAutoSave = useCallback(async (match: CardMatch, isFoil: boolean) => {
    try {
      const cardId = match.card.id;
      const existingItem = userData?.collection.find(c => c.card === cardId);
      const currentCount = isFoil
        ? (parseInt(existingItem?.foil || '0'))
        : (parseInt(existingItem?.standard || '0'));
      const newCount = currentCount + 1;

      const result = await dotGGClient.addCardToCollection(user, cardId, newCount, isFoil);
      if (result.success) {
        addEntry({
          cardId: match.card.id,
          cardName: match.card.name,
          cardNumber: match.card.number,
          cardImage: match.card.imageUrl || match.card.image || '',
          action: 'added',
          isFoil,
          quantity: 1
        });
        setBatchResults(prev => [...prev, {
          cardId: match.card.id,
          cardName: match.card.name,
          cardNumber: match.card.number,
          cardImage: match.card.imageUrl || match.card.image || '',
          status: 'added'
        }]);
        setBatchCount(prev => prev + 1);
        showBatchToast(`✅ ${match.card.name}`, 'success');
      } else {
        setBatchResults(prev => [...prev, {
          cardId: match.card.id,
          cardName: match.card.name,
          cardNumber: match.card.number,
          cardImage: match.card.imageUrl || match.card.image || '',
          status: 'failed',
          error: 'Save failed'
        }]);
        showBatchToast(`❌ Save failed`, 'error');
      }
    } catch (err) {
      setBatchResults(prev => [...prev, {
        cardId: match.card.id,
        cardName: match.card.name,
        cardNumber: match.card.number,
        cardImage: match.card.imageUrl || match.card.image || '',
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      }]);
      showBatchToast(`❌ Error saving`, 'error');
    }
    // Always continue in batch mode regardless of success/failure
    continueBatchScanRef.current();
  }, [user, userData, addEntry, showBatchToast]);

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

        // Auto-add in batch mode (non-review)
        if (batchMode && batchAction !== 'review-each') {
          const isFoil = batchAction === 'auto-add-foil';
          batchAutoSave(result.bestMatch, isFoil);
          return;
        }
      } else {
        setScanResult(null);
        setScanStatus('not_found');

        // In batch auto-add mode, skip and continue
        if (batchMode && batchAction !== 'review-each') {
          setBatchResults(prev => [...prev, {
            cardId: '', cardName: '', cardNumber: '',
            cardImage: '', status: 'not_found', error: 'No match'
          }]);
          showBatchToast('❌ No match — skipping', 'error');
          continueBatchScanRef.current();
          return;
        }
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

      // In batch auto-add mode, don't die — continue
      if (batchMode && batchAction !== 'review-each') {
        setBatchResults(prev => [...prev, {
          cardId: '', cardName: '', cardNumber: '',
          cardImage: '', status: 'failed', error: 'OCR/scan error'
        }]);
        showBatchToast('❌ Scan error — skipping', 'error');
        continueBatchScanRef.current();
        return;
      }
    }
  }, [processImage, findMatches, batchMode, batchAction, batchAutoSave, showBatchToast]);

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
      // If camera was cancelled during batch mode, end the batch
      if (batchMode) {
        endBatchMode();
      }
    }
  }, [handleCapture, cards.length, batchMode]);

  // End batch mode and show summary
  const endBatchMode = useCallback(() => {
    setBatchMode(false);
    setScanStatus('idle');
    setScanResult(null);
    setCapturedImage(null);
    setOcrDebugInfo(null);
    if (batchResults.length > 0) {
      setShowBatchSummary(true);
    }
    // Reload collection once at end of batch
    loadCollection();
  }, [batchResults.length, loadCollection]);

  const handleSaveCard = useCallback(async (cardId: string, deltaQuantity: number, isFoil: boolean = false) => {
    setIsSaving(true);
    
    // CRITICAL: API expects ABSOLUTE values, not deltas!
    const existingItem = userData?.collection.find(c => c.card === cardId);
    const currentStd = parseInt(existingItem?.standard || '0');
    const currentFoil = parseInt(existingItem?.foil || '0');
    const currentCount = isFoil ? currentFoil : currentStd;
    const newCount = Math.max(0, currentCount + deltaQuantity);
    
    try {
      const result = await dotGGClient.addCardToCollection(user, cardId, newCount, isFoil);
      if (result.success) {
        if (scanResult) {
          addEntry({
            cardId: scanResult.card.id,
            cardName: scanResult.card.name,
            cardNumber: scanResult.card.number,
            cardImage: scanResult.card.imageUrl || scanResult.card.image || '',
            action: newCount === 0 ? 'removed' : (deltaQuantity < 0 ? 'removed' : 'added'),
            isFoil,
            quantity: Math.abs(deltaQuantity)
          });
        }
        setScanStatus('saved');

        if (batchMode) {
          // Track result for summary
          if (scanResult) {
            setBatchResults(prev => [...prev, {
              cardId: scanResult.card.id,
              cardName: scanResult.card.name,
              cardNumber: scanResult.card.number,
              cardImage: scanResult.card.imageUrl || scanResult.card.image || '',
              status: 'added'
            }]);
          }
          setBatchCount(prev => prev + 1);
          // Don't reload collection mid-batch — do it at the end
          setTimeout(() => {
            setScanResult(null);
            setCapturedImage(null);
            setScanStatus('idle');
            handleDirectCameraCapture();
          }, 800);
        } else {
          await loadCollection();
          setTimeout(() => {
            setScanResult(null);
            setCapturedImage(null);
            setScanStatus('idle');
          }, 1500);
        }
      } else {
        setScanStatus('error');
        // In batch review mode, don't die — let user retry or skip
      }
    } catch {
      setScanStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [user, scanResult, addEntry, userData, batchMode, handleDirectCameraCapture, loadCollection]);

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
      // Track skip in batch results
      if (batchMode) {
        setBatchResults(prev => [...prev, {
          cardId: scanResult.card.id,
          cardName: scanResult.card.name,
          cardNumber: scanResult.card.number,
          cardImage: scanResult.card.imageUrl || scanResult.card.image || '',
          status: 'skipped'
        }]);
      }
    }
    setScanResult(null);
    setCapturedImage(null);
    setScanStatus('idle');

    // In batch review mode, continue to next scan
    if (batchMode && batchAction === 'review-each') {
      setTimeout(() => handleDirectCameraCapture(), 300);
    }
  }, [scanResult, addEntry, batchMode, batchAction, handleDirectCameraCapture]);

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
      <div className="home-greeting anim-fade-in">
        <h2 className="greeting-text">Greetings,</h2>
        <h1 className="greeting-name">{nickname}</h1>
      </div>

      {/* Collection Module – Riftbound compact */}
      <div className="home-stats-card glow-border anim-fade-in-delay-1" style={tiltStyle(0.5)}>
        {/* Mini card tabs at top */}
        <div className="set-tabs">
          <div className="set-tab set-tab-origins active" title="Origins">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/>
            </svg>
            <span>OGN</span>
          </div>
          <div className="set-tab set-tab-spiritforged" title="Spiritforged — coming soon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>SPF</span>
          </div>
        </div>
        <div className="stats-card-body">
          <div className="stats-left">
            <div className="stats-compact-row">
              <div className="stat-pill">
                <span className="stat-pill-num">{collectionCount}</span>
                <span className="stat-pill-label">cards</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-num">{uniqueCount}</span>
                <span className="stat-pill-label">unique</span>
              </div>
            </div>
            {collectionValue > 0 && (
              <div className="stats-value-row">
                <span className="stats-value-amount">
                  {marketplace === 'cardmarket' ? '€' : '$'}{collectionValue.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="stats-eyecandy" style={tiltStyle(1.2)}>
            {/* Stacked cards illustration */}
            <div className="card-stack">
              <div className="mini-card mc-3"></div>
              <div className="mini-card mc-2"></div>
              <div className="mini-card mc-1">
                <span className="mc-icon">⚔️</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Tiles – Split Single/Batch */}
      <div className="home-scan-row anim-fade-in-delay-2">
        <button className="scan-tile scan-single glow-border" onClick={() => { setBatchMode(false); handleDirectCameraCapture(); }}>
          <div className="scan-tile-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div className="scan-tile-text">
            <span className="scan-tile-label">Single Scan</span>
            <span className="scan-tile-hint">Scan & review one card</span>
          </div>
        </button>
        <button className="scan-tile scan-batch glow-border" onClick={() => setShowBatchSetup(true)}>
          <div className="scan-tile-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="16" height="14" rx="2"/>
              <path d="M6 2h16a2 2 0 0 1 2 2v12"/>
              <circle cx="10" cy="13" r="3"/>
            </svg>
          </div>
          <div className="scan-tile-text">
            <span className="scan-tile-label">Batch Scan</span>
            <span className="scan-tile-hint">Rapid-fire, auto-save</span>
          </div>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="home-actions anim-fade-in-delay-3">
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
              {batchMode && batchAction === 'review-each' && (
                <button className="btn-primary" onClick={() => {
                  setBatchResults(prev => [...prev, {
                    cardId: '', cardName: '', cardNumber: '',
                    cardImage: '', status: 'not_found', error: 'Skipped'
                  }]);
                  setScanStatus('idle');
                  handleDirectCameraCapture();
                }}>
                  ⏭ Skip & Next
                </button>
              )}
              <button className="btn-secondary" onClick={() => {
                setScanStatus('idle'); setOcrDebugInfo(null); setCapturedImage(null);
                if (batchMode) endBatchMode();
              }}>
                {batchMode ? 'Stop Batch' : 'Cancel'}
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
        <div className="app-title-group" style={tiltStyle(0.3)}>
          <svg className="app-logo-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          <h1 className="app-title">PORO SCOPE</h1>
        </div>
        {viewMode !== 'home' ? (
          <button className="header-home-btn" onClick={() => setViewMode('home')} aria-label="Home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/>
            </svg>
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
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

      {/* Batch Mode Banner — always visible when batch is active */}
      {batchMode && (
        <div className="batch-banner">
          <span className="batch-banner-text">⚡ {batchAction === 'review-each' ? 'Batch Review' : 'Auto-Add'}</span>
          <span className="batch-banner-count">{batchCount} added</span>
          <button className="batch-banner-stop" onClick={endBatchMode}>Stop</button>
        </div>
      )}

      {/* Batch toast (auto-add feedback) */}
      {batchToast && (
        <div className={`recent-scan-toast ${batchToast.type === 'success' ? 'success' : 'error'}`}>
          {batchToast.message}
        </div>
      )}

      {/* Single mode save toast */}
      {!batchMode && scanStatus === 'saved' && (
        <div className="recent-scan-toast success">
          ✅ Card added to collection!
        </div>
      )}

      {/* Slide-out Menu */}
      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        nickname={nickname}
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

      {/* Batch Setup Modal */}
      {showBatchSetup && (
        <BatchSetup
          onStart={(action) => {
            setShowBatchSetup(false);
            setBatchMode(true);
            setBatchAction(action);
            setBatchCount(0);
            setBatchResults([]);
            handleDirectCameraCapture();
          }}
          onCancel={() => setShowBatchSetup(false)}
        />
      )}

      {/* Batch Summary Modal */}
      {showBatchSummary && (
        <BatchSummary
          results={batchResults}
          onDone={() => {
            setShowBatchSummary(false);
            setBatchResults([]);
          }}
        />
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
          userData={userData}
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
