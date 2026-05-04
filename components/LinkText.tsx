import { Text, StyleSheet } from 'react-native';
import { openURL } from '../lib/linking';

const URL_PATTERN = /https?:\/\/[^\s]+/i;

export default function LinkText({ children, style }: { children: string; style?: any }) {
  const segments = children.split(/(https?:\/\/[^\s]+)/gi);

  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        URL_PATTERN.test(seg) ? (
          <Text key={i} style={styles.link} onPress={() => openURL(seg)}>
            {seg}
          </Text>
        ) : (
          seg
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: '#c9a0dc', textDecorationLine: 'underline' },
});
