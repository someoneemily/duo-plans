import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity, Linking,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getMyMatches } from '../lib/matches';
import { getInterestedUsers } from '../lib/activities';
import { openInstagram } from '../lib/linking';
import { markMatchesSeen } from '../lib/matchBadge';
import { colors } from '../lib/colors';
import type { Match, Profile } from '../lib/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Matches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [interestedCache, setInterestedCache] = useState<Record<string, Profile[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function load(uid: string) {
    try {
      const data = await getMyMatches(uid);
      setMatches(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    markMatchesSeen();
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
      else setLoading(false);
    });
  }, []);

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  async function handleToggleExpand(match: Match) {
    if (expandedId === match.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(match.id);
    if (!interestedCache[match.id]) {
      setLoadingId(match.id);
      try {
        const users = await getInterestedUsers(match.activity_name);
        setInterestedCache((c) => ({ ...c, [match.id]: users }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerLeft: () => (
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
        )}} />
        <View style={styles.center}><ActivityIndicator color="#ccc" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerLeft: () => (
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
      )}} />
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ccc" />}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>matches activity</Text>
            </View>
            <Text style={styles.sectionLabel}>
              {matches.length > 0 ? `${matches.length} connection${matches.length > 1 ? 's' : ''}` : 'connections'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches yet.</Text>
            <Text style={styles.emptySub}>
              Mark your plans as open and we'll let you know when someone else wants the same thing.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          const interested = interestedCache[item.id] ?? [];
          const isLoading = loadingId === item.id;

          return (
            <View>
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleToggleExpand(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.accent}>✦</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{item.activity_name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.other_profile?.display_name ?? 'someone'} also wants this · {timeAgo(item.created_at)}
                  </Text>
                </View>
                <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.expandedBody}>
                  {isLoading ? (
                    <ActivityIndicator color="#ccc" size="small" />
                  ) : interested.length === 0 ? (
                    <Text style={styles.noOneText}>no one listed yet</Text>
                  ) : (
                    <>
                      <Text style={styles.interestedLabel}>interested · {interested.length}</Text>
                      {interested.map((profile) => (
                        <View key={profile.id} style={styles.personRow}>
                          <Text style={styles.personName}>{profile.display_name ?? 'someone'}</Text>
                          <View style={styles.contactRow}>
                            {profile.instagram_handle ? (
                              <TouchableOpacity onPress={() => openInstagram(profile.instagram_handle!)}>
                                <Text style={styles.contactLink}>
                                  @{profile.instagram_handle.replace(/^@/, '')}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {profile.phone_number ? (
                              <TouchableOpacity onPress={() => Linking.openURL(`tel:${profile.phone_number}`)}>
                                <Text style={styles.contactLink}>{profile.phone_number}</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { fontSize: 28, color: colors.muted, paddingLeft: 16 },
  list: { paddingBottom: 40 },
  titleRow: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    fontWeight: '400',
  },
  sectionLabel: { fontSize: 12, color: colors.label, paddingHorizontal: 20, marginBottom: 8 },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 8,
    padding: 28,
    gap: 10,
  },
  emptyTitle: { fontSize: 15, color: '#111', fontStyle: 'italic' },
  emptySub: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    gap: 12,
  },
  accent: { fontSize: 12, color: colors.accent, marginTop: 3 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, color: '#111', marginBottom: 3 },
  rowMeta: { fontSize: 12, color: colors.muted },
  chevron: { fontSize: 16, color: colors.subtle, marginTop: 1 },
  expandedBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    gap: 12,
  },
  interestedLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: { fontSize: 14, color: '#111' },
  contactRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  contactLink: {
    fontSize: 13,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  noOneText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
