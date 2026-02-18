/**
 * useAuth Hook - Authentication with email-auth-mobile.php
 */
import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

const AUTH_ENDPOINT = 'https://www.dotgg.gg/auth/email-auth-mobile.php';
const STORAGE_KEY = 'cardscanner_user';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  token?: string;
  error?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsInitialized(true);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          action: 'login',
          email: credentials.email,
          password: credentials.password
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.user && data.token) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          token: data.token
        };
        
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        return true;
      } else {
        setError(data.error || 'Login failed');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (
    credentials: LoginCredentials & { username: string }
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          action: 'register',
          email: credentials.email,
          password: credentials.password,
          username: credentials.username
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.user && data.token) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          token: data.token
        };
        
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        return true;
      } else {
        setError(data.error || 'Registration failed');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isInitialized,
    login,
    register,
    logout,
    clearError
  };
}
