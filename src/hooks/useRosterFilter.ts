import { useState, useCallback } from 'react';
import type { FilterState } from '../lib/scoring';
import { DEFAULT_FILTER } from '../lib/scoring';

export function useRosterFilter() {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const toggleMember = useCallback((id: string) => {
    setFilter(f => {
      const required = new Set(f.required);
      if (required.has(id)) required.delete(id);
      else required.add(id);
      return { ...f, required };
    });
  }, []);

  const setGroupSize = useCallback((size: FilterState['groupSize']) => {
    setFilter(f => ({ ...f, groupSize: size }));
  }, []);

  const clearAll = useCallback(() => {
    setFilter(DEFAULT_FILTER);
  }, []);

  return { filter, toggleMember, setGroupSize, clearAll };
}
