import React, { useRef } from 'react';
import {
  Animated, View, Text, StyleSheet, Dimensions,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';

const { height: SH, width: SW } = Dimensions.get('window');
const CARD_W = Math.min(SW * 0.80, 330);
const CARD_H = Math.min(SH * 0.252, 186);
const SLOT = Math.min(SH * 0.68, 460);
const PEEK = 12;
const N = 5;

const CARDS = [
  { name: 'Nobu Malibu',          category: 'restaurant', tagline: 'Legendary Malibu dining'      },
  { name: 'Hot air balloon ride', category: 'experience', tagline: 'Drift above the world'         },
  { name: 'Weekend in Ojai',      category: 'travel',     tagline: 'Wine country escape'           },
  { name: 'Silent disco',         category: 'experience', tagline: 'Dance to your own beat'        },
  { name: 'Champagne & oysters',  category: 'restaurant', tagline: 'The classic duo'               },
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

export default function PublicExplore() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const TOTAL_H = N * SLOT + SH * 1.1;

  const hintOpacity = scrollY.interpolate({
    inputRange: [0, SLOT * 0.2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Card stack — no pointer events, driven by scrollY */}
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
            <Text style={styles.cardIndex}>{i + 1} / {N}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardCategory}>{card.category}</Text>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardTagline}>{card.tagline}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Header — above everything */}
      <View style={styles.header} pointerEvents="none">
        <Text style={styles.headerTitle}>duo plans</Text>
        <Text style={styles.headerSub}>what will you do next?</Text>
      </View>

      {/* Scroll hint */}
      <Animated.View style={[styles.scrollHint, { opacity: hintOpacity }]} pointerEvents="none">
        <Text style={styles.scrollHintText}>scroll to explore  ↓</Text>
      </Animated.View>

      {/* Transparent scroll driver + CTA content */}
      <Animated.ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ minHeight: TOTAL_H }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer that drives the card scroll animation */}
        <View style={{ height: N * SLOT }} />

        {/* CTA — scrolls into view after all 5 cards */}
        <View style={[styles.cta, { minHeight: SH }]}>
          <Text style={styles.ctaEyebrow}>you've seen the vibe</Text>
          <Text style={styles.ctaTitle}>duo plans</Text>
          <Text style={styles.ctaSub}>
            save what you want to do.{'\n'}see who else is down.
          </Text>

          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push('/(public)/signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText}>create account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(public)/signin')}
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
    color: '#bbb',
    marginTop: 3,
    letterSpacing: 0.4,
  },

  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#c9a0dc',
    padding: 18,
    justifyContent: 'space-between',
    shadowColor: '#c9a0dc',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
  },
  cardIndex: {
    fontSize: 11,
    color: '#ddd',
    letterSpacing: 0.5,
    alignSelf: 'flex-end',
  },
  cardBody: {
    gap: 8,
  },
  cardCategory: {
    fontSize: 10,
    color: '#c9a0dc',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardName: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: '#111',
    fontWeight: '400',
    lineHeight: 26,
  },
  cardTagline: {
    fontSize: 13,
    color: '#bbb',
    lineHeight: 19,
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
    color: '#ccc',
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
    color: '#c9a0dc',
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
    color: '#888',
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
    color: '#bbb',
    letterSpacing: 0.3,
  },
});
