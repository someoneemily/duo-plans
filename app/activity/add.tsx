import React, { useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { addActivity, updateActivity } from '../../lib/activities';
import { addActivityToList, getMySharedLists } from '../../lib/sharedLists';
import { validateActivityName } from '../../lib/validate';
import type { Category, SharedList, Profile } from '../../lib/types';
import { colors } from '../../lib/colors';

const CATEGORIES: Category[] = ['Food', 'Experience', 'Travel', 'Other'];

function listLabel(list: SharedList, userId: string): string {
  const others = list.members.filter(
    (m) => m.user_id !== userId && m.status !== 'declined'
  );
  if (others.length === 0) return 'shared list';
  return 'with ' + others.map((m) => (m.profile as Profile | null)?.display_name ?? 'someone').join(', ');
}

const TODAY = new Date().toISOString().split('T')[0];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AddActivity() {
  const router = useRouter();
  const {
    listId,
    activityId,
    prefillName,
    prefillCategory,
    prefillNotes,
    prefillDates,
    prefillIsOpen,
    prefillIsListOnly,
    source,
  } = useLocalSearchParams<{
    listId?: string;
    activityId?: string;
    prefillName?: string;
    prefillCategory?: string;
    prefillNotes?: string;
    prefillDates?: string;
    prefillIsOpen?: string;
    prefillIsListOnly?: string;
    source?: string;
  }>();
  const isEditMode = !!activityId;
  const isListAdd = !isEditMode && !!listId;
  const isFromMyPlans = !isEditMode && !isListAdd && source === 'myplans';
  const isListOnly = prefillIsListOnly === 'true';

  type Visibility = 'solo' | 'public' | 'friends';
  const [name, setName] = useState(prefillName ?? '');
  const [category, setCategory] = useState<Category | ''>((prefillCategory as Category) ?? '');
  const [notes, setNotes] = useState(prefillNotes ?? '');
  const [isOpen, setIsOpen] = useState(prefillIsOpen === 'true');
  const [visibility, setVisibility] = useState<Visibility>(() => {
    if (isEditMode) return prefillIsOpen === 'true' ? 'public' : 'solo';
    return 'solo';
  });
  const [dates, setDates] = useState<string[]>(
    prefillDates ? prefillDates.split(',').filter(Boolean) : []
  );
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isListAdd || isEditMode) return;
    setLoadingLists(true);
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      setCurrentUserId(uid);
      try {
        const lists = await getMySharedLists(uid);
        setSharedLists(lists.filter((l) =>
          l.members.some((m) => m.user_id === uid && (m.status === 'accepted' || l.creator_id === uid))
        ));
      } finally {
        setLoadingLists(false);
      }
    });
  }, []);

  function handleAddDate(dateStr: string) {
    if (!dateStr) return;
    setDates((prev) => prev.includes(dateStr) ? prev : [...prev, dateStr].sort());
  }

  function removeDate(dateStr: string) {
    setDates((prev) => prev.filter((d) => d !== dateStr));
  }

  function validate(): boolean {
    let ok = true;
    const ne = validateActivityName(name);
    if (ne) { setNameError(ne); ok = false; }
    else setNameError(null);
    if (!category) { setCategoryError('Please pick a category.'); ok = false; }
    else setCategoryError(null);
    if (!isListAdd && !isEditMode && visibility === 'friends' && !selectedListId) {
      setVisibilityError('Select a shared list to continue.');
      ok = false;
    } else setVisibilityError(null);
    return ok;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      if (isEditMode && activityId) {
        await updateActivity(activityId, {
          name: name.trim(),
          category: category as Category,
          notes: notes.trim() || undefined,
          dates: dates.length > 0 ? dates : undefined,
          isOpen: isListOnly ? false : isOpen,
        });
      } else {
        const targetListId = isListAdd ? listId! : (visibility === 'friends' ? selectedListId : null);
        const effectiveIsOpen = !targetListId && visibility === 'public';
        const activity = await addActivity({
          userId: session.user.id,
          name: name.trim(),
          category: category as Category,
          notes: notes.trim() || undefined,
          isOpen: effectiveIsOpen,
          isListOnly: !!targetListId,
          dates: dates.length > 0 ? dates : undefined,
        });
        if (targetListId) {
          await addActivityToList(targetListId, activity.id, session.user.id);
        }
        if (isListAdd && listId) {
          router.back();
        } else if (targetListId) {
          router.replace(`/friends/${targetListId}` as any);
        } else if (isFromMyPlans) {
          router.replace('/(tabs)' as any);
        } else {
          router.back();
        }
        return;
      }
      router.back();
    } catch (err: any) {
      Alert.alert('', err.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.pageTitle}>{isEditMode ? 'edit plan' : isListAdd ? 'add to list' : 'add plan'}</Text>

          <TextInput
            style={[styles.nameInput, { outline: 'none' } as any, nameError ? styles.inputError : null]}
            placeholder="what do you want to do?"
            placeholderTextColor="#ccc"
            value={name}
            onChangeText={(v) => { setName(v); if (nameError) setNameError(null); }}
            autoFocus
            multiline
          />
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}

          <Text style={styles.label}>category</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => { setCategory(cat); if (categoryError) setCategoryError(null); }}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat.toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {categoryError ? <Text style={styles.fieldError}>{categoryError}</Text> : null}

          <Text style={styles.label}>notes</Text>
          <TextInput
            style={[styles.notes, { outline: 'none' } as any]}
            placeholder="any context or details..."
            placeholderTextColor="#ccc"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Text style={styles.label}>when? (optional)</Text>
          {dates.length > 0 && (
            <View style={styles.dateChips}>
              {dates.map((d) => (
                <View key={d} style={styles.dateChip}>
                  <Text style={styles.dateChipText}>{formatDate(d)}</Text>
                  <TouchableOpacity onPress={() => removeDate(d)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.dateChipX}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {Platform.OS === 'web'
            ? React.createElement('input', {
                type: 'date',
                min: TODAY,
                style: {
                  border: 'none',
                  borderBottom: '1px solid #e0e0e0',
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 16,
                  color: colors.label,
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  marginBottom: 12,
                  cursor: 'pointer',
                } as any,
                onBlur: (e: any) => {
                  if (e.target.value) {
                    handleAddDate(e.target.value);
                    e.target.value = '';
                  }
                },
                onKeyDown: (e: any) => {
                  if (e.key === 'Enter' && e.target.value) {
                    handleAddDate(e.target.value);
                    e.target.value = '';
                    e.target.blur();
                  }
                },
              } as any)
            : (
              <TextInput
                style={[styles.dateNativeInput, { outline: 'none' } as any]}
                placeholder="YYYY-MM-DD  (tap to add)"
                placeholderTextColor="#ccc"
                returnKeyType="done"
                onSubmitEditing={(e) => {
                  const v = e.nativeEvent.text.trim();
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { handleAddDate(v); }
                }}
              />
            )
          }

          {/* Visibility picker — create mode only */}
          {!isListAdd && !isEditMode && (
            <View style={styles.visibilitySection}>
              <Text style={styles.label}>type</Text>
              <View style={styles.visibilityRow}>
                {(['solo', 'public', 'friends'] as const).map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.visChip, visibility === v && styles.visChipActive]}
                    onPress={() => { setVisibility(v); setVisibilityError(null); }}
                  >
                    <Text style={[styles.visChipText, visibility === v && styles.visChipTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.visHint}>
                {visibility === 'solo'
                  ? 'Only you can see this plan.'
                  : visibility === 'public'
                  ? 'Others can express their interest in joining your plan.'
                  : 'Share to one of your friends lists.'}
              </Text>

              {visibility === 'friends' && (
                loadingLists ? (
                  <ActivityIndicator size="small" color={colors.subtle} style={{ marginTop: 12 }} />
                ) : sharedLists.length === 0 ? (
                  <Text style={styles.noListsText}>
                    To share a plan with your friends, first create a shared list in your Friends tab.
                  </Text>
                ) : (
                  <View style={styles.listPickerOptions}>
                    {sharedLists.map((list) => (
                      <TouchableOpacity
                        key={list.id}
                        style={[styles.listPickerRow, selectedListId === list.id && styles.listPickerRowSelected]}
                        onPress={() => { setSelectedListId(list.id === selectedListId ? null : list.id); setVisibilityError(null); }}
                      >
                        <Text style={[styles.listPickerLabel, selectedListId === list.id && styles.listPickerLabelSelected]}>
                          {listLabel(list, currentUserId ?? '')}
                        </Text>
                        {selectedListId === list.id && <Text style={styles.listPickerCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}
              {visibilityError ? <Text style={styles.fieldError}>{visibilityError}</Text> : null}
            </View>
          )}

          {/* Edit mode: simple solo/public toggle */}
          {isEditMode && !isListOnly && (
            <TouchableOpacity style={styles.openRow} onPress={() => setIsOpen(!isOpen)}>
              <View>
                <Text style={styles.openLabel}>open to doing with someone</Text>
                <Text style={styles.openSub}>others can see you're interested</Text>
              </View>
              <View style={[styles.toggle, isOpen && styles.toggleOn]}>
                <View style={[styles.thumb, isOpen && styles.thumbOn]} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.save, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.saveText}>SAVE PLAN</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 32, paddingBottom: 60 },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    color: '#111',
    textAlign: 'center',
    paddingBottom: 28,
    fontWeight: '400',
  },
  nameInput: {
    fontSize: 18,
    color: '#111',
    marginBottom: 4,
    lineHeight: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingBottom: 16,
    fontFamily: 'Georgia',
  },
  inputError: { borderBottomColor: '#e05252' },
  fieldError: {
    fontSize: 12,
    color: '#e05252',
    marginBottom: 20,
    marginTop: 2,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 12,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, color: colors.label },
  chipTextActive: { color: '#fff' },
  notes: {
    fontSize: 16,
    color: '#111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingVertical: 10,
    marginBottom: 4,
    minHeight: 72,
  },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 14,
  },
  dateChipText: { fontSize: 12, color: colors.accent },
  dateChipX: { fontSize: 14, color: colors.accent, lineHeight: 16 },
  dateNativeInput: {
    fontSize: 16,
    color: '#111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
    marginBottom: 12,
  },
  openRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
    marginTop: 8,
    marginBottom: 32,
  },
  openLabel: { fontSize: 14, color: '#111', marginBottom: 3 },
  openSub: { fontSize: 12, color: colors.muted },
  toggle: {
    width: 42, height: 24, borderRadius: 12, backgroundColor: '#e0e0e0',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: colors.accent },
  thumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  thumbOn: { alignSelf: 'flex-end' },
  visibilitySection: { marginTop: 8, marginBottom: 8 },
  visibilityRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  visChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visChipActive: { backgroundColor: '#111', borderColor: '#111' },
  visChipText: { fontSize: 13, color: colors.label },
  visChipTextActive: { color: '#fff' },
  visHint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  noListsText: { fontSize: 13, color: colors.accent, lineHeight: 19, marginBottom: 8 },
  listPickerOptions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  listPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  listPickerRowSelected: { backgroundColor: colors.tint },
  listPickerLabel: { fontSize: 14, color: colors.text },
  listPickerLabelSelected: { color: colors.accent },
  listPickerCheck: { fontSize: 13, color: colors.accent },
  save: {
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 24,
  },
  saveDisabled: { borderColor: '#e0e0e0' },
  saveText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
});
