import React, { useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, Site } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function ResidentHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites } = useAuth();
  const { notifications, payments, userPayments, getMyNotifications, refresh } = useData();
  const [site, setSite] = useState<Site | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) setSite(sites.find((s) => s.id === user.siteId) || null);
  }, [user, sites]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const myNotifs = getMyNotifications().slice(0, 5);
  const myUPs = userPayments.filter((up) => up.userId === user?.id && up.status === "pending");
  const pendingPaymentTotal = myUPs.reduce((sum, up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return sum + (p?.amount || 0);
  }, 0);
  const paidCount = userPayments.filter((up) => up.userId === user?.id && up.status === "paid").length;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Merhaba,</Text>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        {site && <Text style={[styles.siteName, { color: colors.primary }]}>{site.name}</Text>}
      </View>

      {user?.unitNo && (
        <View style={[styles.unitBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
          <Feather name="home" size={16} color={colors.primary} />
          <Text style={[styles.unitText, { color: colors.primary }]}>Daireniz: <Text style={styles.unitBold}>{user.unitNo}</Text></Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: myUPs.length > 0 ? "#fef3c7" : colors.card, borderRadius: colors.radius, borderColor: myUPs.length > 0 ? "#fcd34d" : colors.border }]}>
          <Feather name="credit-card" size={20} color={myUPs.length > 0 ? "#92400e" : colors.primary} />
          <Text style={[styles.statValue, { color: myUPs.length > 0 ? "#92400e" : colors.foreground }]}>₺{pendingPaymentTotal.toLocaleString("tr-TR")}</Text>
          <Text style={[styles.statLabel, { color: myUPs.length > 0 ? "#a16207" : colors.mutedForeground }]}>Bekleyen Borç</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          <Feather name="check-circle" size={20} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>{paidCount}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Ödenen</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          <Feather name="bell" size={20} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>{myNotifs.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Bildirim</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Son Duyurular</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {myNotifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz bildirim yok</Text>
          </View>
        ) : myNotifs.map((n, idx) => (
          <View key={n.id} style={[styles.notifRow, idx < myNotifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.notifDot, { backgroundColor: n.type === "payment" ? "#fcd34d" : colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
              <Text style={[styles.notifMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{n.message}</Text>
              <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{new Date(n.createdAt).toLocaleDateString("tr-TR")}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  siteName: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  unitBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  unitText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  unitBold: { fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", padding: 14, gap: 6, borderWidth: 1 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, overflow: "hidden" },
  notifRow: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifMsg: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  empty: { padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
