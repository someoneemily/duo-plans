import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { addActivity, getMyActivities, getOpenActivities, deleteActivity, getInterestedUsers } from '../../lib/activities';
import { openInstagram } from '../../lib/linking';
import type { Activity, Category, Profile } from '../../lib/types';

const CATEGORIES = ['all', 'restaurant', 'experience', 'travel'];

const CATALOG: { name: string; category: Category }[] = [
  { name: 'Nobu Malibu',          category: 'Restaurant' },
  { name: 'Hot air balloon ride', category: 'Experience' },
  { name: 'Bali trip',            category: 'Travel' },
  { name: 'Sourdough baking class', category: 'Experience' },
  { name: 'Osteria Mozza',        category: 'Restaurant' },
  { name: 'Tokyo food tour',      category: 'Travel' },
];

interface FeedItem {
  name: string;
  category: Category;
  interestedCount: number;
}

function buildFeed(openActs: Activity[]): FeedItem[] {
  const countByName: Record<string, { count: number; category: Category }> = {};
  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!countByName[key]) countByName[key] = { count: 0, category: a.category };
    countByName[key].count++;
  });

  const items: FeedItem[] = [];
  const seen = new Set<string>();

  CATALOG.forEach((c) => {
    const key = c.name.toLowerCase();
    seen.add(key);
    items.push({ name: c.name, category: c.category, interestedCount: countByName[key]?.count ?? 0 });
  });

  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ name: a.name, category: a.category, interestedCount: countByName[key].count });
    }
  });

  return items.sort((a, b) => b.interestedCount - a.interestedCount || a.name.localeCompare(b.name));
}

export default function Explore() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [interestedCache, setInterestedCache] = useState<Record<string, Profile[]>>({});
  const [loadingName, setLoadingName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      Promise.all([
        getMyActivities(userId),
        getOpenActivities(userId),
      ]).then(([myActs, openActs]) => {
        const map: Record<string, string> = {};
        myActs.filter((a) => !a.completed_at).forEach((a) => {
          map[a.name.toLowerCase()] = a.id;
        });
        setSavedMap(map);
        setFeed(buildFeed(openActs));
      });
    }, [userId])
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
    const key = item.name.toLowerCase();
    if (expandedName === key) {
      setExpandedName(null);
      return;
    }
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
    if (!userId) return;
    const key = item.name.toLowerCase();
    const existingId = savedMap[key];

    if (existingId) {
      await deleteActivity(existingId);
      setSavedMap((m) => { const n = { ...m }; delete n[key]; return n; });
      // Rebuild feed after unsave
      const openActs = await getOpenActivities(userId);
      setFeed(buildFeed(openActs));
      await invalidateAndRefresh(key, item.name);
    } else {
      try {
        const activity = await addActivity({
          userId,
          name: item.name,
          category: item.category,
          isOpen: true,
          source: 'explore',
        });
        setSavedMap((m) => ({ ...m, [key]: activity.id }));
        // Rebuild feed after save
        const openActs = await getOpenActivities(userId);
        setFeed(buildFeed(openActs));
        await invalidateAndRefresh(key, item.name);
      } catch (e: any) {
        Alert.alert('', e.message ?? 'Could not save');
      }
    }
  }


  const filtered = feed.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.category.toLowerCase() === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name.toLowerCase()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>explore</Text>
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
          const key = item.name.toLowerCase();
          const hearted = !!savedMap[key];
          const expanded = expandedName === key;
          const interested = interestedCache[key] ?? [];
          const isLoading = loadingName === key;

          return (
            <View>
              <TouchableOpacity style={styles.row} onPress={() => handleToggleExpand(item)} activeOpacity={0.7}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.category.toLowerCase()}
                    {item.interestedCount > 0 ? ` · ${item.interestedCount} interested` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.heartBtn}
                  onPress={() => handleToggleSave(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.heartIcon, hearted && styles.heartIconActive]}>
                    {hearted ? '♥' : '♡'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.expandedBody}>
                  {isLoading ? (
                    <ActivityIndicator color="#ccc" size="small" />
                  ) : interested.length === 0 ? (
                    <Text style={styles.noOneText}>no one interested yet — be the first</Text>
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
    fontSize: 14, color: '#111',
  },
  chips: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20 },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 12, color: '#999' },
  chipTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 12, color: '#999', paddingHorizontal: 20, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ececec',
  },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 15, color: '#111', marginBottom: 3 },
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
  interestedLabel: { fontSize: 11, color: '#bbb', letterSpacing: 0.5, marginBottom: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personName: { fontSize: 14, color: '#111' },
  igHandle: { fontSize: 13, color: '#c9a0dc', textDecorationLine: 'underline' },
  noOneText: { fontSize: 13, color: '#bbb', fontStyle: 'italic' },
  empty: { paddingHorizontal: 20, paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
});
