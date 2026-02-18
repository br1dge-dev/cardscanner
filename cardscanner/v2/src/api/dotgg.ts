/**
 * DotGG API Client - Collection management
 * Based on official API documentation
 */
import type { CollectionCard, User } from '../types';

const API_BASE_URL = 'https://api.dotgg.gg';
const GAME = 'lorcana'; // Riftbound is under 'lorcana' in dot.gg

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

  async getUserData(user: User): Promise<ApiResponse<UserData>> {
    try {
      const response = await fetch(`${API_BASE_URL}/cgfw/getuserdata?game=${GAME}`, {
        method: 'GET',
        headers: this.getAuthHeaders(user)
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized - Invalid token' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: UserData = await response.json();
      return { success: true, data };
    } catch (err) {
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
      const response = await fetch(`${API_BASE_URL}/cgfw/savecollection?game=${GAME}`, {
        method: 'POST',
        headers: this.getAuthHeaders(user),
        body: JSON.stringify({
          card: cardId,
          type,
          count,
          trade,
          wish
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { success: false, error: data.error_text || 'Save failed' };
      }
      
      return { success: true, data };
    } catch (err) {
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
    // Use bulk sync endpoint
    try {
      const items = localCards.map(card => ({
        card: card.cardId,
        standard: String(card.quantity),
        foil: '0',
        trade: String(card.trade || 0),
        wish: String(card.wish || 0)
      }));

      const response = await fetch(`${API_BASE_URL}/cgfw/synclocalcollection?game=${GAME}`, {
        method: 'POST',
        headers: this.getAuthHeaders(user),
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { success: false, error: data.error_text || 'Sync failed' };
      }
      
      return { 
        success: true, 
        data: { error: false, synced: data.synced || items.length }
      };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to sync collection' 
      };
    }
  }
}

export const dotGGClient = new DotGGClient();
export type { UserData, CollectionCard };
