import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === 'granted') return true;

  if (!canAskAgain) {
    Alert.alert(
      'Camera Permission Required',
      'Medbro needs camera access to scan prescriptions and medicines. Please enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  }
  return false;
}

export async function requestGalleryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;

  if (!canAskAgain) {
    Alert.alert(
      'Photo Library Permission Required',
      'Medbro needs access to your photo library to pick prescription images. Please enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  }
  return false;
}
