import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile, updateProfile } from '../../lib/profile';
import { isUsernameAvailable } from '../../lib/profiles';
import { validateHandle, validatePhone } from '../../lib/validate';
import { colors } from '../../lib/colors';

export default function EditProfile() {
  const router = useRouter();
  const [igHandle, setIgHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const originalUsername = useRef('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      const profile = await getProfile(uid);
      if (profile) {
        setIgHandle(profile.instagram_handle ?? '');
        setPhone(profile.phone_number ?? '');
        setUsername(profile.username ?? '');
        originalUsername.current = profile.username ?? '';
      }
      setLoading(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const available = await isUsernameAvailable(username, session.user.id);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 400);
    return () => clearTimeout(t);
  }, [username, usernameStatus]);

  async function handleSave() {
    const handleError = igHandle.trim() ? validateHandle(igHandle) : null;
    const phoneError = phone.trim() ? validatePhone(phone) : null;
    if (handleError) { Alert.alert('', handleError); return; }
    if (phoneError) { Alert.alert('', phoneError); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      if (usernameStatus === 'taken') { Alert.alert('', 'That username is taken.'); return; }
      if (usernameStatus === 'invalid') { Alert.alert('', 'Username must be 3–20 characters, letters/numbers/underscores only.'); return; }
      const handle = igHandle.trim().replace(/^@/, '');
      await updateProfile(session.user.id, {
        instagram_handle: handle || null,
        phone_number: phone.trim() || null,
        username: username || null,
      });
      setSaved(true);
      setTimeout(() => router.replace('/(tabs)/profile'), 900);
    } catch (err: any) {
      Alert.alert('', err.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#ccc" /></View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.pageTitle}>edit profile</Text>

          <Text style={styles.label}>username</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.usernameAt}>@</Text>
            <TextInput
              style={[styles.usernameInput, { outline: 'none' } as any]}
              placeholder="your_username"
              placeholderTextColor="#ccc"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#ccc" style={styles.usernameStatus} />}
            {usernameStatus === 'available' && <Text style={[styles.usernameStatus, styles.usernameAvailable]}>✓</Text>}
            {usernameStatus === 'taken' && <Text style={[styles.usernameStatus, styles.usernameTaken]}>taken</Text>}
            {usernameStatus === 'invalid' && <Text style={[styles.usernameStatus, styles.usernameTaken]}>3–20 chars</Text>}
          </View>

          <Text style={styles.label}>my instagram</Text>
          <TextInput
            style={[styles.input, { outline: 'none' } as any]}
            placeholder="@yourhandle"
            placeholderTextColor="#ccc"
            value={igHandle}
            onChangeText={setIgHandle}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>my phone</Text>
          <TextInput
            style={[styles.input, { outline: 'none' } as any]}
            placeholder="+1 000 000 0000"
            placeholderTextColor="#ccc"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.hint}>
            share what you're comfortable with — others can use this to connect with you
          </Text>

          <TouchableOpacity
            style={[styles.save, (saving || saved) && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving || saved}
          >
            {saving
              ? <ActivityIndicator color="#111" />
              : saved
              ? <Text style={styles.saveText}>SAVED ✓</Text>
              : <Text style={styles.saveText}>SAVE</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 32, paddingBottom: 60 },
  pageTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    color: '#111',
    textAlign: 'center',
    paddingBottom: 36,
    fontWeight: '400',
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    fontSize: 16,
    color: '#111',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingBottom: 12,
    marginBottom: 32,
  },
  usernameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ececec',
    paddingBottom: 12,
    marginBottom: 32,
  },
  usernameAt: { fontSize: 16, color: colors.muted, marginRight: 2 },
  usernameInput: { flex: 1, fontSize: 16, color: '#111' },
  usernameStatus: { marginLeft: 8 },
  usernameAvailable: { fontSize: 13, color: colors.accent },
  usernameTaken: { fontSize: 12, color: '#e05252' },
  hint: {
    fontSize: 12,
    color: colors.subtle,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 18,
  },
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
