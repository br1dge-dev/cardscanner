/**
 * useAuth Hook - Authentication with dot.gg email-auth-mobile.php
 * Based on official API documentation
 */
import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

const AUTH_ENDPOINT = 'https://api.dotgg.gg/email-auth-mobile.php';
const STORAGE_KEY = 'cardscanner_user';

interface LoginCredentials {
  email: string;
  password: string;
}

interface DotGGAuthResponse {
  DotGGUser?: number;
  DotGGUserToken?: string;
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
      // Use FormData as per API documentation
      const formData = new URLSearchParams();
      formData.append('email', credentials.email);
      formData.append('password', credentials.password);

      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DotGGAuthResponse = await response.json();

      if (data.error) {
        setError(data.error);
        return false;
      }

      if (data.DotGGUser && data.DotGGUserToken) {
        const userData: User = {
          id: String(data.DotGGUser),
          email: credentials.email,
          username: credentials.email.split('@')[0], // Use email prefix as username
          token: data.DotGGUserToken
        };
        
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        return true;
      } else {
        setError('Invalid response from server');
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

  // Note: Registration is not available via API - users must register on website
  const register = useCallback(async (): Promise<boolean> => {
    setError('Please register at https://riftbound.gg - then use your credentials here.');
    return false;
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
