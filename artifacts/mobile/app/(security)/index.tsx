import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth, Site } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function ActionCard({
  icon,
  label,
  sub,
  badge,
  badgeColor,
  onPress,
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub?: string;
  badge?: string | number;
  badgeColor?: string;
  onPress: () => void;
  accent?: string;
}) {
  const colors = useColors();
  const iconColor = accent ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.muted : (accent ? accent + "12" : colors.card), borderRadius: 16, borderColor: colors.border },
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
      <Text style={[styles.cardLabel, { color: colors.foreground }]}>{label}</Text>
      {sub && <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={styles.cardChevron} />
    </Pressable>
  );
}

export default function SecurityDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites } = useAuth();
  const { packages, unreadCount, chats, refresh, loading, loadError } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    if (user) setSite(sites.find((s) => s.id === user.siteId) || null);
  }, [user, sites]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const sitePackages = packages.filter((p) => p.siteId === user?.siteId);
  const pendingPkgs = sitePackages.filter((p) => p.status !== "delivered").length;
  const deliveredToday = sitePackages.filter((p) => {
    if (p.status !== "delivered" || !p.deliveredAt) return false;
    return new Date(p.deliveredAt).toDateString() === new Date().toDateString();
  }).length;
  const openChats = chats.filter((c) => c.status === "open").length;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (loading && packages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Yükleniyor…</Text>
      </View>
    );
  }

  if (loadError && packages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
        <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
        <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center" }}>Veriler yüklenemedi</Text>
        <Pressable onPress={onRefresh} style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Güvenlik Paneli</Text>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        {site && <Text style={[styles.siteName, { color: colors.primary }]}>{site.name}</Text>}
      </View>

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.border }]}>
        {[
          { label: "Bekleyen Kargo", value: pendingPkgs, color: "#f59e0b" },
          { label: "Bugün Teslim", value: deliveredToday, color: colors.primary },
          { label: "Toplam Kargo", value: sitePackages.length, color: "#64748b" },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hızlı Erişim</Text>

      <View style={styles.grid}>
        <ActionCard
          icon="package"
          label="Kargo Yönetimi"
          sub={`${pendingPkgs} bekliyor`}
          badge={pendingPkgs > 0 ? pendingPkgs : undefined}
          badgeColor="#f59e0b"
          onPress={() => router.push("/(security)/packages")}
          accent="#f59e0b"
        />
        <ActionCard
          icon="bell"
          label="Gelen Bildirimler"
          sub="Duyuru ve talepler"
          badge={unreadCount > 0 ? unreadCount : undefined}
          onPress={() => router.push("/(security)/notifications")}
        />
        <ActionCard
          icon="shopping-bag"
          label="Esnaf Yönlendirme"
          sub="İşletme rehberi"
          onPress={() => router.push("/(security)/merchants")}
          accent="#8b5cf6"
        />
        <ActionCard
          icon="volume-2"
          label="Site Duyuruları"
          sub="Sakinlere bildir"
          onPress={() => router.push({ pathname: "/(security)/notifications", params: { tab: "send" } })}
          accent="#3b82f6"
        />
        <ActionCard
          icon="message-circle"
          label="Sohbetler"
          sub={openChats > 0 ? `${openChats} açık` : "Mesajlaşma"}
          badge={openChats > 0 ? openChats : undefined}
          onPress={() => router.push("/(security)/chats")}
          accent="#10b981"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  siteName: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  statsRow: { flexDirection: "row", borderWidth: 1, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", padding: 14, gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
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
  cardLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardChevron: { alignSelf: "flex-end", marginTop: 2 },
});
