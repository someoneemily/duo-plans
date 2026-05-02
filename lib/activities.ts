import { supabase } from './supabase';
import type { Activity, Category } from './types';

export async function getMyActivities(userId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles(id, display_name, avatar_url)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getOpenActivities(excludeUserId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles(id, display_name, avatar_url)')
    .eq('is_open', true)
    .neq('user_id', excludeUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addActivity(params: {
  userId: string;
  name: string;
  category: Category;
  notes?: string;
  isOpen: boolean;
  source?: 'self' | 'explore';
}): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: params.userId,
      name: params.name,
      category: params.category,
      notes: params.notes ?? null,
      is_open: params.isOpen,
      is_private: !params.isOpen,
      source: params.source ?? 'self',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateActivity(activityId: string, updates: { name: string }): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ name: updates.name })
    .eq('id', activityId);

  if (error) throw error;
}

export async function toggleOpen(activityId: string, isOpen: boolean): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ is_open: isOpen, is_private: !isOpen })
    .eq('id', activityId);

  if (error) throw error;
}

export async function getPublicCompletedActivities(userId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .eq('is_private', false)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function markAsCompleted(activityId: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ completed_at: new Date().toISOString(), is_open: false })
    .eq('id', activityId);

  if (error) throw error;
}

export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId);

  if (error) throw error;
}

export async function getInterestedUsers(itemName: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('profiles(id, display_name, instagram_handle, avatar_url)')
    .ilike('name', itemName)
    .eq('is_open', true)
    .is('completed_at', null);

  if (error) throw error;
  return (data ?? []).map((row: any) => row.profiles).filter(Boolean);
}

export async function getMatchesForActivity(activityId: string, userId: string) {
  // Find other open activities with the same name
  const activity = await getActivity(activityId);
  if (!activity) return [];

  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles(id, display_name, avatar_url)')
    .ilike('name', activity.name)
    .eq('is_open', true)
    .neq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}
