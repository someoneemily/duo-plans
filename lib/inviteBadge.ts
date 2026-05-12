import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'shared_list_invites_last_seen_at';

let _count = 0;
const _listeners = new Set<(n: number) => void>();

function emit() {
  _listeners.forEach((l) => l(_count));
}

export function subscribeInviteBadge(fn: (n: number) => void): () => void {
  _listeners.add(fn);
  fn(_count);
  return () => _listeners.delete(fn);
}

export async function refreshInviteBadge(userId: string): Promise<void> {
  const lastSeen = await AsyncStorage.getItem(STORAGE_KEY);
  let query = supabase
    .from('shared_list_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('invited_by_id', 'is', null); // exclude self-created rows
  if (lastSeen) query = query.gt('created_at', lastSeen);
  const { count } = await query;
  _count = count ?? 0;
  emit();
}

export async function markInvitesSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
  _count = 0;
  emit();
}
