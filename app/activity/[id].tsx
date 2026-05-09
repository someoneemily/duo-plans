import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Platform, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import LinkText from '../../components/LinkText';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  getActivity, toggleOpen, deleteActivity, markAsCompleted,
  getInterestedUsers, addActivity,
} from '../../lib/activities';
import { setPendingDeepLink } from '../../lib/pendingDeepLink';
import CompletionCelebration from '../../components/CompletionCelebration';
import type { Activity } from '../../lib/types';

type InterestedPerson = { id: string; display_name: string | null; avatar_url?: string | null };

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [interested, setInterested] = useState<InterestedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (!id) { setLoading(false); return; }
      const act = await getActivity(id);
      setActivity(act);
      if (act) {
        const people = await getInterestedUsers(act.name);
        setInterested(people);
      }
      setLoading(false);
    })();
  }, [id]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  async function handleToggle() {
    if (!activity) return;
    const newValue = !activity.is_open;
    setActivity({ ...activity, is_open: newValue });
    try {
      await toggleOpen(activity.id, newValue);
    } catch {
      setActivity({ ...activity, is_open: !newValue });
    }
  }

  async function handleComplete() {
    if (!activity) return;
    await markAsCompleted(activity.id);
    setActivity({ ...activity, completed_at: new Date().toISOString(), is_open: false });
    setCelebrating(true);
  }

  async function handleDelete() {
    if (!activity) return;
    Alert.alert('Remove plan', 'Remove this from your plans?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => { await deleteActivity(activity.id); router.back(); },
      },
    ]);
  }

  async function handleAddToPlans() {
    if (!activity || !userId) return;
    setAdding(true);
    try {
      await addActivity({
        userId,
        name: activity.name,
        category: activity.category as any,
        notes: activity.notes ?? undefined,
        isOpen: true,
        source: 'explore',
      });
      setTimeout(() => router.replace('/(tabs)'), 300);
    } catch {
      setAdding(false);
    }
  }

  async function handleShare() {
    const url = Platform.OS === 'web'
      ? `${(window as any).location.origin}/activity/${id}`
      : `https://duo-plans.vercel.app/activity/${id}`;

    if (Platform.OS !== 'web') {
      await Share.share({ url, message: url });
    } else if (typeof (navigator as any).share === 'function') {
      try { await (navigator as any).share({ title: activity?.name ?? 'duo plans', url }); } catch { /* cancelled */ }
    } else {
      try {
        await (navigator as any).clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* silent */ }
    }
  }

  async function handleSignIn() {
    if (id) await setPendingDeepLink(`/activity/${id}`);
    router.push('/(public)/signin' as any);
  }

  async function handleSignUp() {
    if (id) await setPendingDeepLink(`/activity/${id}`);
    router.push('/(public)/signup' as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#c9a0dc" /></View>
      </SafeAreaView>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Activity not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = userId === activity.user_id;
  const isLoggedIn = !!userId;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerLeft: () => (
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
      )}} />
      <ScrollView contentContainerStyle={styles.scroll}>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareText}>{copied ? 'copied ✓' : 'copy link'}</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <Text style={styles.category}>{activity.category?.toLowerCase()}</Text>
          <Text style={styles.name}>{activity.name}</Text>
          {activity.notes ? <LinkText style={styles.notes}>{activity.notes}</LinkText> : null}
        </View>

        {interested.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {interested.length} {interested.length === 1 ? 'person' : 'people'} interested
            </Text>
            {interested.map((person) => (
              <View key={person.id} style={styles.personRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{person.display_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <Text style={styles.personName}>{person.display_name}</Text>
              </View>
            ))}
          </View>
        )}

        {isOwner && (
          <View style={styles.section}>
            <View style={styles.openRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.openLabel}>open to doing with someone</Text>
                <Text style={styles.openSub}>
                  {activity.is_open ? "others can see you're interested" : 'only you can see this plan'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, activity.is_open && styles.toggleOn]}
                onPress={handleToggle}
              >
                <View style={[styles.toggleThumb, activity.is_open && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isOwner && !activity.completed_at && (
          <TouchableOpacity style={styles.actionButton} onPress={handleComplete}>
            <Text style={styles.actionButtonText}>MARK AS DONE</Text>
          </TouchableOpacity>
        )}

        {activity.completed_at && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>completed</Text>
          </View>
        )}

        {isOwner && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>remove from my plans</Text>
          </TouchableOpacity>
        )}

        {isLoggedIn && !isOwner && (
          <TouchableOpacity style={styles.actionButton} onPress={handleAddToPlans} disabled={adding}>
            {adding
              ? <ActivityIndicator color="#111" />
              : <Text style={styles.actionButtonText}>ADD TO MY PLANS</Text>
            }
          </TouchableOpacity>
        )}

        {!isLoggedIn && (
          <View style={styles.ctaSection}>
            <Text style={styles.ctaLabel}>want to do this?</Text>
            <TouchableOpacity style={styles.ctaButton} onPress={handleSignUp}>
              <Text style={styles.ctaButtonText}>CREATE ACCOUNT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={handleSignIn}>
              <Text style={styles.ctaSecondaryText}>sign in →</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      <CompletionCelebration
        visible={celebrating}
        activityName={activity.name}
        onDismiss={() => { setCelebrating(false); router.back(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { fontSize: 17, color: '#007AFF', paddingLeft: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 15, color: '#999' },
  scroll: { paddingBottom: 60 },
  shareButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  shareText: { fontSize: 12, color: '#999', letterSpacing: 0.5 },
  hero: {
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  category: {
    fontSize: 11,
    color: '#c9a0dc',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  name: {
    fontFamily: 'Georgia',
    fontSize: 28,
    color: '#111',
    fontWeight: '400',
    lineHeight: 34,
  },
  notes: { fontSize: 14, color: '#888', marginTop: 10, lineHeight: 21 },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
  },
  sectionLabel: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f5eeff',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, color: '#c9a0dc', fontWeight: '600' },
  personName: { fontSize: 15, color: '#111' },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  openLabel: { fontSize: 14, color: '#111', fontWeight: '500' },
  openSub: { fontSize: 12, color: '#bbb', marginTop: 3 },
  toggle: {
    width: 46, height: 26, borderRadius: 13, backgroundColor: '#e0e0e0',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#c9a0dc' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  actionButton: {
    marginHorizontal: 24, marginTop: 28, paddingVertical: 15,
    borderRadius: 24, borderWidth: 1, borderColor: '#111', alignItems: 'center',
  },
  actionButtonText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
  completedBanner: {
    marginHorizontal: 24, marginTop: 28, paddingVertical: 14,
    borderRadius: 12, backgroundColor: '#f5eeff', alignItems: 'center',
  },
  completedText: { color: '#c9a0dc', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  deleteButton: {
    marginHorizontal: 24, marginTop: 8, paddingVertical: 14, alignItems: 'center',
  },
  deleteText: { color: '#ddd', fontSize: 13 },
  ctaSection: {
    marginTop: 48, paddingHorizontal: 24, alignItems: 'center',
  },
  ctaLabel: { fontSize: 13, color: '#bbb', fontStyle: 'italic', marginBottom: 24 },
  ctaButton: {
    borderWidth: 1, borderColor: '#111', paddingVertical: 14,
    borderRadius: 24, alignItems: 'center', width: '100%',
  },
  ctaButtonText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
  ctaSecondary: { marginTop: 16, paddingVertical: 8 },
  ctaSecondaryText: { fontSize: 14, color: '#bbb' },
});
