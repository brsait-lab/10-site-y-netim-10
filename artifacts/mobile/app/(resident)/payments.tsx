import React, { useEffect, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useData, Payment, UserPayment } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type Tab = "pending" | "paid" | "gider";

function PaymentCard({ up, payment, tab, onPay }: { up: UserPayment; payment: Payment; tab: Tab; onPay: (id: string) => void }) {
  const colors = useColors();
  const isPaid = up.status === "paid";
  const isOverdue = !isPaid && new Date(payment.dueDate) < new Date();
  const accentColor = isPaid ? colors.primary : isOverdue ? colors.destructive : "#f59e0b";

  return (
    <View style={[styles.payCard, {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderColor: colors.border,
      borderLeftColor: accentColor,
      borderLeftWidth: 4,
    }]}>
      <View style={styles.payCardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.payTitle, { color: colors.foreground }]}>{payment.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={11} color={isOverdue && !isPaid ? colors.destructive : colors.mutedForeground} />
            <Text style={[styles.metaText, { color: isOverdue && !isPaid ? colors.destructive : colors.mutedForeground }]}>
              Son: {new Date(payment.dueDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
              {isOverdue && !isPaid ? "  · Gecikmiş!" : ""}
            </Text>
          </View>
          {isPaid && up.paidAt && (
            <View style={styles.metaRow}>
              <Feather name="check-circle" size={11} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.primary }]}>
                Ödendi: {new Date(up.paidAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
              </Text>
            </View>
          )}
          <View style={[styles.typePill, { backgroundColor: payment.type === "aidat" ? colors.primaryLight : "#ede9fe", borderRadius: 20, alignSelf: "flex-start" }]}>
            <Text style={[styles.typeText, { color: payment.type === "aidat" ? colors.primary : "#7c3aed" }]}>
              {payment.type === "aidat" ? "Aidat" : "Ek Gider"}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[styles.payAmount, { color: accentColor }]}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
          <View style={[styles.statusPill, {
            backgroundColor: isPaid ? "#dcfce7" : isOverdue ? "#fef2f2" : "#fef3c7",
            borderRadius: 8,
          }]}>
            <Feather name={isPaid ? "check" : "clock"} size={11} color={isPaid ? colors.primary : isOverdue ? colors.destructive : "#92400e"} />
            <Text style={[styles.statusText, { color: isPaid ? colors.primary : isOverdue ? colors.destructive : "#92400e" }]}>
              {isPaid ? "Ödendi" : isOverdue ? "Gecikmiş" : "Bekliyor"}
            </Text>
          </View>
        </View>
      </View>
      {!isPaid && (
        <Pressable onPress={() => onPay(up.id)} style={[styles.payBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}>
          <Feather name="credit-card" size={15} color="#fff" />
          <Text style={styles.payBtnText}>Şimdi Öde</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function ResidentPaymentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { payments, userPayments, payDue, refresh } = useData();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>("pending");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.tab === "paid") setTab("paid");
    else if (params.tab === "gider") setTab("gider");
  }, [params.tab]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const myUPs = userPayments.filter((up) => up.userId === user?.id);

  const pendingUPs = myUPs.filter((up) => {
    const p = payments.find((x) => x.id === up.paymentId);
    return up.status === "pending" && p?.type === "aidat";
  }).sort((a, b) => {
    const pa = payments.find((x) => x.id === a.paymentId);
    const pb = payments.find((x) => x.id === b.paymentId);
    return new Date(pa?.dueDate || 0).getTime() - new Date(pb?.dueDate || 0).getTime();
  });

  const paidUPs = myUPs.filter((up) => {
    const p = payments.find((x) => x.id === up.paymentId);
    return up.status === "paid" && p?.type === "aidat";
  }).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

  const giderUPs = myUPs.filter((up) => {
    const p = payments.find((x) => x.id === up.paymentId);
    return p?.type === "gider";
  }).sort((a, b) => {
    const pa = payments.find((x) => x.id === a.paymentId);
    const pb = payments.find((x) => x.id === b.paymentId);
    return new Date(pb?.dueDate || 0).getTime() - new Date(pa?.dueDate || 0).getTime();
  });

  const currentUPs = tab === "pending" ? pendingUPs : tab === "paid" ? paidUPs : giderUPs;

  const totalDebt = myUPs.filter((up) => up.status === "pending").reduce((s, up) => s + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);
  const totalPaid = myUPs.filter((up) => up.status === "paid").reduce((s, up) => s + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);
  const pendingGider = giderUPs.filter((up) => up.status === "pending").reduce((s, up) => s + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);

  const handlePay = (upId: string) => {
    payDue(upId);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap; count: number; badge?: string; color: string }[] = [
    { key: "pending", label: "Bekleyen",  icon: "clock",        count: pendingUPs.length, badge: totalDebt > 0 ? `₺${totalDebt.toLocaleString("tr-TR")}` : undefined, color: "#f59e0b" },
    { key: "paid",    label: "Ödenmiş",   icon: "check-circle", count: paidUPs.length,    badge: undefined, color: colors.primary },
    { key: "gider",   label: "Ek Giderler",icon: "tool",       count: giderUPs.length,   badge: pendingGider > 0 ? `₺${pendingGider.toLocaleString("tr-TR")}` : undefined, color: "#7c3aed" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ödemelerim</Text>

        <View style={styles.summaryRow}>
          {[
            { label: "Toplam Borç", value: `₺${totalDebt.toLocaleString("tr-TR")}`, bg: "#fef3c7", color: "#92400e" },
            { label: "Toplam Ödenen", value: `₺${totalPaid.toLocaleString("tr-TR")}`, bg: colors.primaryLight, color: colors.primary },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { backgroundColor: s.bg, borderRadius: 12 }]}>
              <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.summaryLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)}
              style={[styles.tabBtn, tab === t.key && { borderBottomWidth: 2, borderBottomColor: t.color }]}>
              <View style={[styles.tabIcon, { backgroundColor: tab === t.key ? t.color + "20" : colors.muted, borderRadius: 8 }]}>
                <Feather name={t.icon} size={14} color={tab === t.key ? t.color : colors.mutedForeground} />
              </View>
              <Text style={[styles.tabLabel, { color: tab === t.key ? t.color : colors.mutedForeground }]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: t.color + (tab === t.key ? "ff" : "40"), borderRadius: 10 }]}>
                  <Text style={[styles.tabBadgeText, { color: tab === t.key ? "#fff" : t.color }]}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {currentUPs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name={TABS.find((t) => t.key === tab)!.icon} size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {tab === "pending" ? "Bekleyen ödeme yok" : tab === "paid" ? "Ödeme geçmişi boş" : "Ek gider kaydı yok"}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {tab === "pending" ? "Tüm aidatlarınız ödenmiş durumda." : tab === "paid" ? "Henüz ödeme yapılmadı." : "Yönetici henüz ek gider eklemedi."}
            </Text>
          </View>
        ) : currentUPs.map((up) => {
          const p = payments.find((x) => x.id === up.paymentId);
          if (!p) return null;
          return <PaymentCard key={up.id} up={up} payment={p} tab={tab} onPay={handlePay} />;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 0, backgroundColor: "white" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  tabIcon: { padding: 5 },
  tabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  payCard: { padding: 14, gap: 12, borderWidth: 1 },
  payCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  payTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  typePill: { paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  payAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11 },
  payBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
