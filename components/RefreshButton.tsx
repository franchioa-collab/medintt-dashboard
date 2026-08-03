'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  error?: string | null;
}

export function RefreshButton({ onRefresh, disabled = false, error }: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRefresh}
        disabled={disabled || refreshing}
        className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-md font-semibold hover:opacity-90 disabled:opacity-50 transition"
      >
        <RotateCw size={18} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Actualizando...' : 'Refrescar'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
