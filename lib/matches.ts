import { supabase } from './supabase';
import type { Match } from './types';

export async function getMyMatches(userId: string): Promise<Match[]> {
  const { data: matchRows, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user2_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!matchRows || matchRows.length === 0) return [];

  const otherIds = [...new Set(matchRows.map((m) => m.user1_id))];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, instagram_handle')
    .in('id', otherIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return matchRows.map((m) => ({
    ...m,
    other_profile: profileMap[m.user1_id] ?? null,
  }));
}
