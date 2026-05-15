import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { refreshMatchBadge, startMatchRealtimeListener } from '../../lib/matchBadge';
import { refreshInviteBadge, subscribeInviteBadge, startInviteRealtimeListener } from '../../lib/inviteBadge';
import { colors } from '../../lib/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index:   { active: 'sparkles',         inactive: 'sparkles-outline' },
  explore: { active: 'search',           inactive: 'search-outline' },
  friends: { active: 'people',           inactive: 'people-outline' },
  profile: { active: 'person-circle',    inactive: 'person-circle-outline' },
};

const TAB_HREFS: Record<string, string> = {
  index:   '/(tabs)',
  explore: '/(tabs)/explore',
  friends: '/(tabs)/friends',
  profile: '/(tabs)/profile',
};

export default function TabsLayout() {
  const router = useRouter();
  const userIdRef = useRef<string | null>(null);
  const [inviteBadge, setInviteBadge] = useState(0);

  useEffect(() => {
    const unsubInvite = subscribeInviteBadge(setInviteBadge);

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      userIdRef.current = uid;
      if (uid) {
        refreshMatchBadge(uid);
        refreshInviteBadge(uid);
        startMatchRealtimeListener(uid);
        startInviteRealtimeListener(uid);
      }
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userIdRef.current) {
        refreshMatchBadge(userIdRef.current);
        refreshInviteBadge(userIdRef.current);
      }
    });

    return () => {
      appSub.remove();
      unsubInvite();
    };
  }, []);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#111',
        tabBarInactiveTintColor: colors.muted,
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
      <Tabs.Screen name="index"   options={{ title: 'plans' }} />
      <Tabs.Screen name="explore" options={{ title: 'explore' }} />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'friends',
          tabBarBadge: inviteBadge > 0 ? inviteBadge : undefined,
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
    backgroundColor: colors.accent,
    fontSize: 9,
  },
});
