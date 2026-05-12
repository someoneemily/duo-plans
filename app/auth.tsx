import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { colors } from '../lib/colors';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    setAuthError(null);
  }

  async function handleSubmit() {
    if (!email || !password) return;
    if (mode === 'signup' && !displayName) return;
    setAuthError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUpWithEmail(email, password, displayName);
        if (error) throw error;
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      setAuthError(err.message ?? 'Something went wrong. Try again.');
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
            <TouchableOpacity onPress={() => switchMode('signin')}>
              <Text style={[styles.toggleOpt, mode === 'signin' && styles.toggleActive]}>sign in</Text>
            </TouchableOpacity>
            <Text style={styles.toggleSep}> · </Text>
            <TouchableOpacity onPress={() => switchMode('signup')}>
              <Text style={[styles.toggleOpt, mode === 'signup' && styles.toggleActive]}>create account</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <TextInput
              style={[styles.input, { outline: 'none' } as any]}
              placeholder="your name"
              placeholderTextColor="#ccc"
              value={displayName}
              onChangeText={(v) => { setDisplayName(v); setAuthError(null); }}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={[styles.input, { outline: 'none' } as any]}
            placeholder="email"
            placeholderTextColor="#ccc"
            value={email}
            onChangeText={(v) => { setEmail(v); setAuthError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { outline: 'none' } as any]}
            placeholder="password"
            placeholderTextColor="#ccc"
            value={password}
            onChangeText={(v) => { setPassword(v); setAuthError(null); }}
            secureTextEntry
          />

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

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
  tagline: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginBottom: 48 },
  toggle: { flexDirection: 'row', marginBottom: 32 },
  toggleOpt: { fontSize: 14, color: colors.muted },
  toggleActive: { color: '#111' },
  toggleSep: { fontSize: 14, color: colors.subtle },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 13,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#e05252',
    marginBottom: 12,
    lineHeight: 18,
  },
  button: {
    borderWidth: 1,
    borderColor: '#111',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 24,
  },
  buttonDisabled: { borderColor: '#e0e0e0' },
  buttonText: { fontSize: 11, color: '#111', letterSpacing: 1.5, fontWeight: '500' },
});
