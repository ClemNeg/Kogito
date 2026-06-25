import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../config/firebase';

export async function pickAndUploadAvatar(uid: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.6,
  });

  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const response = await fetch(uri);
  const blob = await response.blob();

  const storageRef = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: url });
  }
  await updateDoc(doc(db, 'users', uid), { photoURL: url });

  return url;
}
