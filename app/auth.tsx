import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      } else {
        if (!displayName) return;
        const { error } = await signUpWithEmail(email, password, displayName);
        if (error) throw error;
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim() && password.trim() && (mode === 'signin' || displayName.trim());

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.wordmark}>duo plans</Text>
          <Text style={styles.tagline}>do things together.</Text>

          <View style={styles.toggle}>
            <TouchableOpacity onPress={() => setMode('signin')}>
              <Text style={[styles.toggleOpt, mode === 'signin' && styles.toggleActive]}>sign in</Text>
            </TouchableOpacity>
            <Text style={styles.toggleSep}> · </Text>
            <TouchableOpacity onPress={() => setMode('signup')}>
              <Text style={[styles.toggleOpt, mode === 'signup' && styles.toggleActive]}>create account</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="your name"
              placeholderTextColor="#ccc"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor="#ccc"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            placeholderTextColor="#ccc"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  wordmark: {
    fontFamily: 'Georgia',
    fontSize: 30,
    color: '#111',
    marginBottom: 6,
    fontWeight: '400',
  },
  tagline: { fontSize: 14, color: '#bbb', fontStyle: 'italic', marginBottom: 48 },
  toggle: { flexDirection: 'row', marginBottom: 32 },
  toggleOpt: { fontSize: 14, color: '#bbb' },
  toggleActive: { color: '#111' },
  toggleSep: { fontSize: 14, color: '#ccc' },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 13,
    fontSize: 14,
    color: '#111',
    marginBottom: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    borderRadius: 24,
  },
  buttonDisabled: { borderColor: '#e0e0e0' },
  buttonText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
});
