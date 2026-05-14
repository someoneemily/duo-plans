import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
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
  const hasFetchedSuggestions = useRef(false);

  async function load(uid: string) {
    try {
      const data = await getMyActivities(uid);
      setActivities(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      a.id === item.id ? { ...a, completed_at: new Date().toISOString(), is_open: false } : a
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
      const { data, error } = await supabase.functions.invoke('suggest-activities');
      if (!error && data?.suggestions) setSuggestions(data.suggestions);
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

        {/* Suggestions */}
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
            <View style={styles.planList}>
              {suggestions.map((s) => (
                <View key={s.name} style={styles.suggestionRow}>
                  <View style={styles.rowCenter}>
                    <Text style={styles.planName}>{s.name}</Text>
                    <Text style={styles.planMeta}>{s.category.toLowerCase()}</Text>
                  </View>
                  <View style={styles.right}>
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
              ))}
            </View>
          ) : null}
        </View>

        {/* Plans — consolidated with filter */}
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
            return (
              <View style={styles.emptyCard}>
                {planFilter !== 'explore' && (
                  <TouchableOpacity style={styles.plusBox} onPress={() => router.push('/activity/add')}>
                    <Text style={styles.plusText}>+</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.emptyHint}>
                  {planFilter === 'explore'
                    ? 'Heart something in Explore to save it here.'
                    : 'Nothing added yet.'}
                </Text>
                {planFilter !== 'explore' && (
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/activity/add')}>
                    <Text style={styles.outlineBtnText}>ADD A PLAN</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }

          return (
            <View style={styles.planList}>
              {planFilter !== 'explore' && (
                <TouchableOpacity
                  style={[styles.outlineBtn, { alignSelf: 'flex-start', margin: 16 }]}
                  onPress={() => router.push('/activity/add')}
                >
                  <Text style={styles.outlineBtnText}>+ ADD</Text>
                </TouchableOpacity>
              )}
              {visible.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  userId={userId!}
                  onToggleOpen={() => handleToggleOpen(item)}
                  onComplete={() => handleComplete(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </View>
          );
        })()}

        {/* Completed */}
        {done.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 36 }]}>completed · {done.length}</Text>
            <View style={styles.planList}>
              {done.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
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
  emptyCard: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  plusBox: {
    width: 56, height: 56,
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  plusText: { fontSize: 22, color: colors.subtle, fontWeight: '300' },
  emptyHint: { fontSize: 13, color: colors.muted, fontStyle: 'italic', textAlign: 'center' },
  outlineBtn: {
    borderWidth: 1, borderColor: '#111',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
  },
  outlineBtnText: { fontSize: 11, color: '#111', letterSpacing: 1.2, fontWeight: '500' },
  planList: {
    marginHorizontal: 20, borderWidth: 1, borderColor: '#ececec', borderRadius: 10,
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
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
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
  planMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
});
