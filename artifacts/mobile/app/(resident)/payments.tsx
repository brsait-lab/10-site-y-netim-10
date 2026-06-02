import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData, type UserPayment, type Payment, type Expense } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { getSite, type SiteDto } from "@workspace/api-client-react";

type ResidentPayTab = "pending" | "paid" | "gider" | "personal";

function statusBadge(status: string) {
  switch (status) {
    case "paid": return { label: "Ödendi", bg: "#dcfce7", fg: "#16a34a", icon: "check-circle" as const };
    case "pending_approval": return { label: "İnceleniyor", bg: "#dbeafe", fg: "#1d4ed8", icon: "clock" as const };
    case "rejected": return { label: "Reddedildi", bg: "#fee2e2", fg: "#dc2626", icon: "x-circle" as const };
    case "cancelled": return { label: "İptal", bg: "#f1f5f9", fg: "#64748b", icon: "slash" as const };
    default: return { label: "Bekliyor", bg: "#fef9c3", fg: "#a16207", icon: "alert-circle" as const };
  }
}

function typeMeta(type: string) {
  switch (type) {
    case "aidat": return { label: "Aidat", color: "#6366f1" };
    case "extra_expense": case "gider": return { label: "Ek Gider", color: "#f59e0b" };
    case "personal_charge": return { label: "Kişisel Borç", color: "#ec4899" };
    default: return { label: type, color: "#64748b" };
  }
}

const EXPENSE_CATEGORIES: Record<string, string> = {
  security: "Güvenlik", cleaning: "Temizlik", electricity: "Elektrik",
  water: "Su", garden: "Bahçe", maintenance: "Bakım",
  elevator: "Asansör", management: "Yönetim", other: "Diğer",
};

