/**
 * DotGG API Client - Collection management
 */
import type { CollectionCard, User } from '../types';

const API_BASE_URL = 'https://www.dotgg.gg/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UserData {
  id: string;
  email: string;
  username: string;
  collection: CollectionCard[];
}

class DotGGClient {
  private getAuthHeaders(user: User) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
      'Accept': 'application/json'
    };
  }

  async getUserData(user: User): Promise<ApiResponse<UserData>> {
    try {
      const response = await fetch(`${API_BASE_URL}/getuserdata`, {
        method: 'GET',
        headers: this.getAuthHeaders(user)
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch user data' 
      };
    }
  }

  async saveCollection(
    user: User, 
    cards: CollectionCard[]
  ): Promise<ApiResponse<{ saved: number }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/savecollection`, {
        method: 'POST',
        headers: this.getAuthHeaders(user),
        body: JSON.stringify({ cards })
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized' };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to save collection' 
      };
    }
  }

  async addCardToCollection(
    user: User,
    cardId: string,
    quantity: number = 1,
    condition?: string,
    language?: string
  ): Promise<ApiResponse<{ saved: number }>> {
    const card: CollectionCard = {
      cardId,
      quantity,
      condition,
      language
    };

    return this.saveCollection(user, [card]);
  }

  async syncCollection(
    user: User,
    localCards: CollectionCard[]
  ): Promise<ApiResponse<{ synced: number; conflicts: number }>> {
    // Fetch server collection
    const serverData = await this.getUserData(user);
    if (!serverData.success) {
      return { success: false, error: serverData.error };
    }

    const serverCards = serverData.data?.collection || [];

    // Merge collections (server wins on conflict for now)
    const mergedMap = new Map<string, CollectionCard>();

    // Add server cards first
    for (const card of serverCards) {
      mergedMap.set(card.cardId, card);
    }

    // Add/merge local cards
    for (const card of localCards) {
      const existing = mergedMap.get(card.cardId);
      if (existing) {
        // Merge quantities
        mergedMap.set(card.cardId, {
          ...existing,
          quantity: existing.quantity + card.quantity
        });
      } else {
        mergedMap.set(card.cardId, card);
      }
    }

    // Save merged collection
    const mergedCards = Array.from(mergedMap.values());
    const saveResult = await this.saveCollection(user, mergedCards);

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    return {
      success: true,
      data: {
        synced: mergedCards.length,
        conflicts: 0 // Could track this if needed
      }
    };
  }
}

export const dotGGClient = new DotGGClient();
export type { UserData, CollectionCard };
