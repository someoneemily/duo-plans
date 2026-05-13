import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Animated, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getMyActivities, getOpenActivities } from '../../lib/activities';
import { getMySharedLists, respondToInvite, createSharedList, addActivityToList } from '../../lib/sharedLists';
import { markInvitesSeen } from '../../lib/inviteBadge';
import { checkIsFriendsBetaUser, hasFriendsEntered, setFriendsEntered } from '../../lib/friendsBeta';
import { colors } from '../../lib/colors';
import type { SharedList, Profile, Activity } from '../../lib/types';

type BetaState = 'checking' | 'none' | 'eligible' | 'entering' | 'entered';

type AffinityPerson = {
  profile: Profile;
  mutualCount: number;
  sharedActivityNames: string[];
  mySharedActivities: Activity[];
};

function listLabel(list: SharedList, userId: string): string {
  const others = list.members.filter((m) => m.user_id !== userId);
  if (others.length === 0) return 'just you';
  if (others.length === 1) return `with ${others[0].profile?.display_name ?? 'someone'}`;
  const names = others.map((m) => m.profile?.display_name ?? 'someone');
  return `with ${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function Avatar({ name, size = 34 }: { name: string | null; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {name?.[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
}

function SharedListRow({ list, userId, onRespond, onNavigate }: {
  list: SharedList;
  userId: string;
  onRespond: () => void;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const label = listLabel(list, userId);
  const others = list.members.filter((m) => m.user_id !== userId);
  const myStatus = list.members.find((m) => m.user_id === userId)?.status;
  const isInvitee = list.creator_id !== userId && myStatus === 'pending';
  const isInviter = list.creator_id === userId && myStatus === 'pending';
  const isActive = myStatus === 'accepted';
  const isDeclined = myStatus === 'declined';

  async function handleAccept() {
    await respondToInvite(list.id, userId, 'accepted');
    onRespond();
  }

  async function handleDecline() {
    await respondToInvite(list.id, userId, 'declined');
    onRespond();
  }

  const canNavigate = !isDeclined && !isInvitee;

  return (
    <TouchableOpacity
      style={[styles.row, isDeclined && styles.rowDeclined]}
      onPress={canNavigate ? () => { onNavigate(); router.push(`/friends/${list.id}` as any); } : undefined}
      activeOpacity={canNavigate ? 0.7 : 1}
    >
      <View style={styles.rowAvatars}>
        {others.slice(0, 3).map((m) => (
          <Avatar key={m.user_id} name={m.profile?.display_name ?? null} size={32} />
        ))}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, isDeclined && { color: colors.muted }]}>{label}</Text>
      </View>
      {isInvitee && (
        <View style={styles.respondRow}>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
            <Text style={styles.acceptText}>accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.declineText}>decline</Text>
          </TouchableOpacity>
        </View>
      )}
      {canNavigate && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

function AffinityRow({ person, onStartList }: {
  person: AffinityPerson;
  onStartList: (person: AffinityPerson) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <Avatar name={person.profile.display_name} size={34} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>{person.profile.display_name ?? 'someone'}</Text>
          <Text style={styles.rowMeta}>
            {person.mutualCount} {person.mutualCount === 1 ? 'plan' : 'plans'} in common
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedBody}>
          {person.sharedActivityNames.map((name) => (
            <Text key={name} style={styles.sharedActivity}>✦ {name}</Text>
          ))}
          <TouchableOpacity
            style={styles.startListBtn}
            onPress={() => onStartList(person)}
          >
            <Text style={styles.startListText}>
              start a list with {person.profile.display_name ?? 'them'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function Friends() {
  const router = useRouter();

  // Coming-soon animation (sequential fade-in of each element)
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(10)).current;
  const comingSoonOpacity = useRef(new Animated.Value(0)).current;
  const comingSoonY = useRef(new Animated.Value(10)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Beta gate
  const [betaState, setBetaState] = useState<BetaState>('checking');
  const returningFromSubscreen = useRef(false);

  // Data
  const [userId, setUserId] = useState<string | null>(null);
  const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
  const [affinityPeople, setAffinityPeople] = useState<AffinityPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function runComingSoonAnimation(showPill: boolean, onDone?: () => void) {
    titleOpacity.setValue(0);
    titleY.setValue(10);
    comingSoonOpacity.setValue(0);
    comingSoonY.setValue(10);
    pillOpacity.setValue(0);
    screenOpacity.setValue(1);

    const seq: Animated.CompositeAnimation[] = [
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(comingSoonOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(comingSoonY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ];
    if (showPill) {
      seq.push(Animated.delay(400));
      seq.push(Animated.timing(pillOpacity, { toValue: 1, duration: 500, useNativeDriver: true }));
    }
    if (onDone) {
      seq.push(Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }));
    }
    Animated.sequence(seq).start(({ finished }) => {
      if (finished && onDone) onDone();
    });
  }

  async function load(uid: string) {
    try {
      const [lists, myActs, openActs] = await Promise.all([
        getMySharedLists(uid),
        getMyActivities(uid),
        getOpenActivities(uid),
      ]);

      setSharedLists(lists);

      const myNames = new Set(myActs.filter((a) => !a.completed_at).map((a) => a.name.toLowerCase()));
      const listUserIds = new Set(lists.flatMap((l) => l.members.map((m) => m.user_id)));

      const byUser: Record<string, { profile: Profile; names: string[] }> = {};
      openActs.forEach((a) => {
        if (!a.profiles || listUserIds.has(a.user_id)) return;
        const key = a.user_id;
        if (!byUser[key]) byUser[key] = { profile: a.profiles as unknown as Profile, names: [] };
        if (myNames.has(a.name.toLowerCase())) {
          byUser[key].names.push(a.name);
        }
      });

      const affinity: AffinityPerson[] = Object.values(byUser)
        .filter((u) => u.names.length > 0)
        .sort((a, b) => b.names.length - a.names.length)
        .slice(0, 20)
        .map((u) => {
          const nameSet = new Set(u.names.map((n) => n.toLowerCase()));
          return {
            profile: u.profile,
            mutualCount: u.names.length,
            sharedActivityNames: u.names,
            mySharedActivities: myActs.filter((a) => nameSet.has(a.name.toLowerCase()) && !a.completed_at),
          };
        });

      setAffinityPeople(affinity);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      markInvitesSeen();

      // Returning from a friends sub-screen — just reload data, no animation
      if (returningFromSubscreen.current) {
        returningFromSubscreen.current = false;
        supabase.auth.getSession().then(({ data }) => {
          const uid = data.session?.user.id ?? null;
          if (uid) load(uid);
        });
        return;
      }

      supabase.auth.getSession().then(async ({ data }) => {
        const uid = data.session?.user.id ?? null;
        setUserId(uid);

        if (!uid) { setBetaState('none'); runComingSoonAnimation(false); return; }

        const entered = await hasFriendsEntered();
        if (entered) {
          setBetaState('entering');
          runComingSoonAnimation(false, () => {
            setBetaState('entered');
            load(uid);
          });
          return;
        }

        const isBeta = await checkIsFriendsBetaUser(uid);
        if (isBeta) {
          setBetaState('eligible');
          runComingSoonAnimation(true);
        } else {
          setBetaState('none');
          runComingSoonAnimation(false);
        }
        setLoading(false);
      });
    }, [])
  );

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId]);

  async function handleEnter() {
    await setFriendsEntered();
    setBetaState('entered');
    if (userId) load(userId);
  }

  async function handleStartListWithAffinity(person: AffinityPerson) {
    if (!userId) return;
    const listId = await createSharedList(userId, [person.profile.id]);
    await Promise.all(
      person.mySharedActivities.map((a) => addActivityToList(listId, a.id, userId))
    );
    returningFromSubscreen.current = true;
    router.push(`/friends/${listId}` as any);
  }

  const isAllDeclined = (l: SharedList) => {
    const nonCreator = l.members.filter((m) => m.user_id !== l.creator_id);
    return nonCreator.length > 0 && nonCreator.every((m) => m.status === 'declined');
  };
  // Creator is always treated as accepted regardless of stored DB status (covers old rows)
  const effectiveStatus = (l: SharedList) =>
    l.creator_id === userId ? 'accepted' : l.members.find((m) => m.user_id === userId)?.status;
  const pending = sharedLists.filter((l) => effectiveStatus(l) === 'pending');
  const active = sharedLists.filter((l) => effectiveStatus(l) === 'accepted' && !isAllDeclined(l));
  const archived = sharedLists.filter((l) => effectiveStatus(l) === 'accepted' && isAllDeclined(l));
  const declined = sharedLists.filter((l) => effectiveStatus(l) === 'declined');

  return (
    <SafeAreaView style={styles.container}>
      {/* Coming-soon screen: sequential stacked fade-in, shown for non-entered users + as entrance animation for entered users */}
      {(betaState === 'none' || betaState === 'eligible' || betaState === 'checking' || betaState === 'entering') && (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.comingSoonScreen, { opacity: screenOpacity }]}>
          <Animated.Text style={[styles.teaserLine, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
            Create memories{'\n'}with friends.
          </Animated.Text>
          <Animated.Text style={[styles.comingSoon, { opacity: comingSoonOpacity, transform: [{ translateY: comingSoonY }] }]}>
            coming soon
          </Animated.Text>
          {betaState === 'eligible' && (
            <Animated.View style={{ opacity: pillOpacity }}>
              <TouchableOpacity style={styles.betaPill} onPress={handleEnter}>
                <Text style={styles.betaPillText}>You're in the IN group, enter for whimsy ✦</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Full content: only for entered users */}
      {betaState === 'entered' && (
        <>
        {loading && !refreshing ? (
          <View style={styles.center}><ActivityIndicator color={colors.subtle} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.subtle} />}
          >
            {/* Header */}
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>friends</Text>
            </View>

            {/* Section A: Shared Lists */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>SHARED LISTS</Text>
              <TouchableOpacity
                onPress={() => { returningFromSubscreen.current = true; router.push('/friends/new' as any); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.newListBtn}>+ new</Text>
              </TouchableOpacity>
            </View>

            {pending.length === 0 && active.length === 0 && declined.length === 0 && archived.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHint}>Keep your group chat ideas alive here</Text>
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => { returningFromSubscreen.current = true; router.push('/friends/new' as any); }}
                >
                  <Text style={styles.outlineBtnText}>START ONE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listGroup}>
                {pending.map((l) => (
                  <SharedListRow key={l.id} list={l} userId={userId!} onRespond={() => load(userId!)} onNavigate={() => { returningFromSubscreen.current = true; }} />
                ))}
                {active.map((l) => (
                  <SharedListRow key={l.id} list={l} userId={userId!} onRespond={() => load(userId!)} onNavigate={() => { returningFromSubscreen.current = true; }} />
                ))}
                {declined.map((l) => (
                  <SharedListRow key={l.id} list={l} userId={userId!} onRespond={() => load(userId!)} onNavigate={() => { returningFromSubscreen.current = true; }} />
                ))}
              </View>
            )}

            {archived.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 32, marginBottom: 10, paddingHorizontal: 20 }]}>
                  ARCHIVED
                </Text>
                <View style={[styles.listGroup, { opacity: 0.45 }]}>
                  {archived.map((l) => (
                    <SharedListRow key={l.id} list={l} userId={userId!} onRespond={() => load(userId!)} onNavigate={() => { returningFromSubscreen.current = true; }} />
                  ))}
                </View>
              </>
            )}

            {/* Section B: People You Might Click With */}
            {affinityPeople.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 36, marginBottom: 10, paddingHorizontal: 20 }]}>
                  PEOPLE YOU MIGHT CLICK WITH
                </Text>
                <View style={styles.listGroup}>
                  {affinityPeople.map((p) => (
                    <AffinityRow
                      key={p.profile.id}
                      person={p}
                      onStartList={handleStartListWithAffinity}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 60 },

  comingSoonScreen: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    gap: 8,
    paddingBottom: 60,
  },
  teaserLine: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: colors.text,
    fontWeight: '400',
    lineHeight: 36,
    textAlign: 'center',
  },

  titleRow: { justifyContent: 'center', alignItems: 'center' },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    fontWeight: '400',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.label,
    fontWeight: '500',
    letterSpacing: 0.8,
  },
  newListBtn: { fontSize: 12, color: colors.accent, letterSpacing: 0.5 },

  listGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowDeclined: { opacity: 0.45 },
  rowAvatars: { flexDirection: 'row', gap: -8 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, color: colors.text, marginBottom: 2 },
  rowMeta: { fontSize: 12, color: colors.muted },
  chevron: { fontSize: 18, color: colors.muted },

  respondRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  acceptText: { fontSize: 12, color: colors.accent },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  declineText: { fontSize: 12, color: colors.muted },

  expandedBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  sharedActivity: { fontSize: 13, color: colors.text },
  startListBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    alignSelf: 'flex-start',
  },
  startListText: { fontSize: 12, color: colors.accent },

  emptyCard: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  emptyHint: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },

  comingSoon: {
    fontSize: 17,
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  betaPill: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.tint,
  },
  betaPillText: { fontSize: 13, color: colors.accent, textAlign: 'center' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.text,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  outlineBtnText: { fontSize: 11, color: colors.text, letterSpacing: 1.5, fontWeight: '500' },

  avatar: {
    backgroundColor: colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '600' },
});
