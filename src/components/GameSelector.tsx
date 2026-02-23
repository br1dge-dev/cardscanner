/**
 * GameSelector Component - Modal for selecting the game
 */
import React, { useEffect } from 'react';
import { X, Check, Gamepad2 } from 'lucide-react';
import type { Game } from '../types';
import './GameSelector.css';

interface GameSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentGame: Game;
  onSelectGame: (game: Game) => void;
}

interface GameOption {
  id: Game;
  name: string;
  description: string;
  color: string;
  available: boolean;
}

const games: GameOption[] = [
  {
    id: 'riftbound',
    name: 'Riftbound',
    description: 'Strategic card battles in the Rift',
    color: '#00ff9d',
    available: true
  },
  {
    id: 'lorcana',
    name: 'Disney Lorcana',
    description: 'Magical Disney trading card game',
    color: '#f472b6',
    available: false
  },
  {
    id: 'magic',
    name: 'Magic: The Gathering',
    description: 'The original trading card game',
    color: '#60a5fa',
    available: false
  },
  {
    id: 'pokemon',
    name: 'Pokemon TCG',
    description: 'Gotta catch them all!',
    color: '#fbbf24',
    available: false
  },
  {
    id: 'yugioh',
    name: 'Yu-Gi-Oh!',
    description: 'It is time to duel!',
    color: '#a78bfa',
    available: false
  },
  {
    id: 'onepiece',
    name: 'One Piece Card Game',
    description: 'Set sail for adventure',
    color: '#f87171',
    available: false
  }
];

export const GameSelector: React.FC<GameSelectorProps> = ({
  isOpen,
  onClose,
  currentGame,
  onSelectGame
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

  const handleSelect = (gameId: Game) => {
    const game = games.find(g => g.id === gameId);
    if (game?.available) {
      onSelectGame(gameId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="game-selector-overlay">
      <div className="game-selector-backdrop" onClick={onClose} />
      <div className="game-selector-modal">
        <div className="game-selector-header">
          <div className="game-selector-title-row">
            <div className="game-selector-icon">
              <Gamepad2 size={24} />
            </div>
            <h2 className="game-selector-title">Select Game</h2>
          </div>
          <button className="game-selector-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <p className="game-selector-subtitle">
          Choose which card game you want to scan
        </p>

        <div className="game-selector-list">
          {games.map((game) => (
            <button
              key={game.id}
              className={`game-option ${currentGame === game.id ? 'selected' : ''} ${!game.available ? 'disabled' : ''}`}
              onClick={() => handleSelect(game.id)}
              disabled={!game.available}
            >
              <div 
                className="game-option-indicator"
                style={{ backgroundColor: game.color }}
              />
              <div className="game-option-content">
                <div className="game-option-header">
                  <span className="game-option-name">{game.name}</span>
                  {currentGame === game.id && (
                    <Check size={18} className="game-option-check" />
                  )}
                  {!game.available && (
                    <span className="game-option-badge">Coming Soon</span>
                  )}
                </div>
                <span className="game-option-description">{game.description}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="game-selector-footer">
          <button className="game-selector-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
