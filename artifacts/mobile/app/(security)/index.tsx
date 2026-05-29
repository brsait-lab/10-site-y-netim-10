import React, { useCallback, useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, Site } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function SecurityDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites } = useAuth();
  const { packages, notifications, getMyNotifications, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    if (user) setSite(sites.find((s) => s.id === user.siteId) || null);
  }, [user, sites]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const sitePackages = packages.filter((p) => p.siteId === user?.siteId);
  const pendingPkgs = sitePackages.filter((p) => p.status !== "delivered");
  const deliveredToday = sitePackages.filter((p) => {
    if (p.status !== "delivered" || !p.deliveredAt) return false;
    const today = new Date().toDateString();
    return new Date(p.deliveredAt).toDateString() === today;
  });
  const myNotifs = getMyNotifications().slice(0, 4);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Güvenlik Paneli</Text>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        {site && <Text style={[styles.siteName, { color: colors.primary }]}>{site.name}</Text>}
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: "Bekleyen Kargo", value: pendingPkgs.length, icon: "package" as const, color: colors.warning },
          { label: "Bugün Teslim", value: deliveredToday.length, icon: "check-circle" as const, color: colors.primary },
          { label: "Bildirim", value: myNotifs.length, icon: "bell" as const, color: colors.info },
          { label: "Toplam Kargo", value: sitePackages.length, icon: "archive" as const, color: "#64748b" },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + "20", borderRadius: 10 }]}>
              <Feather name={stat.icon} size={20} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bekleyen Kargolar</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {pendingPkgs.slice(0, 5).length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Bekleyen kargo yok</Text>
          </View>
        ) : pendingPkgs.slice(0, 5).map((pkg, idx, arr) => (
          <View key={pkg.id} style={[styles.pkgRow, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.pkgIcon, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
              <Feather name="package" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pkgName, { color: colors.foreground }]}>{pkg.recipientName}</Text>
              <Text style={[styles.pkgSender, { color: colors.mutedForeground }]} numberOfLines={1}>{pkg.senderInfo}</Text>
            </View>
            <View style={[
              styles.statusPill,
              {
                backgroundColor: pkg.status === "received" ? "#fef3c7" : "#dbeafe",
                borderRadius: 10,
              },
            ]}>
              <Text style={[styles.statusText, { color: pkg.status === "received" ? "#92400e" : "#1e40af" }]}>
                {pkg.status === "received" ? "Alındı" : "Bildirildi"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {myNotifs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Son Bildirimler</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            {myNotifs.map((n, idx) => (
              <View key={n.id} style={[styles.notifRow, idx < myNotifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.notifDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>{n.title}</Text>
                  <Text style={[styles.notifMsg, { color: colors.mutedForeground }]} numberOfLines={1}>{n.message}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  siteName: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", flexGrow: 1, padding: 14, gap: 8, alignItems: "center", borderWidth: 1 },
  statIcon: { padding: 8 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, overflow: "hidden" },
  pkgRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  pkgIcon: { padding: 10 },
  pkgName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pkgSender: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  notifDot: { width: 8, height: 8, borderRadius: 4 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifMsg: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
