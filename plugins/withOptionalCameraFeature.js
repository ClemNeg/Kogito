const { withAndroidManifest } = require('expo/config-plugins');

// expo-image-picker demande les permissions CAMERA et RECORD_AUDIO (capture vidéo), ce qui
// amène Android/Google Play à supposer par défaut que l'appli nécessite un appareil photo
// et un micro physiques, et à exclure les appareils qui n'en ont pas. On marque explicitement
// ces features comme optionnelles puisque l'utilisateur peut toujours choisir une photo/vidéo
// depuis la galerie sans jamais utiliser la caméra ou le micro.
const OPTIONAL_CAMERA_FEATURES = [
  'android.hardware.camera',
  'android.hardware.camera.any',
  'android.hardware.camera.autofocus',
  'android.hardware.microphone',
];

function withOptionalCameraFeature(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];

    OPTIONAL_CAMERA_FEATURES.forEach((name) => {
      const exists = manifest['uses-feature'].some(
        (f) => f.$?.['android:name'] === name
      );
      if (!exists) {
        manifest['uses-feature'].push({
          $: { 'android:name': name, 'android:required': 'false' },
        });
      }
    });

    return config;
  });
}

module.exports = withOptionalCameraFeature;
