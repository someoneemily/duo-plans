import { Platform, Linking } from 'react-native';

export function openURL(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}

export function openInstagram(handle: string) {
  openURL(`https://www.instagram.com/${handle.replace(/^@/, '')}/`);
}
