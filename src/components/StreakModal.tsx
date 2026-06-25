import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  streakCount: number;
  onClose: () => void;
}

const PARTICLE_COLORS = ['#F97316', '#FB923C', '#FBBF24', '#EF4444', '#FCD34D', '#F59E0B', '#FDE68A'];

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  angle: (i / 20) * 2 * Math.PI + (i % 2 === 0 ? 0.2 : -0.2),
  distance: 90 + (i % 4) * 30,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  size: 4 + (i % 4) * 2,
}));

export default function StreakModal({ visible, streakCount, onClose }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(16)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const particleAnims = useRef(
    PARTICLES.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) {
      backdropAnim.setValue(0);
      cardScale.setValue(0.3);
      cardOpacity.setValue(0);
      fireScale.setValue(0);
      textSlide.setValue(16);
      textOpacity.setValue(0);
      particleAnims.forEach(p => {
        p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.scale.setValue(0);
      });
      return;
    }

    // Fond
    Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();

    // Carte
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // Emoji feu (bounce)
    Animated.sequence([
      Animated.delay(150),
      Animated.spring(fireScale, { toValue: 1, damping: 7, stiffness: 200, useNativeDriver: true }),
    ]).start();

    // Texte
    Animated.sequence([
      Animated.delay(260),
      Animated.parallel([
        Animated.spring(textSlide, { toValue: 0, damping: 16, stiffness: 200, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
    ]).start();

    // Particules
    particleAnims.forEach((p, i) => {
      const { angle, distance } = PARTICLES[i];
      Animated.sequence([
        Animated.delay(80 + i * 12),
        Animated.parallel([
          Animated.spring(p.x, { toValue: Math.cos(angle) * distance, damping: 18, stiffness: 110, useNativeDriver: true }),
          Animated.spring(p.y, { toValue: Math.sin(angle) * distance, damping: 18, stiffness: 110, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 1, duration: 130, useNativeDriver: true }),
          Animated.spring(p.scale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(350),
            Animated.timing(p.opacity, { toValue: 0, duration: 550, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });

    // Auto-fermeture après 2.8s
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [visible]);

  const fireScaleInterp = fireScale.interpolate({
    inputRange: [0, 0.5, 0.8, 1],
    outputRange: [0, 1.3, 0.9, 1],
  });

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.container} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />

        {/* Carte */}
        <Animated.View
          style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        >
          {/* Emoji feu */}
          <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScaleInterp }] }]}>
            🔥
          </Animated.Text>

          {/* Texte */}
          <Animated.View style={{ transform: [{ translateY: textSlide }], opacity: textOpacity, alignItems: 'center', gap: 6 }}>
            <Text style={styles.streakCount}>{streakCount} jour{streakCount > 1 ? 's' : ''}</Text>
            <Text style={styles.streakLabel}>de série</Text>
            <Text style={styles.phrase}>Continue comme ça !</Text>
          </Animated.View>
        </Animated.View>

        {/* Particules */}
        <View style={styles.particlesContainer} pointerEvents="none">
          {PARTICLES.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                {
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  opacity: particleAnims[i].opacity,
                  transform: [
                    { translateX: particleAnims[i].x },
                    { translateY: particleAnims[i].y },
                    { scale: particleAnims[i].scale },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 5, 0, 0.7)',
  },
  card: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 4,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  fireEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  streakCount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#EA580C',
    textAlign: 'center',
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  phrase: {
    fontSize: 14,
    color: '#F97316',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  particlesContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
  },
});
