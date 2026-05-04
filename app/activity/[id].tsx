import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LinkText from '../../components/LinkText';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getActivity, toggleOpen, deleteActivity, markAsCompleted, getMatchesForActivity } from '../../lib/activities';
import CompletionCelebration from '../../components/CompletionCelebration';
import type { Activity } from '../../lib/types';

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [matches, setMatches] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      if (!id) return;
      const [act, matchList] = await Promise.all([
        getActivity(id),
        uid ? getMatchesForActivity(id, uid) : [],
      ]);
      setActivity(act);
      setMatches(matchList);
      setLoading(false);
    });
  }, [id]);

  async function handleToggle() {
    if (!activity) return;
    const newValue = !activity.is_open;
    setActivity({ ...activity, is_open: newValue });
    try {
      await toggleOpen(activity.id, newValue);
      if (newValue && userId) {
        const updated = await getMatchesForActivity(activity.id, userId);
        setMatches(updated);
      }
    } catch {
      setActivity({ ...activity, is_open: !newValue }); // revert
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
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteActivity(activity.id);
          router.back();
        },
      },
    ]);
  }

  if (loading || !activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#6C47FF" /></View>
      </SafeAreaView>
    );
  }

  const isOwner = userId === activity.user_id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.category}>{activity.category}</Text>
          <Text style={styles.name}>{activity.name}</Text>
          {activity.notes ? <LinkText style={styles.notes}>{activity.notes}</LinkText> : null}
        </View>

        {isOwner && (
          <View style={styles.openSection}>
            <View style={styles.openRow}>
              <View>
                <Text style={styles.openLabel}>Open to doing with someone</Text>
                <Text style={styles.openSub}>
                  {activity.is_open ? "Others can see you're interested" : 'Only you can see this plan'}
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

        {activity.is_open && matches.length > 0 && (
          <View style={styles.matchesSection}>
            <Text style={styles.sectionTitle}>
              {matches.length} {matches.length === 1 ? 'person' : 'people'} also want this
            </Text>
            {matches.map((match) => {
              const profile = (match as any).profiles;
              const name = profile?.display_name ?? 'Someone';
              return (
                <View key={match.id} style={styles.matchCard}>
                  <View style={styles.matchAvatar}>
                    <Text style={styles.matchAvatarText}>{name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName}>{name}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {isOwner && !activity.completed_at && (
          <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
            <Text style={styles.completeText}>Mark as done ✓</Text>
          </TouchableOpacity>
        )}

        {activity.completed_at && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>✓ Completed</Text>
          </View>
        )}

        {isOwner && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>Remove from my plans</Text>
          </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  hero: { backgroundColor: '#fff', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  category: { fontSize: 13, color: '#6C47FF', fontWeight: '600', marginBottom: 6 },
  name: { fontSize: 26, fontWeight: '700', color: '#111' },
  notes: { fontSize: 14, color: '#666', marginTop: 8, lineHeight: 20 },
  openSection: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  openRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openLabel: { fontSize: 15, fontWeight: '600', color: '#111' },
  openSub: { fontSize: 13, color: '#888', marginTop: 4 },
  toggle: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#6C47FF' },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  matchesSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 12 },
  matchCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  matchAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE9FF',
    justifyContent: 'center', alignItems: 'center',
  },
  matchAvatarText: { fontSize: 18, color: '#6C47FF', fontWeight: '700' },
  matchInfo: { flex: 1 },
  matchName: { fontSize: 15, fontWeight: '600', color: '#111' },
  completeButton: {
    marginHorizontal: 20, marginTop: 24, padding: 16, borderRadius: 24,
    borderWidth: 1, borderColor: '#111', alignItems: 'center',
    backgroundColor: '#fff',
  },
  completeText: { color: '#111', fontWeight: '500', fontSize: 12, letterSpacing: 1.2 },
  completedBanner: {
    marginHorizontal: 20, marginTop: 24, padding: 16, borderRadius: 14,
    backgroundColor: '#EDE9FF', alignItems: 'center',
  },
  completedBannerText: { color: '#6C47FF', fontWeight: '700', fontSize: 15 },
  deleteButton: {
    marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 24,
    backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#f0e0e0',
  },
  deleteText: { color: '#FF4444', fontWeight: '600', fontSize: 15 },
});
