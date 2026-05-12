import { supabase } from './supabase';
import type { Profile } from './types';

export async function searchProfiles(query: string, excludeUserId: string): Promise<Profile[]> {
  if (!query.trim()) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, instagram_handle, phone_number, username, created_at')
    .ilike('display_name', `%${query.trim()}%`)
    .neq('id', excludeUserId)
    .limit(10);
  return (data ?? []) as Profile[];
}
