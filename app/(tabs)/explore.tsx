import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { addActivity, getMyActivities, getOpenActivities, getOpenActivitiesPublic, deleteActivity, getInterestedUsers } from '../../lib/activities';
import { openInstagram } from '../../lib/linking';
import LinkText from '../../components/LinkText';
import type { Activity, Category, Profile } from '../../lib/types';

const CATEGORIES = ['all', 'restaurant', 'experience', 'travel'];

const CATALOG: { name: string; category: Category }[] = [
  { name: 'Nobu Malibu',            category: 'Restaurant' },
  { name: 'Hot air balloon ride',   category: 'Experience' },
  { name: 'Bali trip',              category: 'Travel' },
  { name: 'Sourdough baking class', category: 'Experience' },
  { name: 'Osteria Mozza',          category: 'Restaurant' },
  { name: 'Tokyo food tour',        category: 'Travel' },
];

interface FeedItem {
  name: string;
  category: Category;
  interestedCount: number;
  isOwn: boolean;
  notes: string | null;
  latestCreatedAt: string | null;
  dates: string[] | null;
  nextDate: string | null;
  isPast: boolean;
}

interface DividerItem {
  isDivider: true;
  name: string;
}

type FeedRow = FeedItem | DividerItem;

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildFeed(openActs: Activity[], myOpenActs: Activity[]): FeedItem[] {
  const today = getToday();
  const myNames = new Set(myOpenActs.map((a) => a.name.toLowerCase()));

  const countByName: Record<string, { count: number; category: Category }> = {};
  [...openActs, ...myOpenActs].forEach((a) => {
    const key = a.name.toLowerCase();
    if (!countByName[key]) countByName[key] = { count: 0, category: a.category };
    countByName[key].count++;
  });

  const notesByName: Record<string, string | null> = {};
  [...myOpenActs, ...openActs].forEach((a) => {
    const key = a.name.toLowerCase();
    if (a.notes && !notesByName[key]) notesByName[key] = a.notes;
  });

  const latestCreatedAt: Record<string, string> = {};
  [...openActs, ...myOpenActs].forEach((a) => {
    const key = a.name.toLowerCase();
    if (!latestCreatedAt[key] || a.created_at > latestCreatedAt[key]) {
      latestCreatedAt[key] = a.created_at;
    }
  });

  // Track user's own dates per activity name
  const datesByName: Record<string, string[]> = {};
  myOpenActs.forEach((a) => {
    if (a.dates && a.dates.length > 0) {
      datesByName[a.name.toLowerCase()] = a.dates;
    }
  });

  function makeFeedItem(name: string, category: Category, key: string): FeedItem {
    const dates = datesByName[key] ?? null;
    const nextDate = dates
      ? (dates.filter((d) => d >= today).sort()[0] ?? null)
      : null;
    const isPast = dates !== null && dates.length > 0 && dates.every((d) => d < today);
    return {
      name,
      category,
      interestedCount: countByName[key]?.count ?? 0,
      isOwn: myNames.has(key),
      notes: notesByName[key] ?? null,
      latestCreatedAt: latestCreatedAt[key] ?? null,
      dates,
      nextDate,
      isPast,
    };
  }

  const items: FeedItem[] = [];
  const seen = new Set<string>();

  CATALOG.forEach((c) => {
    const key = c.name.toLowerCase();
    seen.add(key);
    items.push(makeFeedItem(c.name, c.category, key));
  });

  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(makeFeedItem(a.name, a.category, key));
    }
  });

  myOpenActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(makeFeedItem(a.name, a.category, key));
    }
  });

  return items.sort((a, b) => {
    // Past items always last
    if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
    // Primary: most recently added first
    if (a.latestCreatedAt && b.latestCreatedAt) {
      const cmp = b.latestCreatedAt.localeCompare(a.latestCreatedAt);
      if (cmp !== 0) return cmp;
    } else if (a.latestCreatedAt) return -1;
    else if (b.latestCreatedAt) return 1;
    // Secondary: soonest upcoming date first
    if (a.nextDate && b.nextDate) return a.nextDate.localeCompare(b.nextDate);
    if (a.nextDate) return -1;
    if (b.nextDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function Explore() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [interestedCache, setInterestedCache] = useState<Record<string, Profile[]>>({});
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [completedSelfNames, setCompletedSelfNames] = useState<Set<string>>(new Set());

  async function refresh(uid: string | null) {
    if (uid) {
      const [myActs, openActs] = await Promise.all([
        getMyActivities(uid),
        getOpenActivities(uid),
      ]);
      const map: Record<string, string> = {};
      myActs.filter((a) => !a.completed_at).forEach((a) => {
        map[a.name.toLowerCase()] = a.id;
      });
      setSavedMap(map);
      const myOpenActs = myActs.filter((a) => a.is_open && !a.completed_at);
      const selfCompleted = new Set(
        myActs.filter((a) => a.completed_at && a.source === 'self').map((a) => a.name.toLowerCase())
      );
      setCompletedSelfNames(selfCompleted);
      setFeed(buildFeed(openActs, myOpenActs));
    } else {
      const openActs = await getOpenActivitiesPublic();
      setFeed(buildFeed(openActs, []));
    }
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh(userId);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id ?? null;
        setUserId(uid);
        refresh(uid);
      });
    }, [])
  );

  async function invalidateAndRefresh(nameKey: string, itemName: string) {
    setInterestedCache((c) => { const n = { ...c }; delete n[nameKey]; return n; });
    if (expandedName === nameKey) {
      setLoadingName(nameKey);
      try {
        const users = await getInterestedUsers(itemName);
        setInterestedCache((c) => ({ ...c, [nameKey]: users }));
      } finally {
        setLoadingName(null);
      }
    }
  }

  async function handleToggleExpand(item: FeedItem) {
    if (!userId) { router.push('/auth'); return; }
    const key = item.name.toLowerCase();
    if (expandedName === key) { setExpandedName(null); return; }
    setExpandedName(key);
    if (!interestedCache[key]) {
      setLoadingName(key);
      try {
        const users = await getInterestedUsers(item.name);
        setInterestedCache((c) => ({ ...c, [key]: users }));
      } finally {
        setLoadingName(null);
      }
    }
  }

  async function handleToggleSave(item: FeedItem) {
    if (!userId) { router.push('/auth'); return; }
    if (item.isOwn) return;
    const key = item.name.toLowerCase();
    const existingId = savedMap[key];
    if (existingId) {
      await deleteActivity(existingId);
    } else {
      try {
        await addActivity({ userId, name: item.name, category: item.category, isOpen: true, source: 'explore' });
      } catch (e: any) {
        Alert.alert('', e.message ?? 'Could not save');
        return;
      }
    }
    await refresh(userId);
    await invalidateAndRefresh(key, item.name);
  }

  const filtered = feed.filter((item) => {
    if (completedSelfNames.has(item.name.toLowerCase())) return false;
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.category.toLowerCase() === activeCategory;
    return matchesQuery && matchesCategory;
  });

  // Split into active and past, insert divider sentinel
  const active = filtered.filter((item) => !item.isPast);
  const past = filtered.filter((item) => item.isPast);
  const rows: FeedRow[] = [
    ...active,
    ...(past.length > 0 ? [{ isDivider: true as const, name: 'past' }, ...past] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => 'isDivider' in item ? 'divider-past' : item.name.toLowerCase()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ccc" />}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>explore</Text>
              <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.refreshBtn} disabled={refreshing}>
                {refreshing ? <ActivityIndicator size="small" color="#ccc" /> : <Text style={styles.refreshIcon}>↻</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <TextInput
                style={[styles.search, { outline: 'none' } as any]}
                placeholder="search activities..."
                placeholderTextColor="#ccc"
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <View style={styles.chips}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, activeCategory === cat && styles.chipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>all activities</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No results.</Text>
          </View>
        }
        renderItem={({ item }) => {
          if ('isDivider' in item) {
            return (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>past</Text>
                <View style={styles.dividerLine} />
              </View>
            );
          }

          const key = item.name.toLowerCase();
          const hearted = !!savedMap[key];
          const expanded = expandedName === key;
          const interested = interestedCache[key] ?? [];
          const isLoading = loadingName === key;

          return (
            <View>
              <TouchableOpacity style={styles.row} onPress={() => handleToggleExpand(item)} activeOpacity={0.7}>
                <View style={styles.rowLeft}>
                  <View style={styles.nameRow}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    {item.isOwn && (
                      <View style={styles.ownBadge}>
                        <Text style={styles.ownBadgeText}>yours</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    {item.category.toLowerCase()}
                    {item.interestedCount > 0 ? ` · ${item.interestedCount} interested` : ''}
                    {item.nextDate ? ` · ${formatDate(item.nextDate)}` : ''}
                  </Text>
                </View>
                {!item.isOwn && (
                  <TouchableOpacity
                    style={styles.heartBtn}
                    onPress={() => handleToggleSave(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.heartIcon, hearted && styles.heartIconActive]}>
                      {hearted ? '♥' : '♡'}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {expanded && (
                <View style={styles.expandedBody}>
                  {item.notes ? (
                    <LinkText style={styles.expandedNotes}>{item.notes}</LinkText>
                  ) : null}
                  {item.dates && item.dates.length > 0 && (
                    <View style={styles.expandedDates}>
                      {item.dates.map((d) => (
                        <View key={d} style={styles.expandedDateChip}>
                          <Text style={styles.expandedDateText}>{formatDate(d)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {isLoading ? (
                    <ActivityIndicator color="#ccc" size="small" />
                  ) : interested.length === 0 ? (
                    <Text style={styles.noOneText}>
                      {item.isOwn ? 'no one else interested yet' : 'no one interested yet — be the first'}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.interestedLabel}>interested · {interested.length}</Text>
                      {interested.map((profile) => (
                        <View key={profile.id} style={styles.personRow}>
                          <Text style={styles.personName}>{profile.display_name ?? 'someone'}</Text>
                          {profile.instagram_handle ? (
                            <TouchableOpacity onPress={() => openInstagram(profile.instagram_handle!)}>
                              <Text style={styles.igHandle}>
                                @{profile.instagram_handle.replace(/^@/, '')}
                              </Text>
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
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { paddingBottom: 40 },
  titleRow: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { position: 'absolute', right: 20, top: 28 },
  refreshIcon: { fontSize: 18, color: '#ccc' },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    fontWeight: '400',
  },
  searchWrap: { paddingHorizontal: 20, marginBottom: 16 },
  search: {
    borderWidth: 1, borderColor: '#ececec', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 16, color: '#111',
  },
  chips: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20 },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 12, color: '#999' },
  chipTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 12, color: '#999', paddingHorizontal: 20, marginBottom: 8 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e0e0e0' },
  dividerText: { fontSize: 11, color: '#bbb', letterSpacing: 0.8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ececec',
  },
  rowLeft: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  rowName: { fontSize: 15, color: '#111' },
  ownBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: '#c9a0dc',
  },
  ownBadgeText: { fontSize: 10, color: '#c9a0dc', letterSpacing: 0.5 },
  rowMeta: { fontSize: 12, color: '#bbb' },
  heartBtn: { padding: 4 },
  heartIcon: { fontSize: 20, color: '#ddd' },
  heartIconActive: { color: '#c9a0dc' },
  expandedBody: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ececec',
    gap: 10,
  },
  expandedNotes: { fontSize: 13, color: '#666', lineHeight: 19 },
  expandedDates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  expandedDateChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
  },
  expandedDateText: { fontSize: 11, color: '#888' },
  interestedLabel: { fontSize: 11, color: '#bbb', letterSpacing: 0.5, marginBottom: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personName: { fontSize: 14, color: '#111' },
  igHandle: { fontSize: 13, color: '#c9a0dc', textDecorationLine: 'underline' },
  noOneText: { fontSize: 13, color: '#bbb', fontStyle: 'italic' },
  empty: { paddingHorizontal: 20, paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
});
