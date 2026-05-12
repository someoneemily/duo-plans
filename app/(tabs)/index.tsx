import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, TextInput, RefreshControl,
  Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getMyActivities, addActivity, toggleOpen, deleteActivity, markAsCompleted, updateActivity, getInterestedUsers } from '../../lib/activities';
import { validateActivityName } from '../../lib/validate';
import CompletionCelebration from '../../components/CompletionCelebration';
import LinkText from '../../components/LinkText';
import MatchBell from '../../components/MatchBell';
import { colors } from '../../lib/colors';
import type { Activity, Category, Profile } from '../../lib/types';

function formatPlanDates(dates: string[]): string {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = dates.filter((d) => d >= today).sort();
  const targets = upcoming.length > 0 ? upcoming : dates.sort();
  return targets
    .slice(0, 2)
    .map((d) => {
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    })
    .join(', ') + (targets.length > 2 ? ' …' : '');
}

function PlanRow({
  item,
  onToggleOpen,
  onComplete,
  onDelete,
  onUpdate,
}: {
  item: Activity;
  onToggleOpen: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onUpdate: (name: string) => void;
}) {
  const isDone = !!item.completed_at;
  const canEdit = item.source === 'self' && !isDone;
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const [shared, setShared] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [interested, setInterested] = useState<Profile[]>([]);
  const [loadingInterested, setLoadingInterested] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && item.is_open && !isDone && interested.length === 0) {
      setLoadingInterested(true);
      try {
        const users = await getInterestedUsers(item.name);
        setInterested(users);
      } finally {
        setLoadingInterested(false);
      }
    }
  }

  function handleNamePress() {
    if (!canEdit) return;
    if (!expanded) { toggleExpand(); return; }
    setDraftName(item.name);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleNameBlur() {
    setEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== item.name && !validateActivityName(trimmed)) {
      onUpdate(trimmed);
    } else {
      setDraftName(item.name);
    }
  }

  async function handleShare() {
    const url = Platform.OS === 'web'
      ? `${(window as any).location.origin}/activity/${item.id}`
      : `https://duo-plans.vercel.app/activity/${item.id}`;
    if (Platform.OS !== 'web') {
      await Share.share({ url, message: url });
    } else if (typeof (navigator as any).share === 'function') {
      try { await (navigator as any).share({ title: item.name, url }); } catch { /* cancelled */ }
    } else {
      try { await (navigator as any).clipboard.writeText(url); } catch { /* silent */ }
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    }
  }

  return (
    <View>
      <TouchableOpacity style={[styles.row, isDone && styles.rowDone]} onPress={toggleExpand} activeOpacity={0.7}>
        <TouchableOpacity
          onPress={isDone ? undefined : onComplete}
          style={styles.circle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.5}
        >
          {isDone
            ? <Text style={styles.circleDone}>✓</Text>
            : <View style={styles.circleEmpty} />
          }
        </TouchableOpacity>

        <View style={styles.rowCenter}>
          {editingName ? (
            <TextInput
              ref={inputRef}
              style={[styles.planName, styles.nameInput, { outline: 'none', fontSize: 16 } as any]}
              value={draftName}
              onChangeText={setDraftName}
              onBlur={handleNameBlur}
              onSubmitEditing={handleNameBlur}
              returnKeyType="done"
              selectTextOnFocus
            />
          ) : (
            <TouchableOpacity onPress={handleNamePress} activeOpacity={canEdit ? 0.6 : 1} disabled={!canEdit}>
              <Text style={[styles.planName, isDone && styles.planNameDone]}>{item.name}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.planMeta}>
            {item.category.toLowerCase()}
            {item.dates && item.dates.length > 0 ? ` · ${formatPlanDates(item.dates)}` : ''}
          </Text>
        </View>

        {!isDone && (
          <View style={styles.right}>
            {item.source !== 'explore' && (
              <TouchableOpacity
                onPress={onToggleOpen}
                style={[styles.duoChip, item.is_open && styles.duoChipOn]}
              >
                <Text style={[styles.duoChipText, item.is_open && styles.duoChipTextOn]}>
                  {item.is_open ? 'open' : 'solo'}
                </Text>
              </TouchableOpacity>
            )}
            {item.source !== 'explore' && (
              <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-outline" size={16} color={shared ? colors.accent : colors.subtle} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedSection}>
          {item.notes ? <LinkText style={styles.expandedNotes}>{item.notes}</LinkText> : null}

          {item.is_open && !isDone && (
            loadingInterested ? (
              <ActivityIndicator color="#ccc" size="small" />
            ) : interested.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.expandedLabel}>interested · {interested.length}</Text>
                {interested.map((p) => (
                  <Text key={p.id} style={styles.expandedPerson}>{p.display_name ?? 'someone'}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.expandedEmpty}>no one else interested yet</Text>
            )
          )}

          <TouchableOpacity onPress={onDelete} style={styles.expandedDelete}>
            <Text style={styles.expandedDeleteText}>remove from plans</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function MyPlans() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Activity | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; category: Category }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
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

  async function handleUpdate(item: Activity, name: string) {
    setActivities((prev) => prev.map((a) => a.id === item.id ? { ...a, name } : a));
    try {
      await updateActivity(item.id, { name });
    } catch {
      setActivities((prev) => prev.map((a) => a.id === item.id ? { ...a, name: item.name } : a));
    }
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

        {/* Created */}
        <Text style={styles.sectionLabel}>created</Text>
        {created.length === 0 ? (
          <View style={styles.emptyCard}>
            <TouchableOpacity style={styles.plusBox} onPress={() => router.push('/activity/add')}>
              <Text style={styles.plusText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.emptyHint}>Nothing added yet.</Text>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/activity/add')}>
              <Text style={styles.outlineBtnText}>ADD A PLAN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.planList}>
            <TouchableOpacity
              style={[styles.outlineBtn, { alignSelf: 'flex-start', margin: 16 }]}
              onPress={() => router.push('/activity/add')}
            >
              <Text style={styles.outlineBtnText}>+ ADD</Text>
            </TouchableOpacity>
            {created.map((item) => (
              <PlanRow
                key={item.id}
                item={item}
                onToggleOpen={() => handleToggleOpen(item)}
                onComplete={() => handleComplete(item)}
                onDelete={() => handleDelete(item)}
                onUpdate={(name) => handleUpdate(item, name)}
              />
            ))}
          </View>
        )}

        {/* Saved from explore */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>saved from explore</Text>
        {fromExplore.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHint}>Heart something in Explore to save it here.</Text>
          </View>
        ) : (
          <View style={styles.planList}>
            {fromExplore.map((item) => (
              <PlanRow
                key={item.id}
                item={item}
                onToggleOpen={() => handleToggleOpen(item)}
                onComplete={() => handleComplete(item)}
                onDelete={() => handleDelete(item)}
                onUpdate={(name) => handleUpdate(item, name)}
              />
            ))}
          </View>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 36 }]}>completed · {done.length}</Text>
            <View style={styles.planList}>
              {done.map((item) => (
                <PlanRow
                  key={item.id}
                  item={item}
                  onToggleOpen={() => {}}
                  onComplete={() => {}}
                  onDelete={() => handleDelete(item)}
                  onUpdate={() => {}}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  rowDone: { opacity: 0.45 },
  circle: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  circleEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.subtle },
  circleDone: { fontSize: 13, color: colors.accent },
  planName: { fontSize: 15, color: '#111' },
  nameInput: { padding: 0, margin: 0 },
  planNameDone: { textDecorationLine: 'line-through', color: colors.muted },
  planMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
  duoChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  duoChipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  duoChipText: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  duoChipTextOn: {
    color: '#fff',
  },
  expandedSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  expandedNotes: { fontSize: 13, color: colors.secondary, lineHeight: 19 },
  expandedLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  expandedPerson: { fontSize: 14, color: '#111' },
  expandedEmpty: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  expandedDelete: { paddingTop: 4 },
  expandedDeleteText: { fontSize: 13, color: colors.subtle },
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
});
