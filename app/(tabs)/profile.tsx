import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { openInstagram } from '../../lib/linking';
import { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { getMyActivities, getInterestedUsers } from '../../lib/activities';
import MatchBell from '../../components/MatchBell';
import { colors } from '../../lib/colors';
import { getMyMatches } from '../../lib/matches';
import type { Activity, Match, Profile } from '../../lib/types';

function getTier(completed: number) {
  if (completed >= 10) return 'veteran';
  if (completed >= 5) return 'regular';
  if (completed >= 1) return 'explorer';
  return 'new';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function groupByDay(acts: Activity[]): { date: string; items: Activity[] }[] {
  const map: Record<string, Activity[]> = {};
  acts.forEach((a) => {
    const key = formatDate(a.completed_at!);
    if (!map[key]) map[key] = [];
    map[key].push(a);
  });
  return Object.entries(map).map(([date, items]) => ({ date, items }));
}

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; instagram_handle: string | null; phone_number: string | null } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [interestedCache, setInterestedCache] = useState<Record<string, Profile[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  async function load(uid: string) {
    const [{ data: prof }, acts, matchData] = await Promise.all([
      supabase.from('profiles').select('display_name, username, instagram_handle, phone_number').eq('id', uid).single(),
      getMyActivities(uid),
      getMyMatches(uid),
    ]);
    setProfile(prof);
    setActivities(acts);
    setMatches(matchData);
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id ?? null;
        if (!uid) { router.replace('/(public)/explore'); return; }
        setUserId(uid);
        load(uid);
      });
    }, [])
  );

  async function handleToggleExpand(item: Activity) {
    if (expandedId === item.id) { setExpandedId(null); return; }
    setExpandedId(item.id);
    if (!interestedCache[item.id]) {
      setLoadingId(item.id);
      try {
        const users = await getInterestedUsers(item.name);
        setInterestedCache((c) => ({ ...c, [item.id]: users }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(public)/explore');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#ccc" /></View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.display_name ?? 'you';
  const allDone = activities
    .filter((a) => !!a.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
  const planCount = activities.length;
  const tier = getTier(allDone.length);

  const activityMatchMap: Record<string, Match> = {};
  matches.forEach((m) => {
    if (m.activity1_id) activityMatchMap[m.activity1_id] = m;
    if (m.activity2_id) activityMatchMap[m.activity2_id] = m;
  });

  // Unique people from matches for name suggestions
  const matchedPeople = Object.values(
    matches.reduce((acc, m) => {
      const p = m.other_profile;
      if (p?.id) acc[p.id] = p;
      return acc;
    }, {} as Record<string, Profile>)
  );

  const suggestions: Profile[] = nameQuery.length > 0
    ? matchedPeople
        .filter((p) => p.display_name?.toLowerCase().includes(nameQuery.toLowerCase()))
        .slice(0, 3)
    : [];

  // Available months from completed activities
  const availableMonths = [...new Set(allDone.map((a) => formatMonth(a.completed_at!)))];

  const q = nameQuery.trim().toLowerCase();
  const filteredDone = allDone.filter((a) => {
    const matchedName = activityMatchMap[a.id]?.other_profile?.display_name?.toLowerCase() ?? '';
    const nameMatch = !q || a.name.toLowerCase().includes(q) || matchedName.includes(q);
    const monthMatch = !selectedMonth || formatMonth(a.completed_at!) === selectedMonth;
    return nameMatch && monthMatch;
  });

  const groupedDone = groupByDay(filteredDone);
  const showingSuggestions = suggestions.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ccc" />}
        >
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>profile</Text>
          <View style={styles.headerIcons}>
            <MatchBell />
          </View>
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {profile?.username ? (
            <Text style={styles.username}>@{profile.username}</Text>
          ) : null}
          <Text style={styles.tier}>{tier}</Text>
          {profile?.instagram_handle ? (
            <TouchableOpacity onPress={() => openInstagram(profile.instagram_handle!)} style={{ marginTop: 10 }}>
              <Text style={styles.igHandle}>@{profile.instagram_handle.replace(/^@/, '')}</Text>
            </TouchableOpacity>
          ) : null}
          {profile?.phone_number ? (
            <Text style={styles.phoneNumber}>{profile.phone_number}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.statNum}>{planCount}</Text>
            <Text style={styles.statLabel}>plans</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.statNum}>{allDone.length}</Text>
            <Text style={styles.statLabel}>done</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/matches' as any)}>
            <Text style={styles.statNum}>{matches.length}</Text>
            <Text style={styles.statLabel}>matches</Text>
          </TouchableOpacity>
        </View>

        {/* Activity log */}
        <Text style={styles.sectionLabel}>done · {allDone.length}</Text>

        {allDone.length > 0 && (
          <View style={styles.searchBlock}>
            {/* Name search */}
            <View style={styles.searchWrap}>
              <TextInput
                style={[styles.searchInput, { outline: 'none' } as any]}
                placeholder="search by person..."
                placeholderTextColor="#ccc"
                value={nameQuery}
                onChangeText={setNameQuery}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Profile suggestions */}
            {showingSuggestions && (
              <View style={styles.suggestions}>
                {suggestions.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.suggestion}
                    onPress={() => setNameQuery(p.display_name ?? '')}
                  >
                    <Text style={styles.suggestionName}>{p.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Month chips */}
            {availableMonths.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.monthRow}
                contentContainerStyle={styles.monthRowContent}
              >
                {availableMonths.map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.monthChip, selectedMonth === month && styles.monthChipActive]}
                    onPress={() => setSelectedMonth(selectedMonth === month ? null : month)}
                  >
                    <Text style={[styles.monthChipText, selectedMonth === month && styles.monthChipTextActive]}>
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {allDone.length === 0 ? (
          <View style={styles.emptyDone}>
            <Text style={styles.emptyText}>nothing completed yet.</Text>
          </View>
        ) : filteredDone.length === 0 ? (
          <View style={styles.emptyDone}>
            <Text style={styles.emptyText}>no results.</Text>
          </View>
        ) : (
          <View style={styles.logWrap}>
            {groupedDone.map(({ date, items }) => (
              <View key={date}>
                <View style={styles.dayDivider}>
                  <Text style={styles.dayLabel}>{date}</Text>
                  <View style={styles.dayLine} />
                </View>
                {items.map((item) => {
                  const match = activityMatchMap[item.id];
                  const withName = match?.other_profile?.display_name;
                  const expanded = expandedId === item.id;
                  const interested = interestedCache[item.id] ?? [];
                  const isLoadingItem = loadingId === item.id;

                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={styles.logRow}
                        onPress={() => handleToggleExpand(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.logLeft}>
                          <Text style={styles.logName}>{item.name}</Text>
                          <Text style={styles.logMeta}>
                            {item.category.toLowerCase()}
                            {withName ? ` · with ${withName}` : ' · solo'}
                          </Text>
                        </View>
                        <View style={styles.logRight}>
                          {item.is_private && <Text style={styles.lockIcon}>🔒</Text>}
                          <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
                        </View>
                      </TouchableOpacity>

                      {expanded && (
                        <View style={styles.expandedBody}>
                          {isLoadingItem ? (
                            <ActivityIndicator color="#ccc" size="small" />
                          ) : interested.length === 0 ? (
                            <Text style={styles.noOneText}>no one else interested</Text>
                          ) : (
                            <>
                              <Text style={styles.interestedLabel}>interested · {interested.length}</Text>
                              {interested.map((p) => (
                                <View key={p.id} style={styles.personRow}>
                                  <Text style={styles.personName}>{p.display_name ?? 'someone'}</Text>
                                  {p.instagram_handle ? (
                                    <TouchableOpacity onPress={() => openInstagram(p.instagram_handle!)}>
                                      <Text style={styles.igLink}>@{p.instagram_handle.replace(/^@/, '')}</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ))}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>settings</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/profile/edit')}>
            <Text style={styles.settingsLabel}>edit profile</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut}>
            <Text style={[styles.settingsLabel, styles.signOutLabel]}>sign out</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 60 },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    fontWeight: '400',
  },
  titleRow: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  headerIcons: { position: 'absolute', right: 16, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  identity: { alignItems: 'center', paddingBottom: 28 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 22, color: '#111', fontFamily: 'Georgia' },
  name: { fontSize: 18, color: '#111', fontFamily: 'Georgia', marginBottom: 6 },
  username: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  tier: { fontSize: 11, color: colors.accent, letterSpacing: 1.5, textTransform: 'uppercase' },
  igHandle: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
  phoneNumber: { fontSize: 13, color: colors.muted, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  stat: { flex: 1, paddingVertical: 20, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Georgia', color: '#111', marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#ececec' },
  sectionLabel: {
    fontSize: 12, color: colors.label,
    paddingHorizontal: 20, marginTop: 28, marginBottom: 8,
  },
  searchBlock: { marginHorizontal: 20, marginBottom: 4 },
  searchWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    marginBottom: 2,
  },
  searchInput: {
    fontSize: 16,
    color: '#111',
    paddingVertical: 10,
  },
  suggestions: {
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
  suggestionName: { fontSize: 14, color: '#111' },
  monthRow: { marginTop: 12, marginBottom: 8 },
  monthRowContent: { gap: 8, paddingRight: 4 },
  monthChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16,
  },
  monthChipActive: { backgroundColor: '#111', borderColor: '#111' },
  monthChipText: { fontSize: 12, color: colors.label },
  monthChipTextActive: { color: '#fff' },
  emptyDone: {
    marginHorizontal: 20, paddingVertical: 24,
    borderWidth: 1, borderColor: '#ececec', borderRadius: 10, alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.subtle, fontStyle: 'italic' },
  logWrap: { marginHorizontal: 20 },
  dayDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 6, gap: 10 },
  dayLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#ececec' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
  logLeft: { flex: 1 },
  logName: { fontSize: 15, color: '#111' },
  logMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockIcon: { fontSize: 11, opacity: 0.3 },
  chevron: { fontSize: 15, color: colors.subtle },
  expandedBody: {
    paddingHorizontal: 4, paddingTop: 10, paddingBottom: 14,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ececec',
    gap: 10,
  },
  interestedLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personName: { fontSize: 14, color: '#111' },
  igLink: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
  noOneText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  settingsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f5f5f5',
  },
  settingsLabel: { fontSize: 14, color: '#111' },
  signOutLabel: { color: '#e05252' },
});
