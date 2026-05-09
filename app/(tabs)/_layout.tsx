import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { subscribeMatchBadge, refreshMatchBadge } from '../../lib/matchBadge';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index:   { active: 'sparkles',         inactive: 'sparkles-outline' },
  explore: { active: 'search',           inactive: 'search-outline' },
  matches: { active: 'people',           inactive: 'people-outline' },
  profile: { active: 'person-circle',    inactive: 'person-circle-outline' },
};

const TAB_HREFS: Record<string, string> = {
  index:   '/(tabs)/',
  explore: '/(tabs)/explore',
  matches: '/(tabs)/matches',
  profile: '/(tabs)/profile',
};

export default function TabsLayout() {
  const router = useRouter();
  const [badgeCount, setBadgeCount] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = subscribeMatchBadge(setBadgeCount);

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      userIdRef.current = uid;
      if (uid) refreshMatchBadge(uid);
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userIdRef.current) {
        refreshMatchBadge(userIdRef.current);
      }
    });

    return () => {
      unsub();
      appSub.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: '#bbb',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.active : icons?.inactive;
          return name ? <Ionicons name={name} size={22} color={color} /> : null;
        },
      })}
      screenListeners={({ navigation, route }) => ({
        tabPress: (e) => {
          const state = navigation.getState();
          const isFocused = state.routes[state.index].name === route.name;
          if (!isFocused) {
            e.preventDefault();
            router.replace(TAB_HREFS[route.name] ?? '/(tabs)/');
          }
        },
      })}
    >
      <Tabs.Screen name="index"   options={{ title: 'home' }} />
      <Tabs.Screen name="explore" options={{ title: 'explore' }} />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'matches',
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#ececec',
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
    height: 60,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#c9a0dc',
    fontSize: 10,
  },
});
