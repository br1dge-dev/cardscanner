/**
 * MainApp Component - Main application logic
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Camera as CameraIcon, LogOut, User as UserIcon, Library } from 'lucide-react';
import { Camera } from './Camera';
import { CardResult } from './CardResult';
import { useCards } from '../hooks/useCards';
import { useOCR } from '../hooks/useOCR';
import { useCardMatching } from '../hooks/useCardMatching';
import { dotGGClient } from '../api/dotgg';
import type { User, CardMatch } from '../types';
import './MainApp.css';

interface MainAppProps {
  user: User;
  onLogout: () => void;
}

type ScanStatus = 'idle' | 'scanning' | 'found' | 'not_found' | 'saving' | 'saved' | 'error';

export const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CardMatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [collectionCount, setCollectionCount] = useState(0);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanProgress, setScanProgress] = useState('');

  const { cards, isLoading: cardsLoading, error: cardsError, totalCards } = useCards();
  const { processImage, isProcessing, terminateWorker } = useOCR();
  const { findMatches, isMatching } = useCardMatching(cards);

  // Load user's collection data on mount
  useEffect(() => {
    const loadCollection = async () => {
      const result = await dotGGClient.getUserData(user);
      if (result.success && result.data) {
        // Calculate total cards (sum of all quantities, not just unique entries)
        const totalCards = result.data.collection.reduce((sum, item) => {
          return sum + (parseInt(item.standard) || 0);
        }, 0);
        setCollectionCount(totalCards);
      }
    };
    loadCollection();
  }, [user]);

  // Cleanup on unmount (ML Kit has no workers to terminate)
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, [terminateWorker]);

  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setScanStatus('scanning');
    setScanProgress('Reading card text...');
    
    try {
      // Process image with OCR
      const ocrData = await processImage(imageData);
      setScanProgress('Finding matching card...');
      
      // Find matching cards
      const result = await findMatches(ocrData);
      
      if (result.bestMatch) {
        setScanStatus('found');
        setScanResult(result.bestMatch);
      } else {
        setScanStatus('not_found');
        setScanResult(null);
      }
      setShowCamera(false);
    } catch (err) {
      console.error('Scan error:', err);
      setScanStatus('error');
      setScanResult(null);
      setShowCamera(false);
    }
  }, [processImage, findMatches]);

  const handleSaveCard = useCallback(async (cardId: string, quantity: number) => {
    setIsSaving(true);
    setScanStatus('saving');
    setSaveMessage('Adding to collection...');

    try {
      const result = await dotGGClient.addCardToCollection(user, cardId, quantity);
      
      if (result.success) {
        setScanStatus('saved');
        setSaveMessage(`✓ Added ${quantity}x ${scanResult?.card.name || 'card'} to collection!`);
        // Reload actual collection count from API to ensure accuracy
        const userData = await dotGGClient.getUserData(user);
        if (userData.success && userData.data) {
          const totalCards = userData.data.collection.reduce((sum, item) => {
            return sum + (parseInt(item.standard) || 0);
          }, 0);
          setCollectionCount(totalCards);
        }
        setTimeout(() => {
          setScanResult(null);
          setCapturedImage(null);
          setSaveMessage(null);
          setScanStatus('idle');
        }, 2000);
      } else {
        setScanStatus('error');
        setSaveMessage(result.error || 'Failed to save card');
      }
    } catch (err) {
      setScanStatus('error');
      setSaveMessage('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user, scanResult]);

  const handleCloseResult = useCallback(() => {
    setScanResult(null);
    setCapturedImage(null);
    setScanStatus('idle');
    setScanProgress('');
    setSaveMessage(null);
  }, []);

  if (showCamera) {
    return (
      <Camera 
        onCapture={handleCapture}
        onClose={() => setShowCamera(false)}
        isProcessing={isProcessing || isMatching}
      />
    );
  }

  return (
    <div className="main-app">
      <header className="app-header">
        <div className="app-brand">
          <h1>Card Scanner</h1>
          <span className="card-count">{totalCards} cards loaded</span>
        </div>
        <div className="user-section">
          <div className="user-info">
            <UserIcon size={18} />
            <span>{user.username}</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="app-main">
        {cardsLoading ? (
          <div className="loading-state">
            <div className="spinner-large" />
            <p>Loading card database...</p>
          </div>
        ) : cardsError ? (
          <div className="error-state">
            <p>Failed to load cards</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <>
            <div className="welcome-card">
              <h2>Welcome back, {user.username}!</h2>
              <div className="stats-row">
                <div className="stat-box">
                  <Library size={24} />
                  <div>
                    <span className="stat-number">{collectionCount}</span>
                    <span className="stat-label">Cards in collection</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="scan-section">
              <p className="scan-instruction">
                Tap the button to open your camera and scan a card.
              </p>
              <button 
                className="scan-btn"
                onClick={() => setShowCamera(true)}
                disabled={scanStatus === 'scanning' || scanStatus === 'saving'}
              >
                <CameraIcon size={32} />
                <span>Scan Card</span>
              </button>
            </div>

            {/* Scan Status Feedback */}
            {scanStatus === 'scanning' && (
              <div className="scan-feedback scanning">
                <div className="spinner-large" />
                <p>{scanProgress}</p>
              </div>
            )}

            {scanStatus === 'not_found' && (
              <div className="scan-feedback not-found">
                <p>❌ No card found</p>
                <p className="hint">Try again with better lighting</p>
              </div>
            )}

            {scanStatus === 'error' && (
              <div className="scan-feedback error">
                <p>⚠️ Scan failed</p>
                <p className="hint">Please try again</p>
              </div>
            )}

            {scanStatus === 'saved' && (
              <div className="scan-feedback success">
                <p>✅ {saveMessage}</p>
              </div>
            )}

            {saveMessage && scanStatus !== 'saved' && (
              <div className={`save-message ${saveMessage.includes('error') || saveMessage.includes('Failed') ? 'error' : 'success'}`}>
                {saveMessage}
              </div>
            )}
          </>
        )}
      </main>

      {scanResult !== null && (
        <CardResult
          match={scanResult}
          capturedImage={capturedImage}
          onSave={handleSaveCard}
          onClose={handleCloseResult}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};
