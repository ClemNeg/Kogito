import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { EloLevel } from '../utils/eloLevels';

const MASCOT_IMAGES: Partial<Record<number, any>> = {
  1: require('../../assets/mascottes/level_1.png'),
  2: require('../../assets/mascottes/level_2.png'),
  3: require('../../assets/mascottes/level_3.png'),
  4: require('../../assets/mascottes/level_4.png'),
  5: require('../../assets/mascottes/level_5.png'),
  6: require('../../assets/mascottes/level_6.png'),
  7: require('../../assets/mascottes/level_7.png'),
  8: require('../../assets/mascottes/level_8.png'),
  9: require('../../assets/mascottes/level_9.png'),
  10: require('../../assets/mascottes/level_10.png'),
};

const SIZES = {
  large:    { container: 160, emoji: 72, borderRadius: 32 },
  medium:   { container: 120, emoji: 54, borderRadius: 24 },
  standard: { container: 90,  emoji: 42, borderRadius: 20 },
  compact:  { container: 68,  emoji: 32, borderRadius: 16 },
  small:    { container: 40,  emoji: 22, borderRadius: 10 },
};

interface Props {
  level: EloLevel;
  size?: 'large' | 'medium' | 'standard' | 'compact' | 'small';
}

export default function Mascotte({ level, size = 'medium' }: Props) {
  const dim = SIZES[size];
  const image = MASCOT_IMAGES[level.id];

  if (image) {
    return (
      <Image
        source={image}
        style={{ width: dim.container, height: dim.container, borderRadius: dim.borderRadius }}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: dim.container,
          height: dim.container,
          borderRadius: dim.borderRadius,
        },
      ]}
    >
      <Text style={{ fontSize: dim.emoji, lineHeight: dim.emoji * 1.2 }}>{level.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#FDF2F8',
    borderWidth: 2,
    borderColor: '#FBCFE8',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
