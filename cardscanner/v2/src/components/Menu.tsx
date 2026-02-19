/**
 * Menu Component - Slide-out hamburger menu
 */
import React, { useEffect } from 'react';
import { 
  X, 
  User, 
  Gamepad2, 
  Library, 
  HelpCircle, 
  Settings, 
  LogOut,
  ChevronRight
} from 'lucide-react';
import type { User as UserType, Game } from '../types';
import './Menu.css';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  currentGame: Game;
  onSelectGame: () => void;
  onViewCollection: () => void;
  onViewHelp: () => void;
  onViewSettings: () => void;
  onLogout: () => void;
}

export const Menu: React.FC<MenuProps> = ({
  isOpen,
  onClose,
  user,
  currentGame,
  onSelectGame,
  onViewCollection,
  onViewHelp,
  onViewSettings,
  onLogout
}) => {
  // Close menu when pressing escape
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

  const gameDisplayNames: Record<Game, string> = {
    riftbound: 'Riftbound',
    lorcana: 'Lorcana',
    magic: 'Magic: The Gathering',
    pokemon: 'Pokémon TCG',
    yugioh: 'Yu-Gi-Oh!',
    onepiece: 'One Piece Card Game'
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="menu-backdrop" onClick={onClose} />
      )}

      {/* Menu Panel */}
      <div className={`menu-panel ${isOpen ? 'open' : ''}`}>
        {/* Header with close button */}
        <div className="menu-header">
          <button className="menu-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
          <span className="menu-title">Menu</span>
          <div style={{ width: 40 }} />
        </div>

        {/* User Info Section */}
        <div className="menu-user-section">
          <div className="menu-user-avatar">
            <User size={32} />
          </div>
          <div className="menu-user-info">
            <span className="menu-username">{user.username}</span>
            <span className="menu-email">{user.email}</span>
          </div>
        </div>

        <div className="menu-divider" />

        {/* Menu Items */}
        <nav className="menu-nav">
          {/* Current Game Display */}
          <button className="menu-item" onClick={onSelectGame}>
            <div className="menu-item-icon game-icon">
              <Gamepad2 size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-label">Select Game</span>
              <span className="menu-item-value">{gameDisplayNames[currentGame]}</span>
            </div>
            <ChevronRight size={18} className="menu-item-arrow" />
          </button>

          <button className="menu-item" onClick={onViewCollection}>
            <div className="menu-item-icon collection-icon">
              <Library size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-label">My Collection</span>
            </div>
            <ChevronRight size={18} className="menu-item-arrow" />
          </button>

          <button className="menu-item" onClick={onViewHelp}>
            <div className="menu-item-icon help-icon">
              <HelpCircle size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-label">How to Scan</span>
            </div>
            <ChevronRight size={18} className="menu-item-arrow" />
          </button>

          <button className="menu-item" onClick={onViewSettings}>
            <div className="menu-item-icon settings-icon">
              <Settings size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-label">Settings</span>
            </div>
            <ChevronRight size={18} className="menu-item-arrow" />
          </button>
        </nav>

        <div className="menu-divider" />

        {/* Sign Out */}
        <button className="menu-item menu-item-danger" onClick={onLogout}>
          <div className="menu-item-icon logout-icon">
            <LogOut size={20} />
          </div>
          <div className="menu-item-content">
            <span className="menu-item-label">Sign Out</span>
          </div>
        </button>
      </div>
    </>
  );
};
