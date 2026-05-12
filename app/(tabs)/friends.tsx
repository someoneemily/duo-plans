import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, SafeAreaView } from 'react-native';
import { colors } from '../../lib/colors';

export default function Friends() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 900,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.center, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.headline}>Create memories</Text>
        <Text style={styles.headline}>with friends.</Text>
        <Text style={styles.sub}>coming soon</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  headline: {
    fontFamily: 'Georgia',
    fontSize: 26,
    color: colors.text,
    fontWeight: '400',
    lineHeight: 36,
    textAlign: 'center',
  },
  sub: {
    marginTop: 16,
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
