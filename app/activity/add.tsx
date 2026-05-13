import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { addActivity } from '../../lib/activities';
import { addActivityToList } from '../../lib/sharedLists';
import { validateActivityName } from '../../lib/validate';
import type { Category } from '../../lib/types';
import { colors } from '../../lib/colors';

const CATEGORIES: Category[] = ['Restaurant', 'Experience', 'Travel', 'Other'];

const TODAY = new Date().toISOString().split('T')[0];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AddActivity() {
  const router = useRouter();
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const isListAdd = !!listId;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(!isListAdd);
  const [dates, setDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

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
    return ok;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const activity = await addActivity({
        userId: session.user.id,
        name: name.trim(),
        category: category as Category,
        notes: notes.trim() || undefined,
        isOpen: isListAdd ? false : isOpen,
        isListOnly: isListAdd,
        dates: dates.length > 0 ? dates : undefined,
      });
      if (isListAdd && listId) {
        await addActivityToList(listId, activity.id, session.user.id);
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

          <Text style={styles.pageTitle}>{isListAdd ? 'add to list' : 'add plan'}</Text>

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
                onChange: (e: any) => {
                  if (e.target.value) {
                    handleAddDate(e.target.value);
                    e.target.value = '';
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

          {!isListAdd && (
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
