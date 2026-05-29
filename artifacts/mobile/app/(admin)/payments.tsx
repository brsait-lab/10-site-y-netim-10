import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData, Payment } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function PaymentCard({ payment, userPayments }: { payment: Payment; userPayments: ReturnType<typeof useData>["userPayments"] }) {
  const colors = useColors();
  const ups = userPayments.filter((up) => up.paymentId === payment.id);
  const paid = ups.filter((up) => up.status === "paid").length;
  const total = ups.length;
  const paidAmount = paid * payment.amount;
  const progress = total > 0 ? paid / total : 0;

  return (
    <View style={[styles.payCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={styles.payCardTop}>
        <View style={[
          styles.payTypeIcon,
          { backgroundColor: payment.type === "aidat" ? colors.primaryLight : "#ede9fe", borderRadius: 10 },
        ]}>
          <Feather
            name={payment.type === "aidat" ? "home" : "tool"}
            size={18}
            color={payment.type === "aidat" ? colors.primary : "#7c3aed"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.payTitle, { color: colors.foreground }]}>{payment.title}</Text>
          <Text style={[styles.payType, { color: colors.mutedForeground }]}>
            {payment.type === "aidat" ? "Aidat" : "Site Gideri"} · Son: {new Date(payment.dueDate).toLocaleDateString("tr-TR")}
          </Text>
        </View>
        <Text style={[styles.payAmount, { color: colors.foreground }]}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
      </View>
      {total > 0 && (
        <>
          <View style={[styles.progressBar, { backgroundColor: colors.muted, borderRadius: 4 }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: colors.primary, borderRadius: 4 }]} />
          </View>
          <View style={styles.payCardBottom}>
            <Text style={[styles.payMeta, { color: colors.mutedForeground }]}>{paid}/{total} ödeme</Text>
            <Text style={[styles.payMeta, { color: colors.primary }]}>₺{paidAmount.toLocaleString("tr-TR")} toplandı</Text>
          </View>
        </>
      )}
    </View>
  );
}

export default function AdminPaymentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { payments, userPayments, createPayment } = useData();
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [payType, setPayType] = useState<"aidat" | "gider">("aidat");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const sitePayments = payments
    .filter((p) => p.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalCollected = userPayments
    .filter((up) => up.siteId === user?.siteId && up.status === "paid")
    .reduce((sum, up) => {
      const p = payments.find((p) => p.id === up.paymentId);
      return sum + (p?.amount || 0);
    }, 0);

  const handleCreate = async () => {
    if (!title.trim() || !amount || !dueDate.trim() || !user) return;
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return;
    setLoading(true);
    await createPayment({
      siteId: user.siteId,
      title: title.trim(),
      amount: amt,
      dueDate: dueDate.trim(),
      type: payType,
      description: description.trim(),
    });
    setLoading(false);
    setSuccess(true);
    setTitle(""); setAmount(""); setDueDate(""); setDescription("");
    setTimeout(() => { setSuccess(false); setActiveTab("list"); }, 2000);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ödeme Yönetimi</Text>
        <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>₺{totalCollected.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Toplam Tahsilat</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.primary + "40" }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>{sitePayments.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Toplam Talep</Text>
          </View>
        </View>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {([["list", "Listele"], ["create", "Yeni Oluştur"]] as [string, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setActiveTab(key as "list" | "create")} style={[styles.segmentBtn, { borderRadius: colors.radius - 2, backgroundColor: activeTab === key ? colors.card : "transparent" }]}>
              <Text style={[styles.segmentText, { color: activeTab === key ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "list" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {sitePayments.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="credit-card" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz ödeme talebi oluşturulmadı</Text>
              <Button title="İlk Ödemeyi Oluştur" onPress={() => setActiveTab("create")} size="sm" />
            </View>
          ) : sitePayments.map((p) => <PaymentCard key={p.id} payment={p} userPayments={userPayments} />)}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ÖDEME TÜRÜ</Text>
          <View style={styles.typeRow}>
            {([["aidat", "Aidat", "home"], ["gider", "Site Gideri", "tool"]] as [string, string, string][]).map(([key, label, icon]) => (
              <Pressable key={key} onPress={() => setPayType(key as "aidat" | "gider")} style={[styles.typeBtn, { borderRadius: colors.radius, borderColor: payType === key ? colors.primary : colors.border, backgroundColor: payType === key ? colors.primaryLight : colors.card }]}>
                <Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={payType === key ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.typeLabel, { color: payType === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.fields}>
            <Input label="Başlık *" placeholder="örn. Ocak 2025 Aidatı" value={title} onChangeText={setTitle} leftIcon="file-text" />
            <Input label="Tutar (₺) *" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="numeric" leftIcon="dollar-sign" />
            <Input label="Son Ödeme Tarihi *" placeholder="GG.AA.YYYY" value={dueDate} onChangeText={setDueDate} leftIcon="calendar" />
            <Input label="Açıklama" placeholder="İsteğe bağlı açıklama" value={description} onChangeText={setDescription} leftIcon="info" />
          </View>

          {success && (
            <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>Ödeme talebi oluşturuldu ve tüm sakinlere bildirim gönderildi!</Text>
            </View>
          )}

          <Button title="Oluştur ve Gönder" onPress={handleCreate} loading={loading} disabled={!title.trim() || !amount || !dueDate.trim()} fullWidth />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryCard: { flexDirection: "row", alignItems: "center", padding: 16 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryDivider: { width: 1, height: 40 },
  segmented: { flexDirection: "row", padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  payCard: { borderWidth: 1, padding: 14, gap: 10 },
  payCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  payTypeIcon: { padding: 10 },
  payTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  payType: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  payAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  progressBar: { height: 6, overflow: "hidden" },
  progressFill: { height: "100%" },
  payCardBottom: { flexDirection: "row", justifyContent: "space-between" },
  payMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: { flex: 1, alignItems: "center", padding: 16, gap: 8, borderWidth: 1.5 },
  typeLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fields: { gap: 14 },
  successBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12 },
  successText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
