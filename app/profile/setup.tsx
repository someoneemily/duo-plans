import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { updateProfile } from '../../lib/profile';
import { isUsernameAvailable } from '../../lib/profiles';
import { colors } from '../../lib/colors';

export default function ProfileSetup() {
  const router = useRouter();
  const { returning } = useLocalSearchParams<{ new?: string; returning?: string }>();
  const isReturning = returning === '1';

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const originalUsername = useRef('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReturning) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => router.replace('/(tabs)'));
    }
  }, [isReturning]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) { router.replace('/'); return; }
      setUserId(uid);
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, instagram_handle, phone_number')
        .eq('id', uid)
        .single();
      if (profile) {
        setDisplayName(profile.display_name ?? '');
        setUsername(profile.username ?? '');
        originalUsername.current = profile.username ?? '';
        setInstagramHandle(profile.instagram_handle ?? '');
        setPhoneNumber(profile.phone_number ?? '');
      }
    });
  }, []);

  function handleUsernameChange(v: string) {
    const val = v.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(val);
    if (val === originalUsername.current) { setUsernameStatus('idle'); return; }
    if (val.length < 3 || val.length > 20) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
  }

  useEffect(() => {
    if (usernameStatus !== 'checking') return;
    const t = setTimeout(async () => {
      if (!userId) return;
      const available = await isUsernameAvailable(username, userId);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 400);
    return () => clearTimeout(t);
  }, [username, usernameStatus]);

  async function handleContinue() {
    if (!userId) return;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;
    setSaving(true);
    try {
      await updateProfile(userId, {
        username: username || null,
        instagram_handle: instagramHandle.replace(/^@/, '').trim() || null,
        phone_number: phoneNumber.trim() || null,
      });
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }

  const canContinue = usernameStatus !== 'taken' && usernameStatus !== 'invalid' && !saving;
  const firstName = displayName.split(' ')[0].toLowerCase();

  if (isReturning) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
          <Text style={styles.wordmark}>duo plans</Text>
          <Text style={styles.tagline}>welcome back{firstName ? `, ${firstName}` : ''}.</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.wordmark}>duo plans</Text>
          <Text style={styles.tagline}>welcome{firstName ? `, ${firstName}` : ''}.</Text>

          <Text style={styles.label}>your username</Text>
          <Text style={styles.hint}>this is how friends find you</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.usernameInput, { outline: 'none' } as any]}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#ccc" />}
            {usernameStatus === 'available' && <Text style={styles.statusAvailable}>✓</Text>}
          </View>
          {usernameStatus === 'taken' && (
            <Text style={styles.statusError}>
              @{username} is already taken — try a different one
            </Text>
          )}
          {usernameStatus === 'invalid' && (
            <Text style={styles.statusError}>3–20 characters, letters/numbers/underscores only</Text>
          )}

          <Text style={[styles.label, { marginTop: 32 }]}>instagram (optional)</Text>
          <Text style={styles.hint}>so friends can reach you about activities</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={[styles.usernameInput, { outline: 'none' } as any]}
              value={instagramHandle.replace(/^@/, '')}
              onChangeText={(v) => setInstagramHandle(v.replace(/^@/, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="yourhandle"
              placeholderTextColor="#ccc"
            />
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>phone number (optional)</Text>
          <Text style={styles.hint}>or share your number instead</Text>
          <View style={styles.usernameWrap}>
            <TextInput
              style={[styles.usernameInput, { outline: 'none' } as any]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="+1 555 000 0000"
              placeholderTextColor="#ccc"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, !canContinue && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            {saving
              ? <ActivityIndicator color="#111" />
              : <Text style={styles.buttonText}>Start making plans</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  wordmark: { fontFamily: 'Georgia', fontSize: 30, color: '#111', marginBottom: 6, fontWeight: '400' },
  tagline: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginBottom: 52 },
  label: { fontSize: 11, color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  hint: { fontSize: 13, color: colors.subtle, marginBottom: 16 },
  usernameWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
    paddingBottom: 12, marginBottom: 8,
  },
  at: { fontSize: 20, color: colors.muted, marginRight: 2 },
  usernameInput: { flex: 1, fontSize: 20, color: '#111' },
  statusAvailable: { fontSize: 14, color: colors.accent },
  statusError: { fontSize: 13, color: '#e05252', marginBottom: 24 },
  button: {
    borderWidth: 1, borderColor: '#111',
    paddingVertical: 14, alignItems: 'center', borderRadius: 24,
    marginTop: 28,
  },
  buttonDisabled: { borderColor: '#e0e0e0' },
  buttonText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
});
