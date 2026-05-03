import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { openInstagram } from '../../lib/linking';
import { useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { getMyActivities } from '../../lib/activities';
import { getMyMatches } from '../../lib/matches';
import type { Activity } from '../../lib/types';

function getTier(completed: number) {
  if (completed >= 10) return 'veteran';
  if (completed >= 5) return 'regular';
  if (completed >= 1) return 'explorer';
  return 'new';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ display_name: string | null; instagram_handle: string | null; phone_number: string | null } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(async ({ data }) => {
        const uid = data.session?.user.id;
        if (!uid) return;
        const [{ data: prof }, acts, matches] = await Promise.all([
          supabase.from('profiles').select('display_name, instagram_handle, phone_number').eq('id', uid).single(),
          getMyActivities(uid),
          getMyMatches(uid),
        ]);
        setProfile(prof);
        setActivities(acts);
        setMatchCount(matches.length);
        setLoading(false);
      });
    }, [])
  );

  async function handleSignOut() {
    await signOut();
    router.replace('/auth');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#ccc" /></View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.display_name ?? 'you';
  const done = activities.filter((a) => !!a.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
  const planCount = activities.length;
  const tier = getTier(done.length);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>profile</Text>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.tier}>{tier}</Text>
          {profile?.instagram_handle ? (
            <TouchableOpacity
              onPress={() => openInstagram(profile.instagram_handle!)}
              style={{ marginTop: 10 }}
            >
              <Text style={styles.igHandle}>@{profile.instagram_handle.replace(/^@/, '')}</Text>
            </TouchableOpacity>
          ) : null}
          {profile?.phone_number ? (
            <Text style={styles.phoneNumber}>{profile.phone_number}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.statNum}>{planCount}</Text>
            <Text style={styles.statLabel}>plans</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.statNum}>{done.length}</Text>
            <Text style={styles.statLabel}>done</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)/matches')}>
            <Text style={styles.statNum}>{matchCount}</Text>
            <Text style={styles.statLabel}>matches</Text>
          </TouchableOpacity>
        </View>

        {/* Done list */}
        <Text style={styles.sectionLabel}>done · {done.length}</Text>
        {done.length === 0 ? (
          <View style={styles.emptyDone}>
            <Text style={styles.emptyText}>nothing completed yet.</Text>
          </View>
        ) : (
          <View style={styles.doneList}>
            {done.map((item, i) => (
              <View
                key={item.id}
                style={[styles.doneRow, i === done.length - 1 && styles.doneRowLast]}
              >
                <View style={styles.doneLeft}>
                  <Text style={styles.doneName}>{item.name}</Text>
                  <Text style={styles.doneMeta}>
                    {item.category.toLowerCase()}
                    {item.completed_at ? ` · ${formatDate(item.completed_at)}` : ''}
                  </Text>
                </View>
                {item.is_private && <Text style={styles.lockIcon}>🔒</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <Text style={[styles.sectionLabel, { marginTop: 36 }]}>settings</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/profile/edit')}>
            <Text style={styles.settingsLabel}>edit profile</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
          <Text style={styles.signOutText}>sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 60 },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: '#111',
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    fontWeight: '400',
  },
  identity: { alignItems: 'center', paddingBottom: 28 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: '#ddd',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 22, color: '#111', fontFamily: 'Georgia' },
  name: { fontSize: 18, color: '#111', fontFamily: 'Georgia', marginBottom: 6 },
  tier: { fontSize: 11, color: '#c9a0dc', letterSpacing: 1.5, textTransform: 'uppercase' },
  igHandle: { fontSize: 13, color: '#c9a0dc', textDecorationLine: 'underline' },
  phoneNumber: { fontSize: 13, color: '#bbb', marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  stat: { flex: 1, paddingVertical: 20, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Georgia', color: '#111', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#bbb', letterSpacing: 0.5 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#ececec' },
  sectionLabel: {
    fontSize: 12, color: '#999',
    paddingHorizontal: 20, marginTop: 28, marginBottom: 8,
  },
  emptyDone: {
    marginHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: '#ccc', fontStyle: 'italic' },
  doneList: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  doneRowLast: { borderBottomWidth: 0 },
  doneLeft: { flex: 1 },
  doneName: { fontSize: 15, color: '#111' },
  doneMeta: { fontSize: 12, color: '#bbb', marginTop: 2 },
  lockIcon: { fontSize: 11, opacity: 0.3 },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ececec',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f5f5f5',
  },
  settingsLabel: { fontSize: 14, color: '#111' },
  chevron: { fontSize: 18, color: '#ccc' },
  signOut: { marginTop: 32, alignItems: 'center' },
  signOutText: { fontSize: 13, color: '#bbb' },
});
