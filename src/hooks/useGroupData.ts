import { useEffect, useState } from 'react';
import type { GroupData } from '../lib/types';

const LS_KEY = 'mplus_data';
const DATA_URL = '/data.json';

interface State {
  data: GroupData | null;
  loading: boolean;
  error: string | null;
  fetchedFrom: 'cache' | 'network' | null;
}

export function useGroupData() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, fetchedFrom: null });

  useEffect(() => {
    // Paint immediately from localStorage if available
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      try {
        setState(s => ({ ...s, data: JSON.parse(cached), fetchedFrom: 'cache' }));
      } catch {
        // ignore corrupt cache
      }
    }

    // Revalidate from CDN
    fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GroupData>;
      })
      .then(data => {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        setState({ data, loading: false, error: null, fetchedFrom: 'network' });
      })
      .catch(err => {
        setState(s => ({ ...s, loading: false, error: err.message }));
      });
  }, []);

  return state;
}
