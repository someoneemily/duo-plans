import React, { useRef, useEffect } from 'react';
import {
  Animated, View, Text, StyleSheet, Dimensions,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../lib/colors';

const { height: SH, width: SW } = Dimensions.get('window');
const CARD_W = Math.min(SW * 0.80, 330);
const CARD_H = Math.min(SH * 0.14, 108);
const SLOT = Math.min(SH * 0.68, 460);
const PEEK = 5;
const N = 5;

const CARDS = [
  { name: 'Nobu Malibu',          category: 'food',       tagline: 'Legendary Malibu dining'   },
  { name: 'Hot air balloon ride', category: 'experience', tagline: 'Drift above the world'      },
  { name: 'Weekend in Ojai',      category: 'travel',     tagline: 'Wine country escape'        },
  { name: 'Silent disco',         category: 'experience', tagline: 'Dance to your own beat'     },
  { name: 'Champagne & oysters',  category: 'food',       tagline: 'The classic duo'            },
];

const STACK_TOP = Math.round(SH * 0.5 - CARD_H / 2);
const STACK_LEFT = Math.round((SW - CARD_W) / 2);

function cardTranslateY(i: number, scrollY: Animated.Value): Animated.AnimatedInterpolation<number> {
  const base = i * SLOT;
  if (i === 0) {
    return scrollY.interpolate({
      inputRange: [0, SLOT * 0.45, SLOT],
      outputRange: [0, -SH * 0.3, -SH * 0.56],
      extrapolate: 'clamp',
    });
  }
  if (i === 1) {
    return scrollY.interpolate({
      inputRange: [0, SLOT, SLOT * 1.45, SLOT * 2],
      outputRange: [PEEK, 0, -SH * 0.3, -SH * 0.56],
      extrapolate: 'clamp',
    });
  }
  if (i === 2) {
    return scrollY.interpolate({
      inputRange: [0, SLOT, SLOT * 2, SLOT * 2.45, SLOT * 3],
      outputRange: [PEEK * 2, PEEK, 0, -SH * 0.3, -SH * 0.56],
      extrapolate: 'clamp',
    });
  }
  return scrollY.interpolate({
    inputRange: [base - SLOT, base, base + SLOT * 0.45, base + SLOT],
    outputRange: [PEEK, 0, -SH * 0.3, -SH * 0.56],
    extrapolate: 'clamp',
  });
}

function cardScale(i: number, scrollY: Animated.Value): Animated.AnimatedInterpolation<number> {
  const base = i * SLOT;
  if (i === 0) {
    return scrollY.interpolate({
      inputRange: [0, SLOT * 0.5],
      outputRange: [1.0, 0.87],
      extrapolate: 'clamp',
    });
  }
  if (i === 1) {
    return scrollY.interpolate({
      inputRange: [0, SLOT, SLOT * 1.5],
      outputRange: [0.94, 1.0, 0.87],
      extrapolate: 'clamp',
    });
  }
  if (i === 2) {
    return scrollY.interpolate({
      inputRange: [0, SLOT, SLOT * 2, SLOT * 2.5],
      outputRange: [0.88, 0.94, 1.0, 0.87],
      extrapolate: 'clamp',
    });
  }
  return scrollY.interpolate({
    inputRange: [base - SLOT, base, base + SLOT * 0.5],
    outputRange: [0.94, 1.0, 0.87],
    extrapolate: 'clamp',
  });
}

function cardOpacity(i: number, scrollY: Animated.Value): Animated.AnimatedInterpolation<number> {
  const base = i * SLOT;
  const fadeIn = Math.max(0, base - 2 * SLOT);
  return scrollY.interpolate({
    inputRange: [fadeIn, fadeIn + 2, base + SLOT * 0.6, base + SLOT],
    outputRange: [i < 3 ? 1 : 0, 1, 1, 0],
    extrapolate: 'clamp',
  });
}

// Phase 1 (0–1s): quadratic ramp → position 0.4, speed 1.6
// Phase 2 (1–1.5s): linear cruise at speed 1.6 → position 0.8
// Phase 3 (1.5–2s): ease-out brake → position 1.0
// All derivatives match at junctions (no jerk)
function scrollEasing(t: number) {
  if (t < 0.5) return 1.6 * t * t;
  if (t < 0.75) return 0.4 + 1.6 * (t - 0.5);
  const s = (t - 0.75) / 0.25;
  return 0.8 + 0.2 * (1 - (1 - s) * (1 - s));
}

export default function Index() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const TOTAL_H = N * SLOT + SH * 1.1;

  const hintOpacity = scrollY.interpolate({
    inputRange: [0, SLOT * 0.15],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const target = N * SLOT;
    const duration = 2000;
    let rafId: number;

    const delay = setTimeout(() => {
      const startTime = Date.now();

      function step() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const y = target * scrollEasing(progress);
        scrollRef.current?.scrollTo({ y, animated: false });
        if (progress < 1) rafId = requestAnimationFrame(step);
      }

      rafId = requestAnimationFrame(step);
    }, 800);

    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {CARDS.map((card, i) => (
          <Animated.View
            key={card.name}
            style={[
              styles.card,
              {
                top: STACK_TOP,
                left: STACK_LEFT,
                zIndex: N - i,
                opacity: cardOpacity(i, scrollY),
                transform: [
                  { translateY: cardTranslateY(i, scrollY) },
                  { scale: cardScale(i, scrollY) },
                ],
              },
            ]}
          >
            <Text style={styles.cardCategory}>{card.category}</Text>
            <Text style={styles.cardName}>{card.name}</Text>
            <Text style={styles.cardTagline}>{card.tagline}</Text>
          </Animated.View>
        ))}
      </View>

      <View style={styles.header} pointerEvents="none">
        <Text style={styles.headerTitle}>duo plans</Text>
        <Text style={styles.headerSub}>what will you do next?</Text>
      </View>

      <Animated.View style={[styles.scrollHint, { opacity: hintOpacity }]} pointerEvents="none">
        <Text style={styles.scrollHintText}>scroll to explore  ↓</Text>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ minHeight: TOTAL_H }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: N * SLOT }} />

        <View style={[styles.cta, { minHeight: SH }]}>
          <Text style={styles.ctaEyebrow}>you've seen the vibe</Text>
          <Text style={styles.ctaTitle}>duo plans</Text>
          <Text style={styles.ctaSub}>
            save what you want to do.{'\n'}see who else is down.
          </Text>

          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push('/(public)/signup' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText}>create account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(public)/signin' as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.ctaSignIn}>already have one?  sign in →</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 22,
    paddingBottom: 10,
    alignItems: 'center',
    zIndex: 200,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontSize: 21,
    color: '#111',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
    letterSpacing: 0.4,
  },

  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardCategory: {
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardName: {
    fontFamily: 'Georgia',
    fontSize: 18,
    color: '#111',
    fontWeight: '400',
    lineHeight: 24,
  },
  cardTagline: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },

  scrollHint: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 150,
  },
  scrollHintText: {
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 0.5,
  },

  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    backgroundColor: '#fff',
  },
  ctaEyebrow: {
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  ctaTitle: {
    fontFamily: 'Georgia',
    fontSize: 34,
    color: '#111',
    fontWeight: '400',
    marginBottom: 14,
  },
  ctaSub: {
    fontSize: 15,
    color: colors.dim,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 40,
  },
  ctaPrimary: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#111',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 18,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  ctaSignIn: {
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 0.3,
  },
});