export default function ResidentPayments() {
  const colors = useColors();
  const { user } = useAuth();
  const { payments, userPayments, expenses, uploadReceipt } = useData();

  const [activeTab, setActiveTab] = useState<ResidentPayTab>("pending");
  const [site, setSite] = useState<SiteDto | null>(null);
  const [dekontModal, setDekontModal] = useState({ open: false, upId: "", receiptUrl: "", note: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.siteId) {
      getSite(user.siteId).then(setSite).catch(() => null);
    }
  }, [user?.siteId]);

  const getPayment = useCallback((paymentId: string): Payment | undefined =>
    payments.find((p) => p.id === paymentId), [payments]);

  // Filter: unit-based (aidat, gider, extra_expense) and personal_charge separately
  const unitTypes = ["aidat", "extra_expense", "gider"];

  const pendingUps = userPayments.filter(
    (up) => ["pending", "pending_approval", "rejected"].includes(up.status) && up.paymentId
      ? (payments.find((p) => p.id === up.paymentId)?.type ?? "").match(/aidat|gider|extra_expense/) !== null
      : true
  ).filter((up) => {
    const p = getPayment(up.paymentId);
    return p && (unitTypes.includes(p.type)) && !["cancelled"].includes(up.status);
  });

  const paidUps = userPayments.filter((up) => up.status === "paid").filter((up) => {
    const p = getPayment(up.paymentId);
    return p && unitTypes.includes(p.type);
  });

  const personalUps = userPayments.filter((up) => {
    const p = getPayment(up.paymentId);
    return p?.type === "personal_charge" && up.status !== "cancelled";
  });

  const activeExpenses = expenses.filter((e) => !e.cancelledAt);

  const totalDebt = pendingUps.reduce((sum, up) => {
    const p = getPayment(up.paymentId);
    return up.status !== "paid" ? sum + (p?.amount ?? 0) : sum;
  }, 0);

  const totalPaid = [...paidUps, ...userPayments.filter((up) => {
    const p = getPayment(up.paymentId);
    return p?.type === "personal_charge" && up.status === "paid";
  })].reduce((sum, up) => {
    const p = getPayment(up.paymentId);
    return sum + (p?.amount ?? 0);
  }, 0);

  async function doUploadReceipt() {
    if (!dekontModal.receiptUrl.trim()) {
      Alert.alert("Eksik", "Dekont URL'si giriniz."); return;
    }
    setLoading(true);
    try {
      await uploadReceipt(dekontModal.upId, dekontModal.receiptUrl.trim(), dekontModal.note || undefined);
      setDekontModal({ open: false, upId: "", receiptUrl: "", note: "" });
      Alert.alert("Gönderildi", "Dekontunuz onay için yöneticiye iletildi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.data?.message ?? "Dekont gönderilemedi.");
    } finally { setLoading(false); }
  }

  const TABS: { key: ResidentPayTab; label: string }[] = [
    { key: "pending", label: "Bekleyen" },
    { key: "paid", label: "Ödenmiş" },
    { key: "gider", label: "Gider Detayı" },
    { key: "personal", label: "Kişisel" },
  ];

  function PaymentCard({ up }: { up: UserPayment }) {
    const payment = getPayment(up.paymentId);
    if (!payment) return null;
    const st = statusBadge(up.status);
    const meta = typeMeta(payment.type);

    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: meta.color + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: meta.color, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{meta.label}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ backgroundColor: st.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name={st.icon} size={11} color={st.fg} />
            <Text style={{ color: st.fg, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{st.label}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text }}>{payment.title}</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Son: {payment.dueDate}</Text>
        </View>

        {up.unitKey && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="home" size={11} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Daire: {up.unitKey}</Text>
          </View>
        )}

        {up.status === "pending" && (
          <>
            {site?.iban && (
              <View style={{ backgroundColor: colors.primary + "0f", borderRadius: 10, padding: 10, gap: 2 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>Havale/EFT Bilgileri</Text>
                {site.bankName && <Text style={{ color: colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{site.bankName}</Text>}
                {site.accountHolder && <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{site.accountHolder}</Text>}
                <TouchableOpacity onPress={() => Alert.alert("IBAN Kopyalandı", site.iban ?? "")}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 1 }}>{site.iban}</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => setDekontModal({ open: true, upId: up.id, receiptUrl: "", note: "" })}
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Feather name="upload" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Dekont Yükle</Text>
            </TouchableOpacity>
          </>
        )}

        {up.status === "pending_approval" && (
          <View style={{ backgroundColor: "#dbeafe", borderRadius: 10, padding: 10, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="clock" size={13} color="#1d4ed8" />
              <Text style={{ color: "#1d4ed8", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Dekont inceleniyor</Text>
            </View>
            <Text style={{ color: "#1d4ed8", fontSize: 12 }}>Yönetici onaylamasını bekleyin. Onaylandığında ödeme tamamlanacak.</Text>
            {up.receiptUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(up.receiptUrl!)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="external-link" size={11} color="#1d4ed8" />
                <Text style={{ color: "#1d4ed8", fontSize: 11 }} numberOfLines={1}>{up.receiptUrl}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setDekontModal({ open: true, upId: up.id, receiptUrl: "", note: "" })}
              style={{ marginTop: 4, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "#1d4ed8", borderRadius: 8 }}>
              <Text style={{ color: "#1d4ed8", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Yeni Dekont Yükle</Text>
            </TouchableOpacity>
          </View>
        )}

        {up.status === "rejected" && (
          <View style={{ backgroundColor: "#fee2e2", borderRadius: 10, padding: 10, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="x-circle" size={13} color="#dc2626" />
              <Text style={{ color: "#dc2626", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Dekont Reddedildi</Text>
            </View>
            {up.note && <Text style={{ color: "#dc2626", fontSize: 12 }}>Sebep: {up.note}</Text>}
            <TouchableOpacity onPress={() => setDekontModal({ open: true, upId: up.id, receiptUrl: "", note: "" })}
              style={{ marginTop: 4, backgroundColor: "#dc2626", borderRadius: 8, paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>Yeniden Yükle</Text>
            </TouchableOpacity>
          </View>
        )}

        {up.status === "paid" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="check-circle" size={14} color="#16a34a" />
            <Text style={{ color: "#16a34a", fontSize: 12, fontFamily: "Inter_500Medium" }}>
              {up.paidAt ? `${new Date(up.paidAt).toLocaleDateString("tr-TR")} tarihinde ödendi` : "Ödendi"}
              {up.paymentMethod === "cash" ? " (Nakit)" : up.paymentMethod === "bank_transfer" ? " (Havale)" : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }

  function ExpenseRow({ expense }: { expense: Expense }) {
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <View style={{ backgroundColor: colors.muted + "60", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
              {EXPENSE_CATEGORIES[expense.category] ?? expense.category}
            </Text>
          </View>
          <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{expense.date}</Text>
        </View>
        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.text, fontSize: 14, marginBottom: 4 }}>{expense.title}</Text>
        {expense.description ? <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>{expense.description}</Text> : null}
        <Text style={{ color: "#dc2626", fontFamily: "Inter_700Bold", fontSize: 15 }}>₺{expense.amount.toLocaleString("tr-TR")}</Text>
      </View>
    );
  }

  const totalExpenses = activeExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.text }}>Ödemelerim</Text>
      </View>

      {/* Summary */}
      <View style={{ flexDirection: "row", marginHorizontal: 14, marginVertical: 8, gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: "#fee2e2", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#dc2626", fontSize: 11, fontFamily: "Inter_500Medium" }}>Toplam Borç</Text>
          <Text style={{ color: "#dc2626", fontSize: 17, fontFamily: "Inter_700Bold" }}>₺{totalDebt.toLocaleString("tr-TR")}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#dcfce7", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: "#16a34a", fontSize: 11, fontFamily: "Inter_500Medium" }}>Toplam Ödenen</Text>
          <Text style={{ color: "#16a34a", fontSize: 17, fontFamily: "Inter_700Bold" }}>₺{totalPaid.toLocaleString("tr-TR")}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 46 }} contentContainerStyle={{ paddingHorizontal: 12, alignItems: "center", gap: 6, flexDirection: "row" }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: active ? colors.primary : "transparent" }}>
              <Text style={{ color: active ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        {activeTab === "pending" && (
          pendingUps.length === 0
            ? <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="check-circle" size={40} color="#22c55e" />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 15, fontFamily: "Inter_500Medium" }}>Bekleyen ödeme yok!</Text>
            </View>
            : pendingUps.map((up) => <PaymentCard key={up.id} up={up} />)
        )}

        {activeTab === "paid" && (
          paidUps.length === 0
            ? <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="inbox" size={38} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Henüz ödeme yapılmadı.</Text>
            </View>
            : paidUps.map((up) => <PaymentCard key={up.id} up={up} />)
        )}

        {activeTab === "gider" && (
          <>
            {activeExpenses.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.text, fontSize: 14, marginBottom: 4 }}>Toplam Site Harcaması</Text>
                <Text style={{ color: "#dc2626", fontFamily: "Inter_700Bold", fontSize: 20 }}>₺{totalExpenses.toLocaleString("tr-TR")}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{activeExpenses.length} kalem</Text>
              </View>
            )}
            {activeExpenses.length === 0
              ? <View style={{ paddingTop: 40, alignItems: "center" }}>
                <Feather name="file-text" size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Henüz gider kaydı yok.</Text>
              </View>
              : activeExpenses.map((e) => <ExpenseRow key={e.id} expense={e} />)
            }
          </>
        )}

        {activeTab === "personal" && (
          personalUps.length === 0
            ? <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="user" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Kişisel borç yok.</Text>
            </View>
            : personalUps.map((up) => <PaymentCard key={up.id} up={up} />)
        )}
      </ScrollView>

      {/* Dekont Upload Modal */}
      <Modal visible={dekontModal.open} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.text }}>Dekont Yükle</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                Havale/EFT dekontunuzu Google Drive, iCloud veya başka bir platforma yükleyip bağlantısını buraya yapıştırın.
              </Text>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>Dekont Bağlantısı (URL)</Text>
                <TextInput
                  style={{ backgroundColor: colors.muted + "40", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, fontFamily: "Inter_400Regular" }}
                  placeholder="https://..."
                  placeholderTextColor={colors.mutedForeground}
                  value={dekontModal.receiptUrl}
                  onChangeText={(v) => setDekontModal((s) => ({ ...s, receiptUrl: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>Açıklama (opsiyonel)</Text>
                <TextInput
                  style={{ backgroundColor: colors.muted + "40", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, fontFamily: "Inter_400Regular", height: 70, textAlignVertical: "top" }}
                  placeholder="Ödeme hakkında not ekleyin..."
                  placeholderTextColor={colors.mutedForeground}
                  value={dekontModal.note}
                  onChangeText={(v) => setDekontModal((s) => ({ ...s, note: v }))}
                  multiline
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setDekontModal({ open: false, upId: "", receiptUrl: "", note: "" })}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doUploadReceipt} disabled={loading}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: colors.primary }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Gönder</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
