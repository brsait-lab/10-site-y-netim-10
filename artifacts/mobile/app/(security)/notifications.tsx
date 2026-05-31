import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData, AppNotification } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const TYPE_META: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise:        { label: "Gürültü",      color: "#ef4444", icon: "volume-2" },
  cargo:        { label: "Kargo",        color: "#8b5cf6", icon: "package" },
  package:      { label: "Paket",        color: "#8b5cf6", icon: "package" },
  announcement: { label: "Genel Duyuru",color: "#3b82f6", icon: "volume-2" },
  payment:      { label: "Ödeme",        color: "#f59e0b", icon: "credit-card" },
  general:      { label: "Genel",        color: "#64748b", icon: "bell" },
  security:     { label: "Güvenlik",     color: "#ef4444", icon: "shield" },
};

function NotifCard({ n, onRead, userId }: { n: AppNotification; onRead: (id: string) => void; userId: string }) {
  const colors = useColors();
  const isRead = n.readBy.includes(userId);
  const meta = TYPE_META[n.type] ?? TYPE_META.general;

  return (
    <Pressable
      onPress={() => { if (!isRead) onRead(n.id); }}
      style={[
        styles.card,
        {
          backgroundColor: isRead ? colors.card : "#f0fdf4",
          borderColor: isRead ? colors.border : colors.primary + "40",
          borderLeftColor: meta.color,
          borderLeftWidth: 3,
          borderRadius: 14,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.catPill, { backgroundColor: meta.color + "20", borderRadius: 20 }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.catText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(n.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
          </Text>
          {!isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{n.title}</Text>
      {n.fromName ? (
        <View style={styles.senderRow}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.senderText, { color: colors.mutedForeground }]}>{n.fromName}</Text>
        </View>
      ) : null}
      <Text style={[styles.cardMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{n.message}</Text>
    </Pressable>
  );
}

export default function SecurityNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyNotifications, markNotificationRead, unreadCount } = useData();
  const notifs = getMyNotifications();
  const userId = user?.id ?? "";
  const unread = notifs.filter((n) => !n.readBy.includes(userId));
  const read = notifs.filter((n) => n.readBy.includes(userId));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: 10 }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Bildirim yok</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Gelen bildirimler burada görünecek</Text>
          </View>
        ) : (
          <>
            {unread.length > 0 && (
              <>
                <View style={styles.groupRow}>
                  <View style={[styles.groupDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.groupLabel, { color: colors.primary }]}>OKUNMAMIŞ — {unread.length}</Text>
                </View>
                {unread.map((n) => <NotifCard key={n.id} n={n} onRead={markNotificationRead} userId={userId} />)}
              </>
            )}
            {read.length > 0 && (
              <>
                <View style={styles.groupRow}>
                  <View style={[styles.groupDot, { backgroundColor: colors.mutedForeground }]} />
                  <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>OKUNMUŞ — {read.length}</Text>
                </View>
                {read.map((n) => <NotifCard key={n.id} n={n} onRead={markNotificationRead} userId={userId} />)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  card: { padding: 14, gap: 6, borderWidth: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  senderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
