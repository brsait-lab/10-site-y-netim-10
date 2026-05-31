import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth, User } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { LogoBadge } from "@/components/TreeLogo";

function ActionCard({
  icon,
  label,
  sub,
  badge,
  badgeColor,
  value,
  onPress,
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub?: string;
  badge?: string | number;
  badgeColor?: string;
  value?: string;
  onPress: () => void;
  accent?: string;
}) {
  const colors = useColors();
  const bg = accent ? accent + "12" : colors.card;
  const iconColor = accent ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.muted : bg, borderRadius: 16, borderColor: colors.border },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: iconColor + "20", borderRadius: 12 }]}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      {badge !== undefined && (
        <View style={[styles.badge, { backgroundColor: badgeColor ?? colors.primary, borderRadius: 10 }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {value !== undefined && (
        <Text style={[styles.cardValue, { color: colors.foreground }]}>{value}</Text>
      )}
      <Text style={[styles.cardLabel, { color: colors.foreground }]}>{label}</Text>
      {sub && <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={styles.cardChevron} />
    </Pressable>
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
  const activeResidents = siteUsers.filter((u) => u.status === "active" && u.role === "resident").length;
  const sitePayments = payments.filter((p) => p.siteId === user?.siteId);
  const siteUPs = userPayments.filter((up) => up.siteId === user?.siteId);
  const paidAmount = siteUPs
    .filter((up) => up.status === "paid")
    .reduce((sum, up) => sum + (sitePayments.find((p) => p.id === up.paymentId)?.amount || 0), 0);
  const pendingAmount = siteUPs
    .filter((up) => up.status === "pending")
    .reduce((sum, up) => sum + (sitePayments.find((p) => p.id === up.paymentId)?.amount || 0), 0);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Hoş geldiniz,</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        </View>
        <LogoBadge size={44} bgColor={colors.primary} iconColor="#fff" />
      </View>

      {pendingCount > 0 && (
        <Pressable
          onPress={() => router.push("/(admin)/users")}
          style={[styles.alertBanner, { backgroundColor: "#fef3c7", borderRadius: 12 }]}
        >
          <Feather name="clock" size={15} color="#92400e" />
          <Text style={[styles.alertText, { color: "#92400e" }]}>
            {pendingCount} kullanıcı onay bekliyor — görüntüle
          </Text>
          <Feather name="chevron-right" size={14} color="#92400e" />
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hızlı Erişim</Text>

      <View style={styles.grid}>
        <ActionCard
          icon="user-check"
          label="Kullanıcı Onayları"
          sub="Bekleyen kayıtlar"
          badge={pendingCount > 0 ? pendingCount : undefined}
          badgeColor="#f59e0b"
          onPress={() => router.push("/(admin)/users")}
          accent="#f59e0b"
        />
        <ActionCard
          icon="credit-card"
          label="Aidat Takibi"
          sub={`${sitePayments.length} kayıt`}
          onPress={() => router.push("/(admin)/payments")}
        />
        <ActionCard
          icon="trending-up"
          label="Gelir / Gider"
          value={`₺${paidAmount.toLocaleString("tr-TR")}`}
          sub={`₺${pendingAmount.toLocaleString("tr-TR")} bekliyor`}
          onPress={() => router.push("/(admin)/payments")}
          accent="#10b981"
        />
        <ActionCard
          icon="bell"
          label="Bildirim Gönder"
          sub="Tüm site / rol bazlı"
          badge={unreadCount > 0 ? unreadCount : undefined}
          onPress={() => router.push("/(admin)/notifications")}
        />
        <ActionCard
          icon="shopping-bag"
          label="Esnaf Çağır"
          sub="Hizmet talebi oluştur"
          onPress={() => router.push("/(admin)/notifications")}
          accent="#8b5cf6"
        />
        <ActionCard
          icon="bar-chart-2"
          label="Site İstatistikleri"
          sub={`${activeResidents} aktif sakin`}
          onPress={() => router.push("/(admin)/users")}
          accent="#3b82f6"
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Son Üyeler</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.border }]}>
        {siteUsers.filter((u) => u.role !== "admin").slice(0, 5).reverse().map((u, i, arr) => (
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
              { backgroundColor: u.status === "active" ? "#dcfce7" : u.status === "pending" ? "#fef3c7" : "#fee2e2", borderRadius: 20 },
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
            <Feather name="users" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz üye yok</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  alertText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "47%", flexGrow: 1, padding: 16, gap: 6, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    position: "relative",
  },
  cardIcon: { padding: 10, alignSelf: "flex-start" },
  badge: { position: "absolute", top: 12, right: 12, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  cardValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardChevron: { alignSelf: "flex-end", marginTop: 2 },
  listCard: { borderWidth: 1, overflow: "hidden" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 28, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
