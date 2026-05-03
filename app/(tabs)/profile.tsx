import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { openInstagram } from '../../lib/linking';
import { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { getMyActivities } from '../../lib/activities';
import { getMyMatches } from '../../lib/matches';
import type { Activity, Match } from '../../lib/types';

function getTier(completed: number) {
  if (completed >= 10) return 'veteran';
  if (completed >= 5) return 'regular';
  if (completed >= 1) return 'explorer';
  return 'new';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const [profile, setProfile] = useState<{ display_name: string | null; instagram_handle: string | null; phone_number: string | null } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(async ({ data }) => {
        const uid = data.session?.user.id;
        if (!uid) return;
        const [{ data: prof }, acts, matches] = await Promise.all([
          supabase.from('profiles').select('display_name, instagram_handle, phone_number').eq('id', uid).single(),
          getMyActivities(uid),
          getMyMatches(uid),
        ]);
        setProfile(prof);
        setActivities(acts);
        setMatches(matches);
        setLoading(false);
      });
    }, [])
  );

  async function handleSignOut() {
    await signOut();
    router.replace('/auth');
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

  // Build lookup: activity id → match (for "completed with" info)
  const activityMatchMap: Record<string, Match> = {};
  matches.forEach((m) => {
    if (m.activity1_id) activityMatchMap[m.activity1_id] = m;
    if (m.activity2_id) activityMatchMap[m.activity2_id] = m;
  });

  const q = searchQuery.trim().toLowerCase();
  const filteredDone = q
    ? allDone.filter((a) => {
        const matchedName = activityMatchMap[a.id]?.other_profile?.display_name?.toLowerCase() ?? '';
        const dateStr = formatDate(a.completed_at!).toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          matchedName.includes(q) ||
          dateStr.includes(q)
        );
      })
    : allDone;

  const groupedDone = groupByDay(filteredDone);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>profile</Text>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.tier}>{tier}</Text>
          {profile?.instagram_handle ? (
            <TouchableOpacity
              onPress={() => openInstagram(profile.instagram_handle!)}
              style={{ marginTop: 10 }}
            >
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
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)/matches')}>
            <Text style={styles.statNum}>{matches.length}</Text>
            <Text style={styles.statLabel}>matches</Text>
          </TouchableOpacity>
        </View>

        {/* Activity log */}
        <Text style={styles.sectionLabel}>done · {allDone.length}</Text>

        {allDone.length > 0 && (
          <View style={styles.searchWrap}>
            <TextInput
              style={[styles.searchInput, { outline: 'none' } as any]}
              placeholder="search by person or date..."
              placeholderTextColor="#ccc"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
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
                  return (
                    <View key={item.id} style={styles.logRow}>
                      <View style={styles.logLeft}>
                        <Text style={styles.logName}>{item.name}</Text>
                        <Text style={styles.logMeta}>
                          {item.category.toLowerCase()}
                          {withName ? ` · with ${withName}` : ' · solo'}
                        </Text>
                      </View>
                      {item.is_private && <Text style={styles.lockIcon}>🔒</Text>}
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
          <TouchableOpacity style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
          <Text style={styles.signOutText}>sign out</Text>
        </TouchableOpacity>
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
  identity: { alignItems: 'center', paddingBottom: 28 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: '#ddd',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 22, color: '#111', fontFamily: 'Georgia' },
  name: { fontSize: 18, color: '#111', fontFamily: 'Georgia', marginBottom: 6 },
  tier: { fontSize: 11, color: '#c9a0dc', letterSpacing: 1.5, textTransform: 'uppercase' },
  igHandle: { fontSize: 13, color: '#c9a0dc', textDecorationLine: 'underline' },
  phoneNumber: { fontSize: 13, color: '#bbb', marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  stat: { flex: 1, paddingVertical: 20, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Georgia', color: '#111', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#bbb', letterSpacing: 0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#ececec' },
  sectionLabel: {
    fontSize: 12, color: '#999',
    paddingHorizontal: 20, marginTop: 28, marginBottom: 8,
  },
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  searchInput: {
    fontSize: 13,
    color: '#111',
    paddingVertical: 10,
  },
  emptyDone: {
    marginHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#ccc', fontStyle: 'italic' },
  logWrap: { marginHorizontal: 20 },
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 6,
    gap: 10,
  },
  dayLabel: { fontSize: 11, color: '#bbb', letterSpacing: 0.5 },
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
  logMeta: { fontSize: 12, color: '#bbb', marginTop: 2 },
  lockIcon: { fontSize: 11, opacity: 0.3 },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
  settingsLabel: { fontSize: 14, color: '#111' },
  chevron: { fontSize: 18, color: '#ccc' },
  signOut: { marginTop: 32, alignItems: 'center' },
  signOutText: { fontSize: 13, color: '#bbb' },
});
