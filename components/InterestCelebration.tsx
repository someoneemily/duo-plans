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

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  visible: boolean;
  activityName: string;
  notes?: string | null;
  dates?: string[] | null;
  onDismiss: () => void;
}

export default function InterestCelebration({ visible, activityName, notes, dates, onDismiss }: Props) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const heartScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(heartScale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      cardScale.setValue(0.8);
      heartScale.setValue(0);
    }
  }, [visible]);

  const upcomingDates = dates?.filter((d) => d >= new Date().toISOString().split('T')[0]).sort() ?? [];

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>
          {PARTICLES.map((pos, i) => (
            <Particle key={i} x={pos.x} y={pos.y} delay={i * 40} />
          ))}

          <Animated.View style={[styles.heartCircle, { transform: [{ scale: heartScale }] }]}>
            <Text style={styles.heartMark}>♥</Text>
          </Animated.View>

          <Text style={styles.interestedLabel}>interested</Text>
          <Text style={styles.activityName}>{activityName}</Text>

          {notes ? (
            <Text style={styles.notes}>{notes}</Text>
          ) : null}

          {upcomingDates.length > 0 && (
            <View style={styles.datesRow}>
              {upcomingDates.slice(0, 3).map((d) => (
                <View key={d} style={styles.dateChip}>
                  <Text style={styles.dateChipText}>{formatDate(d)}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.subtitle}>
            The creator will reach out if they'd like to do this together.
          </Text>

          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>GOT IT</Text>
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
  heartCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heartMark: { fontSize: 24, color: colors.accent },
  interestedLabel: {
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
    marginBottom: 8,
  },
  notes: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 10,
  },
  datesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 10,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dateChipText: { fontSize: 11, color: colors.accent },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 32,
    marginTop: 8,
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
