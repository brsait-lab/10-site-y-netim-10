import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData, AppNotification } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const TYPE_INFO: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise: { label: "Gürültü", color: "#ef4444", icon: "volume-2" },
  cargo: { label: "Kargo", color: "#8b5cf6", icon: "package" },
  package: { label: "Paket", color: "#8b5cf6", icon: "package" },
  announcement: { label: "Duyuru", color: "#3b82f6", icon: "volume-2" },
  payment: { label: "Ödeme", color: "#f59e0b", icon: "credit-card" },
  general: { label: "Genel", color: "#64748b", icon: "bell" },
  security: { label: "Güvenlik", color: "#ef4444", icon: "shield" },
};

function NotifItem({ notif, onRead, userId }: { notif: AppNotification; onRead: (id: string) => void; userId: string }) {
  const colors = useColors();
  const isRead = notif.readBy.includes(userId);
  const info = TYPE_INFO[notif.type] || TYPE_INFO.general;

  return (
    <Pressable
      onPress={() => { if (!isRead) onRead(notif.id); }}
      style={[styles.notifCard, { backgroundColor: isRead ? colors.card : colors.primaryLight + "50", borderRadius: colors.radius, borderColor: isRead ? colors.border : colors.primary + "40" }]}
    >
      <View style={[styles.notifIcon, { backgroundColor: info.color + "20", borderRadius: 10 }]}>
        <Feather name={info.icon} size={18} color={info.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
          {!isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
        <Text style={[styles.notifMsg, { color: colors.mutedForeground }]}>{notif.message}</Text>
        <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{new Date(notif.createdAt).toLocaleDateString("tr-TR")} · {info.label}</Text>
      </View>
    </Pressable>
  );
}

export default function SecurityNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getMyNotifications, markNotificationRead, unreadCount } = useData();
  const notifs = getMyNotifications();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
          {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: 10 }]}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz bildirim yok</Text>
          </View>
        ) : notifs.map((n) => <NotifItem key={n.id} notif={n} onRead={markNotificationRead} userId={user?.id || ""} />)}
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
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  notifCard: { flexDirection: "row", gap: 12, padding: 14, borderWidth: 1 },
  notifIcon: { padding: 10, alignSelf: "flex-start" },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMsg: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
