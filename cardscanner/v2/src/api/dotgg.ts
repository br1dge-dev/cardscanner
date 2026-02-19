/**
 * DotGG API Client - Collection management
 * Based on official API documentation
 * Uses CapacitorHttp for native network requests
 */
import { CapacitorHttp } from '@capacitor/core';
import type { HttpResponse } from '@capacitor/core';
import type { CollectionCard, User } from '../types';

const API_BASE_URL = 'https://api.dotgg.gg';
const GAME = 'riftbound';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UserData {
  user: {
    user_id: number;
    nickname: string;
    user_registered: string;
  };
  collection: Array<{
    card: string;      // e.g., "001-001"
    standard: string;  // count as string
    foil: string;
    total: string;
    trade: string;
    wish: string;
  }>;
}

class DotGGClient {
  private getAuthHeaders(user: User) {
    return {
      'Content-Type': 'application/json',
      'Dotgguserauth': `${user.id}:${user.token}`,
      'Accept': 'application/json'
    };
  }

  private parseResponse<T>(response: HttpResponse): T {
    if (typeof response.data === 'string') {
      return JSON.parse(response.data) as T;
    }
    return response.data as T;
  }

  async getUserData(user: User): Promise<ApiResponse<UserData>> {
    try {
      const response: HttpResponse = await CapacitorHttp.get({
        url: `${API_BASE_URL}/cgfw/getuserdata`,
        headers: this.getAuthHeaders(user),
        params: { game: GAME }
      });

      if (response.status === 401) {
        return { success: false, error: 'Unauthorized - Invalid token' };
      }

      if (response.status !== 200) {
        return { success: false, error: `HTTP error! status: ${response.status}` };
      }

      const data: UserData = this.parseResponse(response);
      return { success: true, data };
    } catch (err) {
      console.error('getUserData error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch user data' 
      };
    }
  }

  async saveCard(
    user: User,
    cardId: string,
    type: 'standard' | 'foil' = 'standard',
    count: number = 1,
    trade: number = 0,
    wish: number = 0
  ): Promise<ApiResponse<{ error: boolean; newCount: number }>> {
    try {
      const response: HttpResponse = await CapacitorHttp.post({
        url: `${API_BASE_URL}/cgfw/savecollection`,
        headers: this.getAuthHeaders(user),
        params: { game: GAME },
        data: {
          card: cardId,
          type,
          count,
          trade,
          wish
        }
      });

      if (response.status === 401) {
        return { success: false, error: 'Unauthorized' };
      }

      if (response.status !== 200) {
        return { success: false, error: `HTTP error! status: ${response.status}` };
      }

      const data = this.parseResponse<{ error: boolean; error_text?: string; newCount: number }>(response);
      
      if (data.error) {
        return { success: false, error: data.error_text || 'Save failed' };
      }
      
      return { success: true, data };
    } catch (err) {
      console.error('saveCard error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to save card' 
      };
    }
  }

  async addCardToCollection(
    user: User,
    cardId: string,
    quantity: number = 1
  ): Promise<ApiResponse<{ error: boolean; newCount: number }>> {
    return this.saveCard(user, cardId, 'standard', quantity);
  }

  async syncCollection(
    user: User,
    localCards: CollectionCard[]
  ): Promise<ApiResponse<{ error: boolean; synced: number }>> {
    try {
      const items = localCards.map(card => ({
        card: card.cardId,
        standard: String(card.quantity),
        foil: '0',
        trade: String(card.trade || 0),
        wish: String(card.wish || 0)
      }));

      const response: HttpResponse = await CapacitorHttp.post({
        url: `${API_BASE_URL}/cgfw/synclocalcollection`,
        headers: this.getAuthHeaders(user),
        params: { game: GAME },
        data: { items }
      });

      if (response.status === 401) {
        return { success: false, error: 'Unauthorized' };
      }

      if (response.status !== 200) {
        return { success: false, error: `HTTP error! status: ${response.status}` };
      }

      const data = this.parseResponse<{ error: boolean; error_text?: string; synced?: number }>(response);
      
      if (data.error) {
        return { success: false, error: data.error_text || 'Sync failed' };
      }
      
      return { 
        success: true, 
        data: { error: false, synced: data.synced || items.length }
      };
    } catch (err) {
      console.error('syncCollection error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to sync collection' 
      };
    }
  }
}

export const dotGGClient = new DotGGClient();
export type { UserData, CollectionCard };
