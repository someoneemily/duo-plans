import './global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { consumePendingDeepLink } from '../lib/pendingDeepLink';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [googleSignIn, setGoogleSignIn] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Detect Google OAuth callback before getSession resolves
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      setGoogleSignIn(true);
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s?.user.app_metadata?.provider === 'google') {
        setGoogleSignIn(true);
      }
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    const inAuth = segments[0] === 'auth';
    const inPublic = segments[0] === '(public)';
    const inActivity = segments[0] === 'activity';
    const inRoot = segments.length === 0 || segments[0] === 'index';
    if (!session && !inPublic && !inActivity && !inRoot) {
      router.replace('/');
    } else if (session && (inAuth || inPublic || inRoot)) {
      const isGoogle = session.user.app_metadata?.provider === 'google';
      const createdAt = new Date(session.user.created_at).getTime();
      const lastSignIn = new Date(session.user.last_sign_in_at ?? session.user.created_at).getTime();
      const isNewUser = isGoogle && (lastSignIn - createdAt) < 60_000;
      consumePendingDeepLink().then((href) => {
        if (href) { setGoogleSignIn(false); router.replace(href as any); return; }
        if (googleSignIn) {
          setGoogleSignIn(false);
          const ageMs = Date.now() - new Date(session.user.created_at).getTime();
          const dest = ageMs < 120_000 ? '/profile/setup?new=1' : '/profile/setup?returning=1';
          router.replace(dest as any);
        } else {
          router.replace('/(tabs)');
        }
      });
    }
  }, [session, segments]);

  if (session === undefined) return null; // splash while loading

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="matches"
          options={{ headerShown: true, title: '', headerLeftContainerStyle: { paddingLeft: 0 } }}
        />
        <Stack.Screen
          name="activity/[id]"
          options={{ headerShown: true, title: '', headerLeftContainerStyle: { paddingLeft: 0 } }}
        />
        <Stack.Screen
          name="activity/add"
          options={{ headerShown: true, title: 'Add Activity', presentation: 'modal' }}
        />
        <Stack.Screen
          name="friends/[listId]"
          options={{ headerShown: true, title: '', headerLeftContainerStyle: { paddingLeft: 0 } }}
        />
        <Stack.Screen
          name="friends/new"
          options={{ headerShown: true, title: '', headerLeftContainerStyle: { paddingLeft: 0 } }}
        />
        <Stack.Screen name="profile/setup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
