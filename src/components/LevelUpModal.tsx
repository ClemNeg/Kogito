import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EloLevel } from '../utils/eloLevels';
import Mascotte from './Mascotte';

interface Props {
  visible: boolean;
  oldLevel: EloLevel;
  newLevel: EloLevel;
  onClose: () => void;
}

const PARTICLE_COLORS = ['#C2557D', '#F9A8C9', '#FBCFE8', '#F59E0B', '#FCD34D', '#8B5CF6', '#C4B5FD'];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  angle: (i / 18) * 2 * Math.PI + (i % 2 === 0 ? 0.15 : -0.15),
  distance: 110 + (i % 3) * 40,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  size: 5 + (i % 4) * 2,
}));

export default function LevelUpModal({ visible, oldLevel, newLevel, onClose }: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.4)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const mascotBounce = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const shineRotate = useRef(new Animated.Value(0)).current;

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
      cardScale.setValue(0.4);
      cardOpacity.setValue(0);
      mascotBounce.setValue(0);
      titleSlide.setValue(20);
      titleOpacity.setValue(0);
      shineRotate.setValue(0);
      particleAnims.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.scale.setValue(0); });
      return;
    }

    // Fond
    Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();

    // Carte
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Mascotte bounce (décalé)
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(mascotBounce, { toValue: 1, damping: 8, stiffness: 180, useNativeDriver: true }),
    ]).start();

    // Titre (décalé)
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(titleSlide, { toValue: 0, damping: 16, stiffness: 200, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();

    // Rotation lueur
    Animated.loop(
      Animated.timing(shineRotate, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();

    // Particules
    particleAnims.forEach((p, i) => {
      const { angle, distance } = PARTICLES[i];
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      Animated.sequence([
        Animated.delay(100 + i * 15),
        Animated.parallel([
          Animated.spring(p.x, { toValue: tx, damping: 18, stiffness: 120, useNativeDriver: true }),
          Animated.spring(p.y, { toValue: ty, damping: 18, stiffness: 120, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(p.scale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [visible]);

  const isLevelUp = newLevel.id > oldLevel.id;
  const mascotScale = mascotBounce.interpolate({ inputRange: [0, 0.6, 0.8, 1], outputRange: [0, 1.2, 0.9, 1] });
  const spin = shineRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Fond */}
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />

        {/* Carte */}
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          {/* Lueur tournante */}
          <Animated.View style={[styles.shine, { transform: [{ rotate: spin }] }]} pointerEvents="none" />

          {/* Badge */}
          <View style={[styles.badge, !isLevelUp && styles.badgeDown]}>
            <Ionicons name={isLevelUp ? 'arrow-up-circle' : 'arrow-down-circle'} size={14} color="#FFFFFF" />
            <Text style={styles.badgeText}>{isLevelUp ? 'PALIER SUPÉRIEUR' : 'PALIER INFÉRIEUR'}</Text>
          </View>

          {/* Mascotte */}
          <Animated.View style={{ transform: [{ scale: mascotScale }] }}>
            <Mascotte level={newLevel} size="large" />
          </Animated.View>

          {/* Nouveau palier */}
          <Animated.View style={{ transform: [{ translateY: titleSlide }], opacity: titleOpacity, alignItems: 'center' }}>
            <Text style={styles.newLevelName}>{newLevel.name}</Text>
            <Text style={styles.eloRange}>{newLevel.elo_min} – {newLevel.elo_max} ELO</Text>
            <Text style={[styles.phrase, !isLevelUp && styles.phraseDown]}>
              {isLevelUp
                ? `Bravo ! Vous venez de passer le palier ${newLevel.name} !`
                : 'Vous redescendez de palier, mais courage vous allez remonter !'}
            </Text>
          </Animated.View>

          {/* Transition ancien → nouveau */}
          <View style={styles.transitionRow}>
            <Text style={styles.oldLevelName}>{oldLevel.name}</Text>
            <Ionicons name="arrow-forward" size={14} color={isLevelUp ? '#C2557D' : '#6B7280'} />
            <Text style={[styles.newLevelNameSmall, !isLevelUp && styles.newLevelNameSmallDown]}>{newLevel.name}</Text>
          </View>

          {/* Bouton */}
          <TouchableOpacity style={[styles.btn, !isLevelUp && styles.btnDown]} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>{isLevelUp ? 'Continuer !' : 'Compris'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Particules au premier plan (uniquement en montée) */}
        {isLevelUp && (
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
        )}
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
    backgroundColor: 'rgba(30, 10, 20, 0.88)',
  },
  particlesContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
  },
  card: {
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 12,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    borderWidth: 60,
    borderColor: 'rgba(249, 168, 201, 0.06)',
    top: -150,
    left: -150,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C2557D',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeDown: {
    backgroundColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  phrase: {
    fontSize: 14,
    color: '#C2557D',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  phraseDown: {
    color: '#6B7280',
  },
  newLevelName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  eloRange: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  oldLevelName: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  newLevelNameSmall: {
    fontSize: 13,
    color: '#C2557D',
    fontWeight: '700',
  },
  newLevelNameSmallDown: {
    color: '#6B7280',
  },
  btn: {
    marginTop: 4,
    backgroundColor: '#C2557D',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    shadowColor: '#C2557D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDown: {
    backgroundColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
