/**
 * Auth Component - Login and Registration
 */
import React, { useState } from 'react';
import { LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import './Auth.css';

interface AuthProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<boolean>;
  onRegister: (credentials: { email: string; password: string; username: string }) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

type AuthMode = 'login' | 'register';

export const Auth: React.FC<AuthProps> = ({ 
  onLogin, 
  onRegister, 
  isLoading, 
  error,
  onClearError 
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();

    if (mode === 'login') {
      await onLogin({ email, password });
    } else {
      await onRegister({ email, password, username });
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    onClearError();
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Card Scanner</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required={mode === 'register'}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>
                {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </p>
          <button 
            type="button" 
            className="auth-switch-btn"
            onClick={switchMode}
            disabled={isLoading}
          >
            {mode === 'login' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};
