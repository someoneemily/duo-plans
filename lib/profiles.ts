import { supabase } from './supabase';
import type { Profile } from './types';

export async function searchProfiles(query: string, excludeUserId: string): Promise<Profile[]> {
  if (!query.trim()) return [];
  const q = query.trim().replace(/^@/, '');
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, instagram_handle, phone_number, username, created_at')
    .ilike('username', `${q}%`)
    .neq('id', excludeUserId)
    .limit(10);
  return (data ?? []) as Profile[];
}

export async function isUsernameAvailable(username: string, excludeUserId: string): Promise<boolean> {
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username)
    .neq('id', excludeUserId);
  return (count ?? 0) === 0;
}
