import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { getMyMatches } from './matches';
import type { Match } from './types';

function upsertMatch(prev: Match[], incoming: Match): Match[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? incoming : m));
  }
  return [incoming, ...prev];
}

export function useMatches(userId?: string | null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) return;
    const data = await getMyMatches(userId);
    setMatches(data);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const channel = supabase
      .channel(`matches:${userId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `user1_id=eq.${userId}`,
      }, (payload: { new: Match }) => {
        setMatches((prev) => upsertMatch(prev, payload.new));
      })
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `user2_id=eq.${userId}`,
      }, (payload: { new: Match }) => {
        setMatches((prev) => upsertMatch(prev, payload.new));
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          try {
            const data = await getMyMatches(userId);
            setMatches(data);
          } finally {
            setLoading(false);
          }
        }
      });

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refetch();
      }
    };
    const handleFocus = () => refetch();

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
      }
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  return { matches, loading, refetch };
}
