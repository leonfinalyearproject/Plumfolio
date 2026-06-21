import React from 'react';
import { useInsights } from '../context/InsightsContext';
import './LiveSyncBadge.css';

const LiveSyncBadge = () => {
  const { isLive, syncing, lastSyncedAt } = useInsights();

  const label = syncing ? 'Syncing' : isLive ? 'Live' : 'Offline';

  return (
    <div
      className={`live-sync-badge ${isLive ? 'is-live' : ''} ${syncing ? 'is-syncing' : ''}`}
      title={lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Connecting…'}
    >
      <span className="live-sync-dot" />
      {label}
    </div>
  );
};

export default LiveSyncBadge;
