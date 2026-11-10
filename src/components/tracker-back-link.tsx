'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

interface TrackerBackLinkProps {
  from?: string;
  className?: string;
}

export function TrackerBackLink({from,className}: TrackerBackLinkProps) {
  const [targetUrl, setTargetUrl] = useState<string>(() => {
    if (from && from !== '/') {
      try {
        return decodeURIComponent(from);
      } catch {
        return from;
      }
    }
    return '/';
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('tracker_last_url');
      if (saved && saved !== '/' && (!from || from === '/')) {
        setTargetUrl(saved);
      }
    } catch {}
  }, [from]);

  const handleClick = () => {
    try {
      sessionStorage.setItem('tracker_from_full_edit', 'true');
    } catch {}
  };

  return (
    <Link
      href={targetUrl}
      onClick={handleClick}
      className={className || "text-sm text-muted-foreground hover:text-foreground transition-colors"}
    >
      ← Wróć do Trackera
    </Link>
  );
}
