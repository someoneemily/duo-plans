import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { createSharedList, findListWithMembers } from '../../lib/sharedLists';
import { searchProfiles } from '../../lib/profiles';
import { colors } from '../../lib/colors';
import type { Profile } from '../../lib/types';

export default function NewSharedList() {
  const router = useRouter();
  const { preselect, name: preName } = useLocalSearchParams<{ preselect?: string; name?: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<{ message: string; existingListId?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  // Pre-fill from affinity row
  useEffect(() => {
    if (preselect && preName) {
      setSelected([{ id: preselect, display_name: preName, username: null, avatar_url: null, instagram_handle: null, phone_number: null, created_at: '' }]);
    }
  }, [preselect, preName]);

  useEffect(() => {
    if (!query.trim() || !userId) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const profiles = await searchProfiles(query, userId);
      setResults(profiles.filter((p) => !selected.some((s) => s.id === p.id)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, userId, selected]);

  function toggle(profile: Profile) {
    setError(null);
    setSelected((prev) =>
      prev.some((p) => p.id === profile.id)
        ? prev.filter((p) => p.id !== profile.id)
        : [...prev, profile]
    );
    setQuery('');
    setResults([]);
  }

  async function handleCreate() {
    if (!userId || selected.length === 0) return;
    setError(null);
    setCreating(true);
    try {
      const existingId = await findListWithMembers(userId, selected.map((p) => p.id));
      if (existingId) {
        setError({ message: 'You already have a shared list with this person.', existingListId: existingId });
        return;
      }
      await createSharedList(userId, selected.map((p) => p.id));
      router.back();
    } catch (e: any) {
      setError({ message: e?.message ?? 'Something went wrong. Please try again.' });
    } finally {
      setCreating(false);
    }
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/friends' as any);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        headerLeft: () => (
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>start a shared list</Text>
        <Text style={styles.subtitle}>invite someone to plan together</Text>

        {/* Selected chips */}
        {selected.length > 0 && (
          <View style={styles.chips}>
            {selected.map((p) => (
              <TouchableOpacity key={p.id} style={styles.chip} onPress={() => toggle(p)}>
                <Text style={styles.chipText}>{p.display_name ?? 'unknown'}</Text>
                <Text style={styles.chipX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            style={[styles.search, { outline: 'none' } as any]}
            placeholder="search by name…"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            autoFocus={!preselect}
          />
          {searching && <ActivityIndicator size="small" color={colors.subtle} style={{ marginRight: 12 }} />}
        </View>

        {results.length > 0 && (
          <View style={styles.resultList}>
            {results.map((p) => (
              <TouchableOpacity key={p.id} style={styles.resultRow} onPress={() => toggle(p)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.display_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <Text style={styles.resultName}>{p.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selected.length > 0 && (
          <TouchableOpacity
            style={[styles.createBtn, creating && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.createBtnText}>CREATE LIST</Text>
            }
          </TouchableOpacity>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.existingListId && (
              <TouchableOpacity
                onPress={() => router.replace(`/friends/${error.existingListId}` as any)}
              >
                <Text style={styles.errorLink}>view existing list →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingBottom: 60 },
  backBtn: { fontSize: 28, color: colors.muted, paddingLeft: 16 },

  title: {
    fontFamily: 'Georgia',
    fontSize: 22,
    color: colors.text,
    fontWeight: '400',
    marginBottom: 6,
  },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 28 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.tint,
  },
  chipText: { fontSize: 13, color: colors.accent },
  chipX: { fontSize: 14, color: colors.accent },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 4,
  },
  search: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  resultList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.tint,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  resultName: { fontSize: 15, color: colors.text },

  createBtn: {
    backgroundColor: colors.text,
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnText: { fontSize: 11, color: '#fff', letterSpacing: 1.5, fontWeight: '500' },

  errorCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  errorText: { fontSize: 13, color: colors.secondary },
  errorLink: { fontSize: 13, color: colors.accent },
});
