import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getMySharedLists, getListActivities, addActivityToList, removeActivityFromList, respondToInvite } from '../../lib/sharedLists';
import { getMyActivities, markAsCompleted } from '../../lib/activities';
import { colors } from '../../lib/colors';
import type { SharedList, Activity } from '../../lib/types';

function Avatar({ name, size = 32, pending = false }: { name: string | null; size?: number; pending?: boolean }) {
  return (
    <View style={{ position: 'relative' }}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, pending && styles.avatarPending]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
          {name?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      {pending && (
        <View style={[styles.pendingDot, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      )}
    </View>
  );
}

function listLabel(list: SharedList, userId: string): string {
  const others = list.members.filter((m) => m.user_id !== userId);
  if (others.length === 0) return 'shared list';
  if (others.length === 1) return `with ${others[0].profile?.display_name ?? 'someone'}`;
  const names = others.map((m) => m.profile?.display_name ?? 'someone');
  return `with ${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export default function SharedListDetail() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<SharedList | null>(null);
  const [activities, setActivities] = useState<(Activity & { added_by: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  async function load(uid: string) {
    try {
      const [lists, acts] = await Promise.all([
        getMySharedLists(uid),
        getListActivities(listId),
      ]);
      const found = lists.find((l) => l.id === listId) ?? null;
      setList(found);
      setActivities(acts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id ?? null;
        setUserId(uid);
        if (uid) load(uid);
        else setLoading(false);
      });
    }, [listId])
  );

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId]);

  async function handleShowPicker() {
    if (!userId) return;
    const mine = await getMyActivities(userId);
    const pinnedIds = new Set(activities.map((a) => a.id));
    setMyActivities(mine.filter((a) => !pinnedIds.has(a.id) && !a.completed_at));
    setShowPicker(true);
  }

  async function handleAddActivity(activity: Activity) {
    if (!userId) return;
    setAddingActivity(true);
    setShowPicker(false);
    await addActivityToList(listId, activity.id, userId);
    await load(userId);
    setAddingActivity(false);
  }

  async function handleRemove(activityId: string) {
    if (!userId) return;
    await removeActivityFromList(listId, activityId);
    load(userId);
  }

  async function handleComplete(activityId: string) {
    if (!userId) return;
    await markAsCompleted(activityId);
    load(userId);
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/friends' as any);
  }

  const backBtn = (
    <Stack.Screen options={{ headerLeft: () => (
      <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backBtn}>‹</Text>
      </TouchableOpacity>
    )}} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {backBtn}
        <View style={styles.center}><ActivityIndicator color={colors.subtle} /></View>
      </SafeAreaView>
    );
  }

  // Not a member — redirect silently
  if (!list) {
    router.replace('/(tabs)/friends' as any);
    return null;
  }

  const myMemberStatus = list.members.find((m) => m.user_id === userId)?.status;

  // Pending invitee — show invite card
  const isPendingInvitee = list.creator_id !== userId && myMemberStatus === 'pending';
  if (isPendingInvitee) {
    const creator = list.members.find((m) => m.user_id === list.creator_id);
    const creatorName = creator?.profile?.display_name ?? 'someone';

    async function handleAccept() {
      await respondToInvite(list!.id, userId!, 'accepted');
      load(userId!);
    }
    async function handleDecline() {
      await respondToInvite(list!.id, userId!, 'declined');
      router.replace('/(tabs)/friends' as any);
    }

    return (
      <SafeAreaView style={styles.container}>
        {backBtn}
        <View style={styles.inviteCard}>
          <Avatar name={creatorName} size={56} />
          <Text style={styles.inviteTitle}>{creatorName} invited you</Text>
          <Text style={styles.inviteSubtitle}>to a shared plans list</Text>
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptText}>accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineText}>decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const label = listLabel(list, userId ?? '');

  return (
    <SafeAreaView style={styles.container}>
      {backBtn}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.subtle} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.memberAvatars}>
            {list.members
              .filter((m) => m.status !== 'declined')
              .map((m) => (
                <Avatar key={m.user_id} name={m.profile?.display_name ?? null} size={36} pending={m.status === 'pending' && m.user_id !== list.creator_id} />
              ))}
          </View>
          <Text style={styles.listLabel}>{label}</Text>
        </View>

        {/* Members */}
        <Text style={styles.sectionLabel}>MEMBERS</Text>
        <View style={styles.group}>
          {list.members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <Avatar name={m.profile?.display_name ?? null} size={30} />
              <Text style={styles.memberName}>{m.profile?.display_name ?? 'someone'}</Text>
              {m.status !== 'accepted' && m.user_id !== list.creator_id && (
                <View style={[styles.statusPill, m.status === 'declined' && styles.statusPillDeclined]}>
                  <Text style={[styles.statusText, m.status === 'declined' && styles.statusTextDeclined]}>
                    {m.status}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Activities */}
        <View style={styles.activitiesHeader}>
          <Text style={styles.sectionLabel}>ACTIVITIES</Text>
          {(myMemberStatus === 'accepted' || list.creator_id === userId) && (
            <View style={styles.addBtns}>
              {addingActivity
                ? <ActivityIndicator size="small" color={colors.accent} />
                : (
                  <>
                    <TouchableOpacity style={styles.addBtnPill} onPress={() => router.push(`/activity/add?listId=${listId}` as any)}>
                      <Text style={styles.addBtnPillText}>+ add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addBtnPill} onPress={handleShowPicker}>
                      <Text style={styles.addBtnPillText}>from plans</Text>
                    </TouchableOpacity>
                  </>
                )
              }
            </View>
          )}
        </View>

        {activities.length === 0 ? (
          <View style={styles.emptyActivities}>
            <Text style={styles.emptyHint}>No activities yet.</Text>
          </View>
        ) : activities.length > 0 ? (
          <View style={styles.group}>
            {activities.map((a) => (
              <View key={a.id} style={[styles.activityRow, !!a.completed_at && styles.activityRowDone]}>
                <TouchableOpacity
                  onPress={a.user_id === userId && !a.completed_at ? () => handleComplete(a.id) : undefined}
                  style={styles.circle}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.5}
                >
                  {a.completed_at
                    ? <Text style={styles.circleDone}>✓</Text>
                    : <View style={styles.circleEmpty} />
                  }
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityName, !!a.completed_at && styles.activityNameDone]}>{a.name}</Text>
                  <Text style={styles.activityMeta}>
                    {a.added_by?.display_name ? `added by ${a.added_by.display_name}` : ''}
                  </Text>
                </View>
                {a.added_by?.id === userId && !a.completed_at && (
                  <TouchableOpacity onPress={() => handleRemove(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeBtn}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* Activity picker */}
        {showPicker && (
          <View style={styles.picker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>add from my plans</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.pickerClose}>×</Text>
              </TouchableOpacity>
            </View>
            {myActivities.length === 0 ? (
              <Text style={[styles.emptyHint, styles.pickerEmptyHint]}>No activities to add.</Text>
            ) : (
              myActivities.map((a) => (
                <TouchableOpacity key={a.id} style={styles.pickerRow} onPress={() => handleAddActivity(a)}>
                  <Text style={styles.pickerName}>{a.name}</Text>
                  <Text style={styles.pickerMeta}>{a.category.toLowerCase()}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 60 },
  backBtn: { fontSize: 28, color: colors.muted, paddingLeft: 16 },
  notFound: { fontSize: 15, color: colors.muted },

  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 },
  memberAvatars: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  listLabel: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: colors.text,
    fontWeight: '400',
    textAlign: 'center',
  },

  sectionLabel: {
    fontSize: 12,
    color: colors.label,
    fontWeight: '500',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: 28,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberName: { flex: 1, fontSize: 14, color: colors.text },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  statusPillDeclined: { borderColor: colors.muted },
  statusText: { fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  statusTextDeclined: { color: colors.muted },

  activitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
    paddingBottom: 12,
  },
  addBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtnPill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  addBtnPillText: { fontSize: 13, color: colors.accent },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  activityRowDone: { opacity: 0.45 },
  circle: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  circleEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.subtle },
  circleDone: { fontSize: 13, color: colors.accent },
  activityName: { fontSize: 15, color: colors.text, marginBottom: 2 },
  activityNameDone: { textDecorationLine: 'line-through', color: colors.muted },
  activityMeta: { fontSize: 12, color: colors.muted },
  removeBtn: { fontSize: 18, color: colors.muted, lineHeight: 22, marginLeft: 12 },

  emptyActivities: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: 28,
  },
  emptyHint: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  pickerEmptyHint: { paddingHorizontal: 16, paddingVertical: 12 },

  picker: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerTitle: { fontSize: 13, color: colors.label, fontWeight: '500', letterSpacing: 0.5 },
  pickerClose: { fontSize: 18, color: colors.muted },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerName: { fontSize: 14, color: colors.text },
  pickerMeta: { fontSize: 12, color: colors.muted },

  avatar: { backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center' },
  avatarPending: { opacity: 0.5 },
  avatarText: { color: colors.accent, fontWeight: '600' },
  pendingDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  inviteCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
    paddingBottom: 60,
  },
  inviteTitle: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: colors.text,
    fontWeight: '400',
    marginTop: 16,
    textAlign: 'center',
  },
  inviteSubtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  inviteActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  acceptBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  acceptText: { fontSize: 13, color: colors.accent },
  declineBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  declineText: { fontSize: 13, color: colors.muted },
});
