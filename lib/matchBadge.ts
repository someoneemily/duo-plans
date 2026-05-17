import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'matches_last_seen_at';

let _count = 0;
const _listeners = new Set<(n: number) => void>();

function emit() {
  _listeners.forEach((l) => l(_count));
}

export function subscribeMatchBadge(fn: (n: number) => void): () => void {
  _listeners.add(fn);
  fn(_count);
  return () => _listeners.delete(fn);
}

export async function refreshMatchBadge(userId: string): Promise<void> {
  const lastSeen = await AsyncStorage.getItem(STORAGE_KEY);
  let query = supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
  if (lastSeen) query = query.gt('created_at', lastSeen);
  const { count } = await query;
  _count = count ?? 0;
  emit();
}

export async function markMatchesSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  _count = 0;
  emit();
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export function startMatchRealtimeListener(userId: string): () => void {
  _channel?.unsubscribe();
  const handler = () => refreshMatchBadge(userId);
  _channel = supabase
    .channel(`match-badge-${userId}`)
    .on('postgres_changes' as any, {
      event: 'INSERT',
      schema: 'public',
      table: 'matches',
      filter: `user1_id=eq.${userId}`,
    }, handler)
    .on('postgres_changes' as any, {
      event: 'INSERT',
      schema: 'public',
      table: 'matches',
      filter: `user2_id=eq.${userId}`,
    }, handler)
    .subscribe();
  return () => {
    _channel?.unsubscribe();
    _channel = null;
  };
}
