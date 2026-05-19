import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, AppState, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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

const TAB_LABELS: Record<string, string> = {
  index: 'plans', explore: 'explore', friends: 'friends', profile: 'profile',
};

const TAB_HREFS: Record<string, string> = {
  index:   '/(tabs)',
  explore: '/(tabs)/explore',
  friends: '/(tabs)/friends',
  profile: '/(tabs)/profile',
};

function CustomTabBar({ state, navigation, inviteBadge }: BottomTabBarProps & { inviteBadge: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const routes = state.routes; // [index, explore, friends, profile]
  const leftRoutes  = [routes[0], routes[1]];
  const rightRoutes = [routes[2], routes[3]];

  function handlePress(routeName: string, isFocused: boolean) {
    if (!isFocused) router.replace(TAB_HREFS[routeName] ?? '/(tabs)/');
  }

  function renderTab(route: typeof routes[0]) {
    const isFocused = state.routes[state.index].name === route.name;
    const icons = TAB_ICONS[route.name];
    const iconName = isFocused ? icons?.active : icons?.inactive;
    const color = isFocused ? '#111' : colors.muted;
    const badge = route.name === 'friends' && inviteBadge > 0 ? inviteBadge : null;

    return (
      <TouchableOpacity
        key={route.name}
        style={styles.tabItem}
        onPress={() => handlePress(route.name, isFocused)}
        activeOpacity={0.7}
      >
        <View>
          {iconName ? <Ionicons name={iconName} size={22} color={color} /> : null}
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.tabLabel, { color }]}>{TAB_LABELS[route.name]}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {leftRoutes.map(renderTab)}

      <View style={styles.fabSlot}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/activity/add?source=myplans' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

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
      tabBar={(props) => <CustomTabBar {...props} inviteBadge={inviteBadge} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"   options={{ title: 'plans' }} />
      <Tabs.Screen name="explore" options={{ title: 'explore' }} />
      <Tabs.Screen name="friends" options={{ title: 'friends' }} />
      <Tabs.Screen name="profile" options={{ title: 'profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ececec',
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  fabSlot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 68,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: { fontSize: 22, color: colors.accent, lineHeight: 24, marginTop: -1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '600' },
});
