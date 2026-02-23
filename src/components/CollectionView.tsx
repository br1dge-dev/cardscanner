/**
 * CollectionView Component - Simplified collection display
 */
import React, { useState, useMemo } from 'react';
import { X, Search, Filter, ArrowUpDown, Package } from 'lucide-react';
import type { User, Card } from '../types';
import { dotGGClient } from '../api/dotgg';
import './CollectionView.css';

interface CollectionViewProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

interface CollectionItem {
  card: Card;
  quantity: number;
  setName: string;
}

type SortField = 'name' | 'quantity' | 'set';
type SortDirection = 'asc' | 'desc';

export const CollectionView: React.FC<CollectionViewProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [error, setError] = useState<string | null>(null);

  // Load collection when opened
  React.useEffect(() => {
    if (isOpen) {
      loadCollection();
    }
  }, [isOpen, user]);

  const loadCollection = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await dotGGClient.getUserData(user);
      if (result.success && result.data) {
        // Transform collection data
        const items: CollectionItem[] = result.data.collection
          .filter(item => parseInt(item.standard) > 0)
          .map(item => ({
            card: {
              id: item.card,
              name: `Card ${item.card}`, // Would ideally fetch real card names
              number: item.card,
              set: item.card.split('-')[0] || 'unknown',
              image: `https://api.dotgg.gg/cgfw/static/riftbound/cards/${item.card}.jpg`
            },
            quantity: parseInt(item.standard),
            setName: item.card.split('-')[0] || 'Unknown Set'
          }));
        setCollection(items);
      } else {
        setError(result.error || 'Failed to load collection');
      }
    } catch (err) {
      setError('Network error loading collection');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique sets
  const availableSets = useMemo(() => {
    const sets = new Set<string>();
    collection.forEach(item => sets.add(item.setName));
    return Array.from(sets).sort();
  }, [collection]);

  // Filter and sort collection
  const filteredCollection = useMemo(() => {
    let filtered = collection;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.card.name.toLowerCase().includes(query) ||
        item.card.number.toLowerCase().includes(query)
      );
    }

    // Filter by set
    if (selectedSet !== 'all') {
      filtered = filtered.filter(item => item.setName === selectedSet);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.card.name.localeCompare(b.card.name);
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'set':
          comparison = a.setName.localeCompare(b.setName);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [collection, searchQuery, selectedSet, sortField, sortDirection]);

  const totalCards = useMemo(() => 
    collection.reduce((sum, item) => sum + item.quantity, 0),
    [collection]
  );

  const uniqueCards = collection.length;

  if (!isOpen) return null;

  return (
    <div className="collection-view-overlay">
      <div className="collection-view-backdrop" onClick={onClose} />
      <div className="collection-view-panel">
        {/* Header */}
        <div className="collection-view-header">
          <div className="collection-view-title-row">
            <h2 className="collection-view-title">My Collection</h2>
            <button className="collection-view-close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
          
          {/* Stats */}
          <div className="collection-view-stats">
            <div className="collection-stat">
              <Package size={16} />
              <span>{totalCards} cards</span>
            </div>
            <div className="collection-stat">
              <span>{uniqueCards} unique</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="collection-view-toolbar">
          <div className="collection-search">
            <Search size={18} className="collection-search-icon" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="collection-search-input"
            />
          </div>
          
          <div className="collection-filters">
            <div className="collection-filter">
              <Filter size={16} />
              <select 
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value)}
                className="collection-select"
              >
                <option value="all">All Sets</option>
                {availableSets.map(set => (
                  <option key={set} value={set}>{set}</option>
                ))}
              </select>
            </div>

            <div className="collection-filter">
              <ArrowUpDown size={16} />
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split('-');
                  setSortField(field as SortField);
                  setSortDirection(direction as SortDirection);
                }}
                className="collection-select"
              >
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="quantity-desc">Quantity High-Low</option>
                <option value="quantity-asc">Quantity Low-High</option>
                <option value="set-asc">Set A-Z</option>
                <option value="set-desc">Set Z-A</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="collection-view-content">
          {isLoading ? (
            <div className="collection-loading">
              <div className="spinner" />
              <p>Loading collection...</p>
            </div>
          ) : error ? (
            <div className="collection-error">
              <p>{error}</p>
              <button onClick={loadCollection}>Retry</button>
            </div>
          ) : filteredCollection.length === 0 ? (
            <div className="collection-empty">
              <Package size={48} className="collection-empty-icon" />
              <p>No cards found</p>
              {searchQuery && (
                <span>Try adjusting your search or filters</span>
              )}
            </div>
          ) : (
            <div className="collection-grid">
              {filteredCollection.map((item) => (
                <div key={item.card.id} className="collection-card">
                  <div className="collection-card-image">
                    <img 
                      src={item.card.image} 
                      alt={item.card.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="collection-card-quantity">
                      x{item.quantity}
                    </div>
                  </div>
                  <div className="collection-card-info">
                    <span className="collection-card-name">{item.card.name}</span>
                    <span className="collection-card-set">{item.setName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="collection-view-footer">
          <span>{filteredCollection.length} items shown</span>
        </div>
      </div>
    </div>
  );
};
