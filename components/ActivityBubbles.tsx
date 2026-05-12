import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

const CONTAINER_HEIGHT = 200;
const TOTAL_TRAVEL = CONTAINER_HEIGHT + 80; // distance per full loop

const ACTIVITIES = [
  'Nobu Malibu',
  'Hot air balloon ride',
  'Bali trip',
  'Omakase dinner',
  'Pottery class',
  'Weekend in Ojai',
  'Night at a jazz club',
  'Sunset hike',
  'Natural wine tasting',
  'Rooftop dinner',
  'Silent disco',
  'Escape room',
  'Weekend in Palm Springs',
  'Tokyo food tour',
  'Cooking class',
  'Ski trip to Mammoth',
  'Champagne and oysters',
  'Perfume blending class',
];

// 5 bubbles: fixed labels, horizontal spread, staggered vertical start
const CONFIGS = [
  { label: ACTIVITIES[0],  leftFrac: 0.03, startYFrac: 0.82, speed: 7400 },
  { label: ACTIVITIES[4],  leftFrac: 0.24, startYFrac: 0.45, speed: 8800 },
  { label: ACTIVITIES[8],  leftFrac: 0.44, startYFrac: 0.14, speed: 7800 },
  { label: ACTIVITIES[11], leftFrac: 0.58, startYFrac: 0.65, speed: 9400 },
  { label: ACTIVITIES[14], leftFrac: 0.72, startYFrac: 0.30, speed: 8200 },
];

function Bubble({
  label, leftFrac, startYFrac, speed, containerWidth,
}: {
  label: string;
  leftFrac: number;
  startYFrac: number;
  speed: number;
  containerWidth: number;
}) {
  const y = useRef(new Animated.Value(CONTAINER_HEIGHT * startYFrac)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rise = (fromY: number) => {
      const dist = fromY + 50;
      const dur = Math.round(speed * (dist / TOTAL_TRAVEL));
      const fade = Math.min(700, Math.round(dur * 0.18));

      Animated.parallel([
        Animated.timing(y, {
          toValue: -50,
          duration: dur,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.sequence([
          Animated.timing(op, { toValue: 1, duration: fade, useNativeDriver: true }),
          Animated.delay(Math.max(0, dur - fade * 2)),
          Animated.timing(op, { toValue: 0, duration: fade, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          y.setValue(CONTAINER_HEIGHT + 30);
          rise(CONTAINER_HEIGHT + 30);
        }
      });
    };

    rise(CONTAINER_HEIGHT * startYFrac);

    return () => {
      y.stopAnimation();
      op.stopAnimation();
    };
  }, []);

  if (containerWidth === 0) return null;

  const leftPx = Math.min(containerWidth * leftFrac, containerWidth - 140);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: leftPx,
          opacity: op,
          transform: [{ translateY: y }],
        },
      ]}
    >
      <Text style={styles.bubbleText} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}

export default function ActivityBubbles() {
  const [containerWidth, setContainerWidth] = useState(0);

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {CONFIGS.map((c, i) => (
        <Bubble
          key={i}
          label={c.label}
          leftFrac={c.leftFrac}
          startYFrac={c.startYFrac}
          speed={c.speed}
          containerWidth={containerWidth}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    width: '100%',
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#c9a0dc',
    borderRadius: 20,
    backgroundColor: 'rgba(201, 160, 220, 0.05)',
    maxWidth: 160,
  },
  bubbleText: {
    fontSize: 12,
    color: '#c9a0dc',
    letterSpacing: 0.3,
  },
});
