import React, { useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useData, Payment, UserPayment } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type FilterTab = "aidat" | "gider";
type StatusFilter = "all" | "pending" | "paid";

function SummaryRow({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  const colors = useColors();
  return (
    <View style={[summaryStyles.card, { backgroundColor: bg, borderRadius: colors.radius }]}>
      <Text style={[summaryStyles.val, { color }]}>{value}</Text>
      <Text style={[summaryStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  val: { fontSize: 18, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

function PaymentRow({ up, payment, onPay }: { up: UserPayment; payment: Payment; onPay: (id: string) => void }) {
  const colors = useColors();
  const isPaid = up.status === "paid";
  const isOverdue = !isPaid && new Date(payment.dueDate) < new Date();

  const leftColor = isPaid ? colors.primary : isOverdue ? colors.destructive : "#f59e0b";

  return (
    <View
      style={[
        styles.payRow,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
          borderLeftColor: leftColor,
          borderLeftWidth: 4,
        },
      ]}
    >
      <View style={styles.payRowTop}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.payTitle, { color: colors.foreground }]}>{payment.title}</Text>
          <View style={styles.payMeta}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={[styles.payMetaText, { color: isOverdue && !isPaid ? colors.destructive : colors.mutedForeground }]}>
              Son: {new Date(payment.dueDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
              {isOverdue && !isPaid ? " · Gecikmiş!" : ""}
            </Text>
          </View>
          {isPaid && up.paidAt ? (
            <View style={styles.payMeta}>
              <Feather name="check-circle" size={11} color={colors.primary} />
              <Text style={[styles.payMetaText, { color: colors.primary }]}>
                Ödendi: {new Date(up.paidAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.payRight}>
          <Text style={[styles.payAmount, { color: isPaid ? colors.primary : isOverdue ? colors.destructive : colors.foreground }]}>
            ₺{payment.amount.toLocaleString("tr-TR")}
          </Text>
          {isPaid ? (
            <View style={[styles.paidTag, { backgroundColor: "#dcfce7", borderRadius: 8 }]}>
              <Feather name="check" size={11} color={colors.primary} />
              <Text style={[styles.paidTagText, { color: colors.primary }]}>Ödendi</Text>
            </View>
          ) : (
            <View style={[styles.paidTag, { backgroundColor: isOverdue ? "#fef2f2" : "#fef3c7", borderRadius: 8 }]}>
              <Feather name="clock" size={11} color={isOverdue ? colors.destructive : "#92400e"} />
              <Text style={[styles.paidTagText, { color: isOverdue ? colors.destructive : "#92400e" }]}>
                {isOverdue ? "Gecikmiş" : "Bekliyor"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {!isPaid && (
        <Pressable
          onPress={() => onPay(up.id)}
          style={[styles.payBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
        >
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
  const [tabFilter, setTabFilter] = useState<FilterTab>("aidat");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const myUPs = userPayments.filter((up) => up.userId === user?.id);

  const aidatUPs = myUPs.filter((up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return p?.type === "aidat";
  });
  const giderUPs = myUPs.filter((up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return p?.type === "gider";
  });

  const currentUPs = tabFilter === "aidat" ? aidatUPs : giderUPs;

  const filteredUPs = currentUPs.filter((up) => {
    if (statusFilter === "pending") return up.status === "pending";
    if (statusFilter === "paid") return up.status === "paid";
    return true;
  }).sort((a, b) => {
    const pa = payments.find((p) => p.id === a.paymentId);
    const pb = payments.find((p) => p.id === b.paymentId);
    return new Date(pb?.dueDate || 0).getTime() - new Date(pa?.dueDate || 0).getTime();
  });

  const totalDebt = myUPs.filter((up) => up.status === "pending").reduce((sum, up) => {
    return sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0);
  }, 0);
  const totalPaid = myUPs.filter((up) => up.status === "paid").reduce((sum, up) => {
    return sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0);
  }, 0);
  const aidatDebt = aidatUPs.filter((up) => up.status === "pending").reduce((sum, up) => {
    return sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0);
  }, 0);
  const giderDebt = giderUPs.filter((up) => up.status === "pending").reduce((sum, up) => {
    return sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0);
  }, 0);

  const handlePay = (upId: string) => {
    if (Platform.OS === "web") {
      payDue(upId);
      return;
    }
    payDue(upId);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ödemelerim</Text>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <SummaryRow label="Toplam Borç" value={`₺${totalDebt.toLocaleString("tr-TR")}`} color="#92400e" bg="#fef3c7" />
          <SummaryRow label="Ödenen" value={`₺${totalPaid.toLocaleString("tr-TR")}`} color={colors.primary} bg={colors.primaryLight} />
        </View>

        {/* Aidat / Gider Tabs */}
        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => { setTabFilter("aidat"); setStatusFilter("all"); }}
            style={[styles.tabBtn, tabFilter === "aidat" && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <View style={[styles.tabIcon, { backgroundColor: tabFilter === "aidat" ? colors.primaryLight : colors.muted, borderRadius: 8 }]}>
              <Feather name="home" size={14} color={tabFilter === "aidat" ? colors.primary : colors.mutedForeground} />
            </View>
            <Text style={[styles.tabLabel, { color: tabFilter === "aidat" ? colors.primary : colors.mutedForeground }]}>Aidat</Text>
            {aidatDebt > 0 ? (
              <View style={[styles.debtDot, { backgroundColor: colors.destructive }]}>
                <Text style={styles.debtDotText}>₺{aidatDebt.toLocaleString("tr-TR")}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => { setTabFilter("gider"); setStatusFilter("all"); }}
            style={[styles.tabBtn, tabFilter === "gider" && [styles.tabBtnActive, { borderBottomColor: "#7c3aed" }]]}
          >
            <View style={[styles.tabIcon, { backgroundColor: tabFilter === "gider" ? "#ede9fe" : colors.muted, borderRadius: 8 }]}>
              <Feather name="tool" size={14} color={tabFilter === "gider" ? "#7c3aed" : colors.mutedForeground} />
            </View>
            <Text style={[styles.tabLabel, { color: tabFilter === "gider" ? "#7c3aed" : colors.mutedForeground }]}>Ek Giderler</Text>
            {giderDebt > 0 ? (
              <View style={[styles.debtDot, { backgroundColor: "#ef4444" }]}>
                <Text style={styles.debtDotText}>₺{giderDebt.toLocaleString("tr-TR")}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Status filter pills */}
        <View style={styles.filterRow}>
          {([["all", "Tümü"], ["pending", "Bekleyen"], ["paid", "Ödenen"]] as [StatusFilter, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setStatusFilter(key)}
              style={[styles.filterBtn, { borderRadius: 20, backgroundColor: statusFilter === key ? (tabFilter === "aidat" ? colors.primary : "#7c3aed") : colors.muted }]}
            >
              <Text style={[styles.filterText, { color: statusFilter === key ? "#fff" : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredUPs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name={tabFilter === "aidat" ? "home" : "tool"} size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {statusFilter === "pending" ? "Bekleyen ödeme yok" : statusFilter === "paid" ? "Ödenen kayıt yok" : `${tabFilter === "aidat" ? "Aidat" : "Ek gider"} kaydı yok`}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {statusFilter === "all" ? "Yönetici henüz ödeme talebi oluşturmadı." : "Farklı filtre deneyin."}
            </Text>
          </View>
        ) : filteredUPs.map((up) => {
          const p = payments.find((p) => p.id === up.paymentId);
          if (!p) return null;
          return <PaymentRow key={up.id} up={up} payment={p} onPay={handlePay} />;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 0 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryRow: { flexDirection: "row", gap: 10 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2 },
  tabIcon: { padding: 5 },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  debtDot: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  debtDotText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  filterRow: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  payRow: { padding: 14, gap: 12, borderWidth: 1 },
  payRowTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  payTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  payMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  payMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  payRight: { alignItems: "flex-end", gap: 5 },
  payAmount: { fontSize: 17, fontFamily: "Inter_700Bold" },
  paidTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  paidTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11 },
  payBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { paddingTop: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
