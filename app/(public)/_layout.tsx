import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  explore: { active: 'search',      inactive: 'search-outline' },
  signup:  { active: 'person-add',  inactive: 'person-add-outline' },
  signin:  { active: 'log-in',      inactive: 'log-in-outline' },
};

export default function PublicLayout() {
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
    >
      <Tabs.Screen name="explore" options={{ title: 'explore' }} />
      <Tabs.Screen name="signup"  options={{ title: 'join' }} />
      <Tabs.Screen name="signin"  options={{ title: 'sign in' }} />
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
});
