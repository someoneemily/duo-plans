import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Animated } from 'react-native';
import { colors } from '../lib/colors';

const PARTICLES = [
  { x: -80, y: -90 }, { x: 80, y: -90 },
  { x: -110, y: -30 }, { x: 110, y: -30 },
  { x: -50, y: -140 }, { x: 50, y: -140 },
];

function Particle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: x, damping: 12, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: y, damping: 12, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.particle, { opacity, transform: [{ translateX }, { translateY }] }]}>
      <Text style={styles.particleText}>✦</Text>
    </Animated.View>
  );
}

interface Props {
  visible: boolean;
  activityName: string;
  onDismiss: () => void;
}

export default function CompletionCelebration({ visible, activityName, onDismiss }: Props) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(checkScale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      cardScale.setValue(0.8);
      checkScale.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>
          {PARTICLES.map((pos, i) => (
            <Particle key={i} x={pos.x} y={pos.y} delay={i * 40} />
          ))}

          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Text style={styles.checkMark}>✓</Text>
          </Animated.View>

          <Text style={styles.doneLabel}>done</Text>
          <Text style={styles.activityName}>{activityName}</Text>
          <Text style={styles.subtitle}>you did the thing.</Text>

          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>BACK TO PLANS</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  particle: { position: 'absolute' },
  particleText: { fontSize: 12, color: colors.accent },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkMark: { fontSize: 26, color: '#111' },
  doneLabel: {
    fontFamily: 'Georgia',
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  activityName: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: '#111',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
    marginBottom: 32,
  },
  button: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
});
