import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, User } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { LogoBadge } from "@/components/TreeLogo";

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: keyof typeof Feather.glyphMap; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20", borderRadius: 10 }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { payments, userPayments, notifications, unreadCount, refresh } = useData();
  const [siteUsers, setSiteUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setSiteUsers(users);
  }, [user, getSiteUsers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadUsers()]);
    setRefreshing(false);
  };

  const pendingCount = siteUsers.filter((u) => u.status === "pending").length;
  const activeCount = siteUsers.filter((u) => u.status === "active" && u.role !== "admin").length;
  const sitePayments = payments.filter((p) => p.siteId === user?.siteId);
  const siteUPs = userPayments.filter((up) => up.siteId === user?.siteId);
  const paidAmount = siteUPs
    .filter((up) => up.status === "paid")
    .reduce((sum, up) => {
      const p = sitePayments.find((p) => p.id === up.paymentId);
      return sum + (p?.amount || 0);
    }, 0);
  const pendingAmount = siteUPs
    .filter((up) => up.status === "pending")
    .reduce((sum, up) => {
      const p = sitePayments.find((p) => p.id === up.paymentId);
      return sum + (p?.amount || 0);
    }, 0);
  const siteNotifications = notifications.filter((n) => n.siteId === user?.siteId);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Hoş geldiniz,</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        </View>
        <LogoBadge size={44} bgColor={colors.primary} iconColor="#fff" />
      </View>

      {pendingCount > 0 && (
        <View style={[styles.alertBanner, { backgroundColor: "#fef3c7", borderRadius: colors.radius }]}>
          <Feather name="clock" size={16} color={colors.warning} />
          <Text style={[styles.alertText, { color: "#92400e" }]}>
            {pendingCount} kullanıcı onay bekliyor
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard label="Aktif Üye" value={activeCount} icon="users" color={colors.primary} />
        <StatCard label="Bekleyen" value={pendingCount} icon="clock" color={colors.warning} />
        <StatCard label="Bildirim" value={siteNotifications.length} icon="bell" color={colors.info} />
        <StatCard label="Gelen Ödeme" value={`₺${paidAmount.toLocaleString("tr-TR")}`} icon="trending-up" color="#10b981" />
        <StatCard label="Bekleyen Ödeme" value={`₺${pendingAmount.toLocaleString("tr-TR")}`} icon="alert-circle" color={colors.destructive} />
        <StatCard label="Toplam Aidat" value={sitePayments.length} icon="file-text" color="#8b5cf6" />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Son Üyeler</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {siteUsers.filter((u) => u.role !== "admin").slice(-5).reverse().map((u, i, arr) => (
          <View key={u.id} style={[styles.userRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{u.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
              <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>
                {u.role === "resident" ? "Sakin" : u.role === "security" ? "Güvenlik" : "Esnaf"}
                {u.unitNo ? ` · Daire ${u.unitNo}` : ""}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: u.status === "active" ? "#dcfce7" : u.status === "pending" ? "#fef3c7" : "#fee2e2",
                borderRadius: 20,
              },
            ]}>
              <Text style={[
                styles.statusText,
                { color: u.status === "active" ? colors.primary : u.status === "pending" ? "#92400e" : colors.destructive },
              ]}>
                {u.status === "active" ? "Aktif" : u.status === "pending" ? "Bekliyor" : "Reddedildi"}
              </Text>
            </View>
          </View>
        ))}
        {siteUsers.filter((u) => u.role !== "admin").length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz üye yok</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "31%",
    flexGrow: 1,
    padding: 14,
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: { padding: 8 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, overflow: "hidden" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
