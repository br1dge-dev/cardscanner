/**
 * BatchSummary Component - Results screen after batch scan ends
 */
import React from 'react';
import type { BatchResultEntry } from '../types';
import './BatchSummary.css';

interface BatchSummaryProps {
  results: BatchResultEntry[];
  onDone: () => void;
}

export const BatchSummary: React.FC<BatchSummaryProps> = ({ results, onDone }) => {
  const added = results.filter(r => r.status === 'added');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'not_found');
  const skipped = results.filter(r => r.status === 'skipped');

  return (
    <div className="batch-summary-overlay">
      <div className="batch-summary-modal">
        <h3 className="batch-summary-title">⚡ Batch Complete</h3>

        <div className="batch-summary-stats">
          <div className="batch-stat">
            <span className="batch-stat-num">{results.length}</span>
            <span className="batch-stat-label">Scanned</span>
          </div>
          <div className="batch-stat batch-stat-success">
            <span className="batch-stat-num">{added.length}</span>
            <span className="batch-stat-label">Added</span>
          </div>
          {failed.length > 0 && (
            <div className="batch-stat batch-stat-fail">
              <span className="batch-stat-num">{failed.length}</span>
              <span className="batch-stat-label">Failed</span>
            </div>
          )}
          {skipped.length > 0 && (
            <div className="batch-stat batch-stat-skip">
              <span className="batch-stat-num">{skipped.length}</span>
              <span className="batch-stat-label">Skipped</span>
            </div>
          )}
        </div>

        {added.length > 0 && (
          <div className="batch-summary-section">
            <h4>✅ Added</h4>
            <div className="batch-summary-list">
              {added.map((r, i) => (
                <div key={i} className="batch-summary-item">
                  {r.cardImage && (
                    <img src={r.cardImage} alt="" className="batch-item-thumb"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span className="batch-item-name">{r.cardName}</span>
                  <span className="batch-item-number">{r.cardNumber}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {failed.length > 0 && (
          <div className="batch-summary-section">
            <h4>❌ Failed</h4>
            <div className="batch-summary-list">
              {failed.map((r, i) => (
                <div key={i} className="batch-summary-item batch-item-failed">
                  <span className="batch-item-name">{r.cardName || 'Unknown card'}</span>
                  {r.error && <span className="batch-item-error">{r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="batch-summary-done" onClick={onDone}>Done</button>
      </div>
    </div>
  );
};
