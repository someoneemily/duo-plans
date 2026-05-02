import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile, updateProfile } from '../../lib/profile';

export default function EditProfile() {
  const router = useRouter();
  const [igHandle, setIgHandle] = useState('');
  const [phone, setPhone] = useState('');
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
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const handle = igHandle.trim().replace(/^@/, '');
      await updateProfile(session.user.id, {
        instagram_handle: handle || null,
        phone_number: phone.trim() || null,
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
    color: '#bbb',
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
  hint: {
    fontSize: 12,
    color: '#ccc',
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
