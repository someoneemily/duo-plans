import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, RefreshControl, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getMyActivities, addActivity, toggleOpen, deleteActivity, markAsCompleted } from '../../lib/activities';
import CompletionCelebration from '../../components/CompletionCelebration';
import MatchBell from '../../components/MatchBell';
import { ActivityRow } from '../../components/ActivityRow';
import { colors } from '../../lib/colors';
import type { Activity, Category } from '../../lib/types';


export default function MyPlans() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Activity | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; category: Category }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [planFilter, setPlanFilter] = useState<'all' | 'created' | 'explore'>('all');
  const [refreshCount, setRefreshCount] = useState(0);
  const [emptyQuote, setEmptyQuote] = useState('Let\'s start filling up your bucket list items.');
  const hasFetchedSuggestions = useRef(false);
  const seenSuggestionNames = useRef<Set<string>>(new Set());
  const hasFetchedQuote = useRef(false);
  const [refreshSignalMap, setRefreshSignalMap] = useState<Record<string, number>>({});

  async function load(uid: string) {
    try {
      const data = await getMyActivities(uid);
      setActivities(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchEmptyQuote() {
    if (hasFetchedQuote.current) return;
    hasFetchedQuote.current = true;
    const { data } = await supabase.from('empty_state_quotes').select('text');
    if (data && data.length > 0) {
      setEmptyQuote(data[Math.floor(Math.random() * data.length)].text);
    }
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
        setUserId(uid);
        if (uid) load(uid);
        else router.replace('/');
      });
    }, [])
  );

  useEffect(() => {
    if (!userId) return;
    const handler = (payload: any) => {
      const name = (payload.new?.activity_name ?? '').toLowerCase();
      if (!name) return;
      setActivities((prev) => {
        const affected = prev
          .filter((a) => a.name.toLowerCase() === name && a.is_open && !a.completed_at)
          .map((a) => a.id);
        if (affected.length > 0) {
          setRefreshSignalMap((m) => {
            const next = { ...m };
            affected.forEach((id) => { next[id] = (next[id] ?? 0) + 1; });
            return next;
          });
        }
        return prev;
      });
    };
    const channel = supabase
      .channel(`plans-match-signal:${userId}`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'matches', filter: `user1_id=eq.${userId}` }, handler)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'matches', filter: `user2_id=eq.${userId}` }, handler)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function handleToggleOpen(item: Activity) {
    const newValue = !item.is_open;
    setActivities((prev) => prev.map((a) =>
      a.id === item.id ? { ...a, is_open: newValue, is_private: !newValue } : a
    ));
    try {
      await toggleOpen(item.id, newValue);
    } catch {
      setActivities((prev) => prev.map((a) =>
        a.id === item.id ? { ...a, is_open: item.is_open, is_private: item.is_private } : a
      ));
    }
  }

  async function handleComplete(item: Activity) {
    await markAsCompleted(item.id);
    setActivities((prev) => prev.map((a) =>
      a.id === item.id ? { ...a, completed_at: new Date().toISOString() } : a
    ));
    setCelebrating(item);
  }

  async function handleDelete(item: Activity) {
    setActivities((prev) => prev.filter((a) => a.id !== item.id));
    await deleteActivity(item.id);
  }

  async function fetchSuggestions() {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-activities', {
        body: { excludeNames: [...seenSuggestionNames.current] },
      });
      if (!error && data?.suggestions) {
        data.suggestions.forEach((s: { name: string }) =>
          seenSuggestionNames.current.add(s.name.toLowerCase())
        );
        setSuggestions(data.suggestions);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function dismissSuggestion(name: string) {
    setSuggestions((s) => s.filter((x) => x.name !== name));
  }

  async function refreshSuggestions() {
    setRefreshCount((c) => c + 1);
    await fetchSuggestions();
  }

  async function handleAddSuggestion(s: { name: string; category: Category }) {
    if (!userId) return;
    dismissSuggestion(s.name);
    try {
      await addActivity({ userId, name: s.name, category: s.category, isOpen: false, source: 'self' });
      const data = await getMyActivities(userId);
      setActivities(data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (userId && !hasFetchedSuggestions.current) {
      hasFetchedSuggestions.current = true;
      fetchSuggestions();
      fetchEmptyQuote();
    }
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#ccc" /></View>
      </SafeAreaView>
    );
  }

  const created = activities.filter((a) => a.source === 'self' && !a.completed_at);
  const fromExplore = activities.filter((a) => a.source === 'explore' && !a.completed_at);
  const done = activities.filter((a) => !!a.completed_at);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ccc" />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>my plans</Text>
          <View style={styles.headerIcons}>
            <MatchBell />
          </View>
        </View>

        {/* Plans — consolidated with filter */}
        <View style={styles.plansHeader}>
          <Text style={styles.sectionLabel}>
            active plans · {planFilter === 'all' ? created.length + fromExplore.length : planFilter === 'created' ? created.length : fromExplore.length}
          </Text>
          <TouchableOpacity onPress={() => router.push('/activity/add?source=myplans' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.newPlanBtn}>+ new</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          {(['all', 'created', 'explore'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, planFilter === f && styles.filterPillActive]}
              onPress={() => setPlanFilter(f)}
            >
              <Text style={[styles.filterPillText, planFilter === f && styles.filterPillTextActive]}>
                {f === 'all' ? 'all' : f === 'created' ? 'created by me' : 'saved from explore'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(() => {
          const visible = planFilter === 'all'
            ? [...created, ...fromExplore]
            : planFilter === 'created' ? created : fromExplore;
          const isEmpty = visible.length === 0;

          if (isEmpty) {
            if (planFilter === 'explore') {
              return (
                <View style={styles.exploreEmpty}>
                  <Text style={styles.exploreEmptyText}>Heart something in Explore to save it here.</Text>
                </View>
              );
            }
            return (
              <View style={styles.emptyState}>
                <View style={styles.emptyOuter}>
                  <View style={styles.emptyInner}>
                    <View style={{ position: 'relative', width: 48, height: 56 }}>
                      <Ionicons name="document-outline" size={52} color={colors.accent} />
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        <Ionicons name="checkmark" size={20} color={colors.accent} />
                        <Ionicons name="heart" size={11} color={colors.accent} />
                      </View>
                    </View>
                  </View>
                </View>
                <Text style={styles.emptyTitle}>no plans yet</Text>
                <Text style={styles.emptyQuote}>{emptyQuote}</Text>
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => router.push('/activity/add?source=myplans' as any)}
                >
                  <Text style={styles.emptyCreateBtnText}>+ create your first plan</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View style={styles.planList}>
              {visible.map((item, index) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  userId={userId!}
                  shade={index % 2 === 0}
                  noBorder
                  refreshSignal={refreshSignalMap[item.id]}
                  onToggleOpen={() => handleToggleOpen(item)}
                  onComplete={() => handleComplete(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </View>
          );
        })()}

        {/* Suggestions */}
        <View style={[styles.sectionDivider, { marginTop: 24 }]} />
        <View style={{ marginBottom: 36 }}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.sectionLabel}>suggested for you</Text>
            <TouchableOpacity
              onPress={refreshSuggestions}
              disabled={loadingSuggestions}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.suggestionRefreshBtn}
            >
              <Text style={[styles.refreshIcon, loadingSuggestions && styles.refreshIconDisabled]}>↻</Text>
            </TouchableOpacity>
          </View>
          {loadingSuggestions ? (
            <View style={styles.suggestionLoading}>
              <ActivityIndicator size="small" color="#ccc" />
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(s) => s.name}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionCarousel}
              renderItem={({ item: s }) => (
                <View style={styles.suggestionCard}>
                  <Text style={styles.suggestionCardCategory}>{s.category.toLowerCase()}</Text>
                  <Text style={styles.suggestionCardName}>{s.name}</Text>
                  <View style={styles.suggestionCardActions}>
                    <TouchableOpacity
                      style={styles.suggestionAddBtn}
                      onPress={() => handleAddSuggestion(s)}
                    >
                      <Text style={styles.suggestionAddText}>+ add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => dismissSuggestion(s.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.suggestionDismiss}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>

        {/* Completed */}
        {done.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 36 }]}>completed · {done.length}</Text>
            <View style={styles.planList}>
              {done.map((item, index) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  shade={index % 2 === 0}
                  userId={userId!}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {celebrating && (
        <CompletionCelebration
          visible
          activityName={celebrating.name}
          onDismiss={() => setCelebrating(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rowCenter: { flex: 1 },
  scroll: { paddingBottom: 60 },
  titleRow: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  headerIcons: { position: 'absolute', right: 16, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  refreshIcon: { fontSize: 18, color: colors.subtle },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    fontWeight: '400',
  },
  sectionLabel: { fontSize: 12, color: colors.label, paddingHorizontal: 20, marginBottom: 10 },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  emptyOuter: {
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: 'rgba(245, 238, 255, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  emptyInner: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    color: '#111',
    fontWeight: '400',
    marginBottom: 10,
  },
  emptyQuote: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  emptyCreateBtn: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  emptyCreateBtnText: { fontSize: 13, color: '#fff', letterSpacing: 0.3 },
  exploreEmpty: { paddingHorizontal: 20, paddingTop: 16 },
  exploreEmptyText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  plansHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
    marginBottom: 10,
  },
  newPlanBtn: {
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  planList: {
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  filterPillText: {
    fontSize: 12,
    color: colors.muted,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  suggestionRefreshBtn: { paddingBottom: 10 },
  suggestionLoading: { paddingVertical: 20, alignItems: 'center' },
  suggestionCarousel: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  suggestionCard: {
    width: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    justifyContent: 'space-between',
  },
  suggestionCardCategory: {
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  suggestionCardName: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
    flex: 1,
  },
  suggestionCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  suggestionAddBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestionAddText: { fontSize: 11, color: colors.accent, letterSpacing: 0.5 },
  suggestionDismiss: { fontSize: 18, color: colors.subtle, lineHeight: 20 },
  refreshIconDisabled: { color: colors.disabled },
  planName: { fontSize: 15, color: '#111' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
});
