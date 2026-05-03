import { supabase } from './supabase';
import type { Match } from './types';

export async function getMyMatches(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      user1:user1_id (id, display_name, avatar_url),
      user2:user2_id (id, display_name, avatar_url)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    other_profile: row.user1_id === userId ? row.user2 : row.user1,
  }));
}
