import './global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { consumePendingDeepLink } from '../lib/pendingDeepLink';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    const inAuth = segments[0] === 'auth';
    const inPublic = segments[0] === '(public)';
    const inActivity = segments[0] === 'activity';
    const inRoot = segments.length === 0;
    if (!session && !inPublic && !inActivity && !inRoot) {
      router.replace('/');
    } else if (session && (inAuth || inPublic || inRoot)) {
      consumePendingDeepLink().then((href) => {
        router.replace((href as any) ?? '/(tabs)');
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
          name="activity/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="activity/add"
          options={{ headerShown: true, title: 'Add Activity', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
