import React, { useState } from "react";
import {
  Alert,
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

function PaymentItem({ up, payment, onPay }: { up: UserPayment; payment: Payment; onPay: (id: string) => void }) {
  const colors = useColors();
  const isPaid = up.status === "paid";
  const isOverdue = !isPaid && new Date(payment.dueDate) < new Date();

  return (
    <View style={[
      styles.payCard,
      {
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderColor: isPaid ? colors.primary + "40" : isOverdue ? colors.destructive + "40" : colors.border,
        borderLeftWidth: 4,
        borderLeftColor: isPaid ? colors.primary : isOverdue ? colors.destructive : colors.warning,
      },
    ]}>
      <View style={styles.payTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.payTitle, { color: colors.foreground }]}>{payment.title}</Text>
          <Text style={[styles.payType, { color: colors.mutedForeground }]}>
            {payment.type === "aidat" ? "Aidat" : "Site Gideri"} · Son: {new Date(payment.dueDate).toLocaleDateString("tr-TR")}
          </Text>
        </View>
        <Text style={[styles.payAmount, { color: isPaid ? colors.primary : isOverdue ? colors.destructive : colors.foreground }]}>
          ₺{payment.amount.toLocaleString("tr-TR")}
        </Text>
      </View>
      {isPaid ? (
        <View style={[styles.paidBadge, { backgroundColor: "#dcfce7", borderRadius: colors.radius - 2 }]}>
          <Feather name="check-circle" size={14} color={colors.primary} />
          <Text style={[styles.paidText, { color: colors.primary }]}>
            Ödendi · {up.paidAt ? new Date(up.paidAt).toLocaleDateString("tr-TR") : ""}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => onPay(up.id)}
          style={[styles.payBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
        >
          <Feather name="credit-card" size={16} color="#fff" />
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
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const myUPs = userPayments.filter((up) => up.userId === user?.id);
  const filtered = myUPs.filter((up) => filter === "all" || up.status === filter);
  const totalDebt = myUPs.filter((up) => up.status === "pending").reduce((sum, up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return sum + (p?.amount || 0);
  }, 0);
  const totalPaid = myUPs.filter((up) => up.status === "paid").reduce((sum, up) => {
    const p = payments.find((p) => p.id === up.paymentId);
    return sum + (p?.amount || 0);
  }, 0);

  const handlePay = (upId: string) => {
    if (Platform.OS === "web") {
      payDue(upId);
      return;
    }
    Alert.alert("Ödeme Onayla", "Bu ödemeyi tamamlamak istiyor musunuz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Öde", onPress: async () => {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await payDue(upId);
        },
      },
    ]);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ödemelerim</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: "#fef3c7", borderRadius: colors.radius }]}>
            <Text style={[styles.summaryVal, { color: "#92400e" }]}>₺{totalDebt.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: "#a16207" }]}>Bekleyen Borç</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>₺{totalPaid.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Toplam Ödenen</Text>
          </View>
        </View>
        <View style={[styles.filterRow]}>
          {([["all", "Tümü"], ["pending", "Bekleyen"], ["paid", "Ödenen"]] as [string, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key as "all" | "pending" | "paid")} style={[styles.filterBtn, { borderRadius: 20, backgroundColor: filter === key ? colors.primary : colors.muted }]}>
              <Text style={[styles.filterText, { color: filter === key ? "#fff" : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="credit-card" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {filter === "pending" ? "Bekleyen ödeme yok" : filter === "paid" ? "Ödenen kayıt yok" : "Ödeme kaydı yok"}
            </Text>
          </View>
        ) : filtered.map((up) => {
          const p = payments.find((p) => p.id === up.paymentId);
          if (!p) return null;
          return <PaymentItem key={up.id} up={up} payment={p} onPay={handlePay} />;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, padding: 14, gap: 4 },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  payCard: { padding: 14, gap: 12, borderWidth: 1 },
  payTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  payTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  payType: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  payAmount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  paidText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  payBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
