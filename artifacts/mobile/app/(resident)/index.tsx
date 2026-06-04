import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth, Site } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

/** Parse "DD.MM.YYYY" or "YYYY-MM-DD" → Date, null if unparseable */
function parseDueDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(".");
    return new Date(`${y}-${m}-${d}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw);
  return null;
}

function ActionCard({
  icon,
  label,
  sub,
  badge,
  badgeColor,
  value,
  onPress,
  accent,
  highlight,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub?: string;
  badge?: string | number;
  badgeColor?: string;
  value?: string;
  onPress: () => void;
  accent?: string;
  highlight?: boolean;
}) {
  const colors = useColors();
  const iconColor = accent ?? colors.primary;
  const bg = highlight ? "#fef3c7" : (accent ? accent + "12" : colors.card);
  const border = highlight ? "#fcd34d" : colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.muted : bg, borderRadius: 16, borderColor: border },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: iconColor + "20", borderRadius: 12 }]}>
        <Feather name={icon} size={22} color={highlight ? "#92400e" : iconColor} />
      </View>
      {badge !== undefined && (
        <View style={[styles.badge, { backgroundColor: badgeColor ?? colors.primary, borderRadius: 10 }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {value !== undefined && (
        <Text style={[styles.cardValue, { color: highlight ? "#92400e" : colors.foreground }]}>{value}</Text>
      )}
      <Text style={[styles.cardLabel, { color: highlight ? "#92400e" : colors.foreground }]}>{label}</Text>
      {sub && <Text style={[styles.cardSub, { color: highlight ? "#a16207" : colors.mutedForeground }]}>{sub}</Text>}
      <Feather name="chevron-right" size={14} color={highlight ? "#a16207" : colors.mutedForeground} style={styles.cardChevron} />
    </Pressable>
  );
}

export default function ResidentHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites } = useAuth();
  const { payments, userPayments, unreadCount, chats, refresh } = useData();
  const [site, setSite] = useState<Site | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) setSite(sites.find((s) => s.id === user.siteId) || null);
  }, [user, sites]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  // All pending user payments for this resident
  const myUPs = userPayments.filter((up) => up.userId === user?.id && up.status === "pending");

  const pendingPaymentTotal = myUPs.reduce((sum, up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return sum + (p?.amount || 0);
  }, 0);

  // Overdue: pending payments whose dueDate has already passed
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const overdueUPs = useMemo(() => {
    return myUPs.filter((up) => {
      const p = payments.find((pmt) => pmt.id === up.paymentId);
      if (!p || p.cancelledAt) return false;
      const due = parseDueDate((p as Record<string, unknown>).dueDate as string);
      return due !== null && due < today;
    });
  }, [myUPs, payments, today]);

  const overdueTotal = overdueUPs.reduce((sum, up) => {
    const p = payments.find((pmt) => pmt.id === up.paymentId);
    return sum + (p?.amount || 0);
  }, 0);

  const openChats = chats.filter((c) => c.status === "open").length;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  // For the Aidatlarım card: overdue takes red priority, pending stays yellow
  const aidatHighlight = pendingPaymentTotal > 0;
  const hasOverdue = overdueUPs.length > 0;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Merhaba,</Text>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        {site && <Text style={[styles.siteName, { color: colors.primary }]}>{site.name}</Text>}
      </View>

      {/* Unit banner */}
      {user?.unitNo && (
        <View style={[styles.unitBanner, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
          <Feather name="home" size={15} color={colors.primary} />
          <Text style={[styles.unitText, { color: colors.primary }]}>
            Daireniz: <Text style={{ fontFamily: "Inter_700Bold" }}>{user.unitNo}</Text>
          </Text>
        </View>
      )}

      {/* ── GECİKMİŞ AİDAT UYARISI ── */}
      {hasOverdue && (
        <Pressable
          onPress={() => router.push("/(resident)/payments")}
          style={[styles.overdueAlert, { borderRadius: 14 }]}
        >
          <View style={styles.overdueAlertInner}>
            <View style={styles.overdueIconWrap}>
              <Feather name="alert-triangle" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueTitle}>Gecikmiş Aidat Var!</Text>
              <Text style={styles.overdueSub}>
                {overdueUPs.length} ödeme · toplam{" "}
                <Text style={{ fontFamily: "Inter_700Bold" }}>
                  ₺{overdueTotal.toLocaleString("tr-TR")}
                </Text>
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#fff" />
          </View>
          <Text style={styles.overdueNote}>
            Hemen öde — gecikme faizi işleyebilir
          </Text>
        </Pressable>
      )}

      {/* ── BEKLEYEN (vadesi geçmemiş) uyarısı ── */}
      {!hasOverdue && pendingPaymentTotal > 0 && (
        <Pressable
          onPress={() => router.push("/(resident)/payments")}
          style={[styles.pendingAlert, { backgroundColor: "#fef3c7", borderRadius: 12 }]}
        >
          <Feather name="clock" size={15} color="#92400e" />
          <Text style={[styles.pendingAlertText, { color: "#92400e" }]}>
            {myUPs.length} bekleyen aidat — ₺{pendingPaymentTotal.toLocaleString("tr-TR")}
          </Text>
          <Feather name="chevron-right" size={14} color="#92400e" />
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Panel</Text>

      <View style={styles.grid}>
        <ActionCard
          icon="credit-card"
          label="Aidatlarım"
          value={pendingPaymentTotal > 0 ? `₺${pendingPaymentTotal.toLocaleString("tr-TR")}` : undefined}
          sub={
            hasOverdue
              ? `${overdueUPs.length} gecikmiş`
              : pendingPaymentTotal > 0
              ? "bekleyen borç"
              : "Borç yok"
          }
          highlight={aidatHighlight}
          badge={hasOverdue ? overdueUPs.length : myUPs.length > 0 ? myUPs.length : undefined}
          badgeColor={hasOverdue ? "#ef4444" : "#f59e0b"}
          onPress={() => router.push("/(resident)/payments")}
        />
        <ActionCard
          icon="bell"
          label="Bildirimler"
          sub="Duyuru ve mesajlar"
          badge={unreadCount > 0 ? unreadCount : undefined}
          onPress={() => router.push("/(resident)/notifications")}
        />
        <ActionCard
          icon="package"
          label="Kargo Bildirimi"
          sub="Güvenliğe bildir"
          onPress={() => router.push({ pathname: "/(resident)/notifications", params: { action: "cargo" } })}
          accent="#8b5cf6"
        />
        <ActionCard
          icon="volume-2"
          label="Gürültü Bildirimi"
          sub="Komşuya bildir"
          onPress={() => router.push({ pathname: "/(resident)/notifications", params: { action: "noise" } })}
          accent="#ef4444"
        />
        <ActionCard
          icon="shopping-bag"
          label="Esnaf Bul"
          sub="Hizmet & işletmeler"
          onPress={() => router.push("/(resident)/merchants")}
          accent="#f59e0b"
        />
        <ActionCard
          icon="message-circle"
          label="Sohbetlerim"
          sub={openChats > 0 ? `${openChats} açık sohbet` : "Mesajlaşma"}
          badge={openChats > 0 ? openChats : undefined}
          onPress={() => router.push("/(resident)/chats")}
          accent="#3b82f6"
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
  unitBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  unitText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // Overdue alert — kırmızı, dikkat çekici
  overdueAlert: {
    backgroundColor: "#dc2626",
    padding: 14,
    gap: 6,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  overdueAlertInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  overdueIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  overdueTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  overdueSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.9)", marginTop: 1 },
  overdueNote: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    paddingLeft: 50,
    marginTop: 2,
  },

  // Pending alert — sarı, hafif uyarı
  pendingAlert: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  pendingAlertText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Action cards
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
});
