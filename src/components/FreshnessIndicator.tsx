import { useEffect, useState } from 'react';

interface FreshnessIndicatorProps {
  fetchedAt: string; // ISO-8601
}

function getRelativeTime(fetchedAt: string): string {
  const diffMs = Date.now() - new Date(fetchedAt).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'just now';
  if (diffHours < 1) return `${diffMin} min ago`;
  if (diffDays < 1) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function FreshnessIndicator({ fetchedAt }: FreshnessIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState(() => getRelativeTime(fetchedAt));

  useEffect(() => {
    setRelativeTime(getRelativeTime(fetchedAt));

    const id = setInterval(() => {
      setRelativeTime(getRelativeTime(fetchedAt));
    }, 30_000);

    return () => clearInterval(id);
  }, [fetchedAt]);

  return (
    <span className="text-sm text-gray-500">
      Last updated {relativeTime}
    </span>
  );
}
