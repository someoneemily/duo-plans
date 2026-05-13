import { supabase } from './supabase';
import type { SharedList, SharedListMember, SharedListStatus, Activity, Profile } from './types'; // SharedListStatus used for member casts below

export async function getMySharedLists(userId: string): Promise<SharedList[]> {
  const { data: myMemberships, error } = await supabase
    .from('shared_list_members')
    .select(`
      list_id,
      status,
      shared_lists (
        id,
        creator_id,
        created_at
      )
    `)
    .eq('user_id', userId);

  if (error || !myMemberships) return [];

  const listIds = myMemberships.map((m) => m.list_id);
  if (listIds.length === 0) return [];

  const { data: allMembers } = await supabase
    .from('shared_list_members')
    .select(`
      id, list_id, user_id, invited_by_id, status, responded_at, created_at,
      profiles!user_id (id, display_name, avatar_url, instagram_handle, phone_number, username, created_at)
    `)
    .in('list_id', listIds);

  const { data: activityRows } = await supabase
    .from('shared_list_activities')
    .select('list_id')
    .in('list_id', listIds);

  const activityCountByList: Record<string, number> = {};
  (activityRows ?? []).forEach((r) => {
    activityCountByList[r.list_id] = (activityCountByList[r.list_id] ?? 0) + 1;
  });

  const membersByList: Record<string, SharedListMember[]> = {};
  (allMembers ?? []).forEach((m) => {
    if (!membersByList[m.list_id]) membersByList[m.list_id] = [];
    membersByList[m.list_id].push({
      id: m.id,
      list_id: m.list_id,
      user_id: m.user_id,
      invited_by_id: m.invited_by_id,
      status: m.status as SharedListStatus,
      responded_at: m.responded_at,
      created_at: m.created_at,
      profile: m.profiles as unknown as Profile,
    });
  });

  return myMemberships.map((m) => {
    const list = m.shared_lists as any;
    return {
      id: list.id,
      creator_id: list.creator_id,
      created_at: list.created_at,
      members: membersByList[m.list_id] ?? [],
      activityCount: activityCountByList[m.list_id] ?? 0,
    };
  });
}

export interface ListInvite {
  listId: string;
  invitedBy: { id: string; display_name: string | null };
  createdAt: string;
}

export async function getPendingListInvites(userId: string): Promise<ListInvite[]> {
  const { data } = await supabase
    .from('shared_list_members')
    .select(`
      list_id,
      created_at,
      profiles!invited_by_id (id, display_name)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('invited_by_id', 'is', null)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    listId: row.list_id,
    invitedBy: row.profiles as unknown as { id: string; display_name: string | null },
    createdAt: row.created_at,
  }));
}

export async function findListWithMembers(
  userId: string,
  otherUserIds: string[]
): Promise<string | null> {
  const targetIds = new Set([userId, ...otherUserIds]);

  const { data: myMemberships } = await supabase
    .from('shared_list_members')
    .select('list_id')
    .eq('user_id', userId);

  if (!myMemberships?.length) return null;

  const listIds = myMemberships.map((m) => m.list_id);

  const { data: allMembers } = await supabase
    .from('shared_list_members')
    .select('list_id, user_id')
    .in('list_id', listIds);

  if (!allMembers) return null;

  const byList: Record<string, Set<string>> = {};
  allMembers.forEach((m) => {
    if (!byList[m.list_id]) byList[m.list_id] = new Set();
    byList[m.list_id].add(m.user_id);
  });

  for (const [listId, members] of Object.entries(byList)) {
    if (members.size === targetIds.size && [...targetIds].every((id) => members.has(id))) {
      return listId;
    }
  }

  return null;
}

export async function createSharedList(
  creatorId: string,
  inviteeIds: string[]
): Promise<string> {
  const { data: list, error } = await supabase
    .from('shared_lists')
    .insert({ creator_id: creatorId })
    .select('id')
    .single();

  if (error || !list) throw new Error(error?.message ?? 'Failed to create list');

  const memberRows = [
    { list_id: list.id, user_id: creatorId, invited_by_id: null, status: 'accepted' },
    ...inviteeIds.map((id) => ({
      list_id: list.id,
      user_id: id,
      invited_by_id: creatorId,
      status: 'pending',
    })),
  ];

  const { error: memberError } = await supabase.from('shared_list_members').insert(memberRows);
  if (memberError) throw new Error(memberError.message);

  return list.id;
}

export async function respondToInvite(
  listId: string,
  userId: string,
  response: 'accepted' | 'declined'
): Promise<void> {
  await supabase
    .from('shared_list_members')
    .update({ status: response, responded_at: new Date().toISOString() })
    .eq('list_id', listId)
    .eq('user_id', userId);

}

export async function getListActivities(listId: string): Promise<(Activity & { added_by: Profile | null })[]> {
  const { data } = await supabase
    .from('shared_list_activities')
    .select(`
      activity_id,
      added_by_id,
      created_at,
      activities (
        id, user_id, name, category, notes, is_open, is_private,
        source, completed_at, created_at, dates, google_place_id
      ),
      profiles!added_by_id (id, display_name, avatar_url, instagram_handle, phone_number, username, created_at)
    `)
    .eq('list_id', listId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    ...(row.activities as unknown as Activity),
    added_by: row.profiles as unknown as Profile | null,
  }));
}

export async function addActivityToList(
  listId: string,
  activityId: string,
  addedById: string
): Promise<void> {
  await supabase
    .from('shared_list_activities')
    .insert({ list_id: listId, activity_id: activityId, added_by_id: addedById });
}

export async function removeActivityFromList(
  listId: string,
  activityId: string
): Promise<void> {
  await supabase
    .from('shared_list_activities')
    .delete()
    .eq('list_id', listId)
    .eq('activity_id', activityId);
}
