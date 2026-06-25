import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  streakCount: number;
  bestCount: number;
  onClose: () => void;
}

const PARTICLE_COLORS = ['#C2557D', '#D9799C', '#EC4899', '#F9A8C9', '#8B5CF6', '#F472B6', '#FBCFE8'];

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * 2 * Math.PI + (i % 2 === 0 ? 0.15 : -0.15),
  distance: 100 + (i % 4) * 28,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  size: 4 + (i % 4) * 2,
}));

function getCopy(streakCount: number, isNewRecord: boolean): { subtitle: string; cta: string } {
  if (streakCount === 0) {
    return {
      subtitle: 'Réponds à 5 questions aujourd\'hui pour démarrer ta série.',
      cta: 'Allons-y !',
    };
  }
  if (isNewRecord && streakCount > 1) {
    return { subtitle: 'Nouveau record personnel ! Continue sur ta lancée.', cta: 'Je continue !' };
  }
  if (streakCount === 1) {
    return { subtitle: 'Bien démarré ! Reviens demain pour continuer.', cta: 'On continue !' };
  }
  if (streakCount < 4) {
    return { subtitle: 'Tu prends ton rythme, ne lâche rien !', cta: 'On continue !' };
  }
  if (streakCount < 7) {
    return { subtitle: 'Tu es lancé, continue comme ça !', cta: 'On continue !' };
  }
  if (streakCount < 14) {
    return { subtitle: 'Une semaine complète, bravo !', cta: 'On continue !' };
  }
  if (streakCount < 30) {
    return { subtitle: 'Impressionnant, ne casse pas ta série !', cta: 'On continue !' };
  }
  return { subtitle: 'Tu es une légende du quiz !', cta: 'On continue !' };
}

export default function StreakWelcomeModal({ visible, streakCount, bestCount, onClose }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0)).current;
  const fireGlow = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(16)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  const particleAnims = useRef(
    PARTICLES.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const isNewRecord = streakCount > 0 && streakCount >= bestCount;
  const hasStreak = streakCount > 0;
  const { subtitle, cta } = getCopy(streakCount, isNewRecord);
  const flameCount = Math.min(streakCount, 7);

  useEffect(() => {
    if (!visible) {
      backdropAnim.setValue(0);
      cardScale.setValue(0.3);
      cardOpacity.setValue(0);
      fireScale.setValue(0);
      fireGlow.setValue(0);
      textSlide.setValue(16);
      textOpacity.setValue(0);
      ctaOpacity.setValue(0);
      particleAnims.forEach(p => {
        p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.scale.setValue(0);
      });
      return;
    }

    Animated.timing(backdropAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();

    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(150),
      Animated.spring(fireScale, { toValue: 1, damping: 7, stiffness: 200, useNativeDriver: true }),
    ]).start();

    if (hasStreak) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fireGlow, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(fireGlow, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }

    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.spring(textSlide, { toValue: 0, damping: 16, stiffness: 200, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(420),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();

    if (hasStreak) {
      particleAnims.forEach((p, i) => {
        const { angle, distance } = PARTICLES[i];
        Animated.sequence([
          Animated.delay(80 + i * 14),
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
    }
  }, [visible]);

  const fireScaleInterp = fireScale.interpolate({
    inputRange: [0, 0.5, 0.8, 1],
    outputRange: [0, 1.3, 0.9, 1],
  });
  const glowOpacity = fireGlow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  const glowScale = fireGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />

        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          {hasStreak && (
            <Animated.View
              style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
              pointerEvents="none"
            />
          )}

          <Animated.Text style={[styles.fireEmoji, { transform: [{ scale: fireScaleInterp }] }]}>
            {hasStreak ? '🔥' : '✨'}
          </Animated.Text>

          <Animated.View style={{ transform: [{ translateY: textSlide }], opacity: textOpacity, alignItems: 'center', gap: 6, width: '100%' }}>
            <Text style={styles.eyebrow}>Série en cours</Text>
            {hasStreak ? (
              <View style={styles.bigNumberRow}>
                <Text style={styles.bigNumber}>{streakCount}</Text>
                <Text style={styles.bigNumberUnit}>jour{streakCount > 1 ? 's' : ''}</Text>
              </View>
            ) : (
              <Text style={styles.bigNumber}>0</Text>
            )}
            <Text style={styles.subtitle}>{subtitle}</Text>

            {hasStreak && (
              <View style={styles.flameRow}>
                {Array.from({ length: flameCount }).map((_, i) => (
                  <Text key={i} style={styles.miniFlame}>🔥</Text>
                ))}
                {streakCount > 7 && <Text style={styles.flameOverflow}>+{streakCount - 7}</Text>}
              </View>
            )}

            {!isNewRecord && bestCount > 0 && (
              <Text style={styles.recordHint}>Record personnel : {bestCount} jour{bestCount > 1 ? 's' : ''}</Text>
            )}
            {isNewRecord && streakCount > 1 && (
              <View style={styles.recordBadge}>
                <Text style={styles.recordBadgeText}>🏆 Nouveau record</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View style={{ opacity: ctaOpacity, width: '100%' }}>
            <TouchableOpacity style={styles.ctaBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.ctaBtnText}>{cta}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <View style={styles.particlesContainer} pointerEvents="none">
          {hasStreak && PARTICLES.map((p, i) => (
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
      </View>
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
    backgroundColor: 'rgba(15, 5, 0, 0.72)',
  },
  card: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 18,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  glow: {
    position: 'absolute',
    top: 12,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#C2557D',
  },
  fireEmoji: {
    fontSize: 60,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  bigNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#C2557D',
    textAlign: 'center',
  },
  bigNumberUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C2557D',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  flameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  miniFlame: { fontSize: 16 },
  flameOverflow: { fontSize: 13, fontWeight: '800', color: '#C2557D', marginLeft: 2 },
  recordHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
  },
  recordBadge: {
    backgroundColor: '#FDF2F8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 2,
  },
  recordBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2557D',
  },
  ctaBtn: {
    backgroundColor: '#C2557D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
