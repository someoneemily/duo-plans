import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getInterestedUsers } from '../lib/activities';
import { colors } from '../lib/colors';
import type { Activity, Profile } from '../lib/types';
import LinkText from './LinkText';

function formatPlanDates(dates: string[]): string {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = dates.filter((d) => d >= today).sort();
  const targets = upcoming.length > 0 ? upcoming : dates.sort();
  return targets
    .slice(0, 2)
    .map((d) => {
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    })
    .join(', ') + (targets.length > 2 ? ' …' : '');
}

function TrashIcon({ color = colors.muted, size = 15 }: { color?: string; size?: number }) {
  if (Platform.OS === 'web') {
    return React.createElement('svg' as any, {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    },
      React.createElement('polyline', { points: '3 6 5 6 21 6' }),
      React.createElement('path', { d: 'M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6' }),
      React.createElement('path', { d: 'M10 11v6' }),
      React.createElement('path', { d: 'M14 11v6' }),
      React.createElement('path', { d: 'M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2' }),
    ) as any;
  }
  return <Text style={{ fontSize: size, color }}>🗑</Text>;
}

function PencilIcon({ color = colors.muted, size = 15 }: { color?: string; size?: number }) {
  if (Platform.OS === 'web') {
    return React.createElement('svg' as any, {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    },
      React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7' }),
      React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' }),
    ) as any;
  }
  return <Text style={{ fontSize: size, color }}>✏</Text>;
}

export interface ActivityRowProps {
  item: Activity;
  userId: string;
  onComplete?: () => void;
  onDelete?: () => void;
  onToggleOpen?: () => void;   // my-plans mode: shows public/solo chip + share
  addedBy?: Profile | null;    // shared-list mode: shows "added by"; also suppresses interested-users
  shade?: boolean;             // alternating row background
  noBorder?: boolean;
}

