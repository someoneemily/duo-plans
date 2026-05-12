import { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { subscribeMatchBadge } from '../lib/matchBadge';
import { colors } from '../lib/colors';

export default function MatchBell() {
  const [count, setCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    return subscribeMatchBadge(setCount);
  }, []);

  return (
    <TouchableOpacity
      onPress={() => router.push('/matches' as any)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.wrap}
    >
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={20}
        color={colors.muted}
      />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -5,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '600' },
});
