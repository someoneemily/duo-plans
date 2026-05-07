import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { getOpenActivitiesPublic } from '../../lib/activities';
import type { Activity, Category } from '../../lib/types';

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
  latestCreatedAt: string | null;
}

function buildFeed(openActs: Activity[]): FeedItem[] {
  const countByName: Record<string, { count: number; category: Category }> = {};
  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!countByName[key]) countByName[key] = { count: 0, category: a.category };
    countByName[key].count++;
  });

  const latestCreatedAt: Record<string, string> = {};
  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!latestCreatedAt[key] || a.created_at > latestCreatedAt[key]) {
      latestCreatedAt[key] = a.created_at;
    }
  });

  const items: FeedItem[] = [];
  const seen = new Set<string>();

  CATALOG.forEach((c) => {
    const key = c.name.toLowerCase();
    seen.add(key);
    items.push({
      name: c.name,
      category: c.category,
      interestedCount: countByName[key]?.count ?? 0,
      latestCreatedAt: latestCreatedAt[key] ?? null,
    });
  });

  openActs.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        name: a.name,
        category: a.category,
        interestedCount: countByName[key].count,
        latestCreatedAt: latestCreatedAt[key] ?? null,
      });
    }
  });

  return items.sort((a, b) => {
    if (a.latestCreatedAt && b.latestCreatedAt) return b.latestCreatedAt.localeCompare(a.latestCreatedAt);
    if (a.latestCreatedAt) return -1;
    if (b.latestCreatedAt) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function PublicExplore() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadFeed() {
    const openActs = await getOpenActivitiesPublic();
    setFeed(buildFeed(openActs));
    setRefreshing(false);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, []);

  useFocusEffect(useCallback(() => { loadFeed(); }, []));

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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/(public)/signin')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.category.toLowerCase()}
                {item.interestedCount > 0 ? ` · ${item.interestedCount} interested` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={() => router.push('/(public)/signin')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.heartIcon}>♡</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
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
  empty: { paddingHorizontal: 20, paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
});