export function ActivityRow({
  item,
  userId,
  onComplete,
  onDelete,
  onToggleOpen,
  addedBy,
  shade,
  noBorder,
}: ActivityRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [interested, setInterested] = useState<Profile[]>([]);
  const [loadingInterested, setLoadingInterested] = useState(false);
  const [shared, setShared] = useState(false);

  const isDone = !!item.completed_at;
  const isListMode = addedBy !== undefined;
  const canEdit = item.user_id === userId && !isDone && item.source !== 'explore';

  // Eagerly fetch interested users for open my-plans rows so count shows on collapsed row
  useEffect(() => {
    if (!isListMode && item.is_open && !isDone) {
      setLoadingInterested(true);
      getInterestedUsers(item.name)
        .then(setInterested)
        .finally(() => setLoadingInterested(false));
    }
  }, [item.id]);

  async function toggleExpand() {
    setExpanded((e) => !e);
  }

  async function handleShare() {
    const url = Platform.OS === 'web'
      ? `${(window as any).location.origin}/activity/${item.id}`
      : `https://duo-plans.vercel.app/activity/${item.id}`;
    if (Platform.OS !== 'web') {
      await Share.share({ url, message: url });
    } else if (typeof (navigator as any).share === 'function') {
      try { await (navigator as any).share({ title: item.name, url }); } catch { /* cancelled */ }
    } else {
      try { await (navigator as any).clipboard.writeText(url); } catch { /* silent */ }
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    }
  }

  function handleEdit() {
    const params = [
      `activityId=${encodeURIComponent(item.id)}`,
      `prefillName=${encodeURIComponent(item.name)}`,
      `prefillCategory=${encodeURIComponent(item.category)}`,
      item.notes ? `prefillNotes=${encodeURIComponent(item.notes)}` : null,
      item.dates?.length ? `prefillDates=${encodeURIComponent(item.dates.join(','))}` : null,
      `prefillIsOpen=${item.is_open}`,
      `prefillIsListOnly=${item.is_list_only ?? false}`,
    ].filter(Boolean).join('&');
    router.push(`/activity/add?${params}` as any);
  }

  return (
    <View style={[styles.item, shade && styles.itemShaded, noBorder && styles.itemNoBorder, isDone && styles.itemDone]}>
      <TouchableOpacity style={styles.row} onPress={toggleExpand} activeOpacity={0.7}>
        <TouchableOpacity
          onPress={!isDone && onComplete ? onComplete : undefined}
          style={styles.circle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.5}
        >
          {isDone
            ? <Text style={styles.circleDone}>✓</Text>
            : <View style={styles.circleEmpty} />
          }
        </TouchableOpacity>

        <View style={styles.nameBlock}>
          <Text style={[styles.name, isDone && styles.nameDone]}>{item.name}</Text>
          <Text style={styles.meta}>
            {isListMode
              ? (addedBy?.display_name ? `added by ${addedBy.display_name}` : '')
              : item.is_open && !isDone
                ? (loadingInterested ? 'open' : interested.length > 0 ? `${interested.length} interested` : 'open')
                : item.category.toLowerCase() + (item.dates?.length ? ` · ${formatPlanDates(item.dates)}` : '')}
          </Text>
        </View>

        {isListMode && !isDone && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.subtle}
            style={{ marginLeft: 8 }}
          />
        )}

        {!isDone && (onToggleOpen || (!isListMode && item.source === 'explore' && onDelete)) && (
          <View style={styles.right}>
            {onToggleOpen && item.source !== 'explore' && (
              <TouchableOpacity
                onPress={onToggleOpen}
                style={[styles.duoChip, item.is_open && styles.duoChipOn]}
              >
                <Text style={[styles.duoChipText, item.is_open && styles.duoChipTextOn]}>
                  {item.is_open ? 'public' : 'solo'}
                </Text>
              </TouchableOpacity>
            )}
            {!isListMode && item.source === 'explore' && onDelete && (
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="heart" size={16} color={colors.accent} />
              </TouchableOpacity>
            )}
            {!isListMode && (
              <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-outline" size={16} color={shared ? colors.accent : colors.subtle} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expanded, { backgroundColor: shade ? colors.surface : '#fff' }]}>
          {item.notes ? <LinkText style={styles.expandedNotes}>{item.notes}</LinkText> : null}

          {isListMode && addedBy?.display_name ? (
            <Text style={styles.expandedMeta}>added by {addedBy.display_name}</Text>
          ) : null}

          {!isListMode && item.is_open && !isDone && (
            loadingInterested
              ? <ActivityIndicator color="#ccc" size="small" />
              : interested.length > 0
                ? (
                  <View style={{ gap: 6 }}>
                    <Text style={styles.expandedLabel}>interested · {interested.length}</Text>
                    {interested.map((p) => (
                      <Text key={p.id} style={styles.expandedPerson}>{p.display_name ?? 'someone'}</Text>
                    ))}
                  </View>
                )
                : <Text style={styles.expandedEmpty}>no one else interested yet</Text>
          )}

          {(() => {
            const showTrash = !!onDelete && (isListMode || item.source !== 'explore');
            if (!canEdit && !showTrash) return null;
            return (
              <View style={styles.actions}>
                {canEdit && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={handleEdit}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <PencilIcon color={colors.muted} size={15} />
                  </TouchableOpacity>
                )}
                {showTrash && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={onDelete}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <TrashIcon color={colors.muted} size={15} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  itemShaded: { backgroundColor: colors.surface },
  itemNoBorder: { borderBottomWidth: 0 },
  itemDone: { opacity: 0.45 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  circle: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  circleEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.subtle },
  circleDone: { fontSize: 13, color: colors.accent },
  nameBlock: { flex: 1 },
  name: { fontSize: 15, color: '#111' },
  nameDone: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
  duoChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.disabled,
    backgroundColor: '#fff',
  },
  duoChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  duoChipText: { fontSize: 9, color: colors.label, letterSpacing: 0.9, textTransform: 'uppercase' },
  duoChipTextOn: { color: '#fff', letterSpacing: 0.9 },
  expanded: {
    paddingHorizontal: 54,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 8,
  },
  expandedNotes: { fontSize: 13, color: colors.secondary, lineHeight: 19 },
  expandedMeta: { fontSize: 12, color: colors.muted },
  expandedLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  expandedPerson: { fontSize: 14, color: '#111' },
  expandedEmpty: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 20, paddingTop: 4 },
  iconBtn: { padding: 2 },
});
