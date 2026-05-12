import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const ENTERED_KEY = 'friends_beta_entered';

export async function checkIsFriendsBetaUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('friends_beta_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function hasFriendsEntered(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENTERED_KEY)) === 'true';
}

export async function setFriendsEntered(): Promise<void> {
  await AsyncStorage.setItem(ENTERED_KEY, 'true');
}
