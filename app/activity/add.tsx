import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { addActivity } from '../../lib/activities';
import type { Category } from '../../lib/types';

const CATEGORIES: Category[] = ['Restaurant', 'Experience', 'Travel', 'Other'];

export default function AddActivity() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [notes, setNotes] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && category.length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      await addActivity({
        userId: session.user.id,
        name: name.trim(),
        category: category as Category,
        notes: notes.trim() || undefined,
        isOpen,
      });
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

          <Text style={styles.pageTitle}>add plan</Text>

          <TextInput
            style={[styles.nameInput, { outline: 'none' } as any]}
            placeholder="what do you want to do?"
            placeholderTextColor="#ccc"
            value={name}
            onChangeText={setName}
            autoFocus
            multiline
          />

          <Text style={styles.label}>category</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat.toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>notes</Text>
          <TextInput
            style={[styles.notes, { outline: 'none' } as any]}
            placeholder="any context or details..."
            placeholderTextColor="#ccc"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <TouchableOpacity style={styles.openRow} onPress={() => setIsOpen(!isOpen)}>
            <View>
              <Text style={styles.openLabel}>open to doing with someone</Text>
              <Text style={styles.openSub}>others can see you're interested</Text>
            </View>
            <View style={[styles.toggle, isOpen && styles.toggleOn]}>
              <View style={[styles.thumb, isOpen && styles.thumbOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.save, !canSave && styles.saveDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
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
    marginBottom: 32,
    lineHeight: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingBottom: 16,
    fontFamily: 'Georgia',
  },
  label: {
    fontSize: 11,
    color: '#bbb',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, color: '#999' },
  chipTextActive: { color: '#fff' },
  notes: {
    fontSize: 14,
    color: '#111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingVertical: 10,
    marginBottom: 28,
    minHeight: 72,
  },
  openRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
    marginBottom: 32,
  },
  openLabel: { fontSize: 14, color: '#111', marginBottom: 3 },
  openSub: { fontSize: 12, color: '#bbb' },
  toggle: {
    width: 42, height: 24, borderRadius: 12, backgroundColor: '#e0e0e0',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#c9a0dc' },
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
