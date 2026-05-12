import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signInWithEmail } from '../../lib/auth';
import { colors } from '../../lib/colors';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) return;
    setAuthError(null);
    setLoading(true);
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
      // Root _layout handles redirect once session updates — don't navigate here.
    } catch (err: any) {
      setAuthError(err.message ?? 'Something went wrong. Try again.');
      setLoading(false);
    }
  }

  const canSubmit = email.trim() && password.trim();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.inner}>
          <Text style={styles.wordmark}>duo plans</Text>
          <Text style={styles.tagline}>do things together.</Text>

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
              <Text style={styles.buttonText}>SIGN IN</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  back: { position: 'absolute', top: 54, left: 22, zIndex: 10 },
  backText: { fontSize: 22, color: colors.muted },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  wordmark: {
    fontFamily: 'Georgia',
    fontSize: 30,
    color: '#111',
    marginBottom: 6,
    fontWeight: '400',
  },
  tagline: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginBottom: 48 },
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
