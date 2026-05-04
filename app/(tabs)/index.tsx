import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, ScrollView, TextInput, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getMyActivities, toggleOpen, deleteActivity, markAsCompleted, updateActivity } from '../../lib/activities';
import { validateActivityName } from '../../lib/validate';
import CompletionCelebration from '../../components/CompletionCelebration';
import type { Activity } from '../../lib/types';

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
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const inputRef = useRef<TextInput>(null);

  function handleNamePress() {
    if (isDone) return;
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

  return (
    <View style={[styles.row, isDone && styles.rowDone]}>
      {/* Circle checkbox */}
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

      {/* Name + category */}
      <View style={styles.rowCenter}>
        {editingName ? (
          <TextInput
            ref={inputRef}
            style={[styles.planName, styles.nameInput, { outline: 'none' } as any]}
            value={draftName}
            onChangeText={setDraftName}
            onBlur={handleNameBlur}
            onSubmitEditing={handleNameBlur}
            returnKeyType="done"
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={handleNamePress} activeOpacity={0.6}>
            <Text style={[styles.planName, isDone && styles.planNameDone]}>{item.name}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.planMeta}>{item.category.toLowerCase()}</Text>
      </View>

      {/* Right actions — hidden when done */}
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
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#ccc" />
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
          <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.refreshBtn} disabled={refreshing}>
            {refreshing ? <ActivityIndicator size="small" color="#ccc" /> : <Text style={styles.refreshIcon}>↻</Text>}
          </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.outlineBtn, { alignSelf: 'flex-start', margin: 16 }]}
              onPress={() => router.push('/activity/add')}
            >
              <Text style={styles.outlineBtnText}>+ ADD</Text>
            </TouchableOpacity>
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
  refreshBtn: { position: 'absolute', right: 20, top: 28 },
  refreshIcon: { fontSize: 18, color: '#ccc' },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    fontWeight: '400',
  },
  sectionLabel: { fontSize: 12, color: '#999', paddingHorizontal: 20, marginBottom: 10 },
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
  plusText: { fontSize: 22, color: '#ccc', fontWeight: '300' },
  emptyHint: { fontSize: 13, color: '#bbb', fontStyle: 'italic', textAlign: 'center' },
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
  circleEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc' },
  circleDone: { fontSize: 13, color: '#c9a0dc' },
  planName: { fontSize: 15, color: '#111' },
  nameInput: { padding: 0, margin: 0 },
  planNameDone: { textDecorationLine: 'line-through', color: '#bbb' },
  planMeta: { fontSize: 12, color: '#bbb', marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
  duoChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  duoChipOn: {
    backgroundColor: '#c9a0dc',
    borderColor: '#c9a0dc',
  },
  duoChipText: {
    fontSize: 10,
    color: '#bbb',
    letterSpacing: 0.5,
  },
  duoChipTextOn: {
    color: '#fff',
  },
});
