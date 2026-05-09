import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pending_deep_link';

export async function setPendingDeepLink(href: string): Promise<void> {
  await AsyncStorage.setItem(KEY, href);
}

export async function consumePendingDeepLink(): Promise<string | null> {
  const val = await AsyncStorage.getItem(KEY);
  if (val) await AsyncStorage.removeItem(KEY);
  return val;
}
