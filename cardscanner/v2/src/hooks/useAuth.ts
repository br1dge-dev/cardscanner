/**
 * useAuth Hook - Authentication with dot.gg email-auth-mobile.php
 * Based on official API documentation
 */
import { useState, useEffect, useCallback } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import type { HttpResponse } from '@capacitor/core';
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
      console.log('Login attempt:', credentials.email);
      console.log('Using CapacitorHttp for native request');
      
      // Use CapacitorHttp for native network requests (works in WebView)
      const response: HttpResponse = await CapacitorHttp.post({
        url: AUTH_ENDPOINT,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: `email=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}`
      });

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Parse response data
      const data: DotGGAuthResponse = typeof response.data === 'string' 
        ? JSON.parse(response.data) 
        : response.data;

      if (data.error) {
        setError(data.error);
        return false;
      }

      if (data.DotGGUser && data.DotGGUserToken) {
        const userData: User = {
          id: String(data.DotGGUser),
          email: credentials.email,
          username: credentials.email.split('@')[0],
          token: data.DotGGUserToken
        };
        
        setUser(userData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        console.log('Login successful, user:', userData.id);
        return true;
      } else {
        setError('Invalid response from server - missing user or token');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Network error - check connection';
      setError(`Login failed: ${errorMessage}`);
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
