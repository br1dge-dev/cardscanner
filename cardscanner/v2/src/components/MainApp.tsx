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

export const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [scanResult, setScanResult] = useState<CardMatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [collectionCount, setCollectionCount] = useState(0);

  const { cards, loading: cardsLoading, error: cardsError, totalCards } = useCards();
  const { processImage, isProcessing, terminateWorker } = useOCR();
  const { findMatches, isMatching } = useCardMatching(cards);

  // Load user's collection count on mount
  useEffect(() => {
    const loadCollection = async () => {
      const result = await dotGGClient.getUserData(user);
      if (result.success && result.data) {
        setCollectionCount(result.data.collection.length);
      }
    };
    loadCollection();
  }, [user]);

  // Cleanup Tesseract worker on unmount
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, [terminateWorker]);

  const handleCapture = useCallback(async (imageData: string) => {
    try {
      // Process image with OCR
      const ocrData = await processImage(imageData);
      
      // Find matching cards
      const result = await findMatches(ocrData);
      
      // Show result
      setScanResult(result.bestMatch);
      setShowCamera(false);
    } catch (err) {
      console.error('Scan error:', err);
      setScanResult(null);
      setShowCamera(false);
    }
  }, [processImage, findMatches]);

  const handleSaveCard = useCallback(async (cardId: string, quantity: number) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const result = await dotGGClient.addCardToCollection(user, cardId, quantity);
      
      if (result.success) {
        setSaveMessage('Card added to collection!');
        setCollectionCount(prev => prev + quantity);
        setTimeout(() => {
          setScanResult(null);
          setSaveMessage(null);
        }, 1500);
      } else {
        setSaveMessage(result.error || 'Failed to save card');
      }
    } catch (err) {
      setSaveMessage('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const handleCloseResult = useCallback(() => {
    setScanResult(null);
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
                Position your card in the camera frame and tap the button to scan.
              </p>
              <button 
                className="scan-btn"
                onClick={() => setShowCamera(true)}
              >
                <CameraIcon size={32} />
                <span>Scan Card</span>
              </button>
            </div>

            {saveMessage && (
              <div className={`save-message ${saveMessage.includes('error') || saveMessage.includes('Failed') ? 'error' : 'success'}`}>
                {saveMessage}
              </div>
            )}
          </>
        )}
      </main>

      {scanResult !== undefined && (
        <CardResult
          match={scanResult}
          onSave={handleSaveCard}
          onClose={handleCloseResult}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};
