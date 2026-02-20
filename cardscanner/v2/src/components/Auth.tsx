/**
 * Auth Component - Login screen with TCG branding
 */
import React, { useState } from 'react';
import './Auth.css';

interface AuthProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<boolean>;
  onRegister?: () => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ 
  onLogin, 
  isLoading = false, 
  error, 
  onClearError 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError?.();
    await onLogin({ email, password });
  };

  return (
    <div className="auth-container">
      <div className="auth-hero">
        <div className="auth-brand">
          <h1>Card Scanner</h1>
          <p>Scan. Match. Collect.</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="auth-footer">
          Don't have an account? <a href="https://riftbound.gg" target="_blank" rel="noopener">Create one on DotGG</a>
        </div>
        
        <div className="auth-powered">Powered by DotGG</div>
      </form>
    </div>
  );
};
