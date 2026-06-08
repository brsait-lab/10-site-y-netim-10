import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useData, type UserPayment, type Payment, type Expense } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

type AdminPayTab = "aidat" | "extra" | "personal" | "pending" | "expenses" | "create";

const PAYMENT_METHODS = [
  { key: "cash", label: "Nakit" },
  { key: "bank_transfer", label: "Havale/EFT" },
  { key: "manual", label: "Manuel" },
];

const EXPENSE_CATEGORIES = [
  { key: "security", label: "Güvenlik" },
  { key: "cleaning", label: "Temizlik" },
  { key: "electricity", label: "Elektrik" },
  { key: "water", label: "Su" },
  { key: "garden", label: "Bahçe" },
  { key: "maintenance", label: "Bakım" },
  { key: "elevator", label: "Asansör" },
  { key: "management", label: "Yönetim" },
  { key: "other", label: "Diğer" },
];

function statusBadge(status: string) {
  switch (status) {
    case "paid": return { label: "Ödendi", bg: "#dcfce7", fg: "#16a34a" };
    case "pending_approval": return { label: "İnceleniyor", bg: "#dbeafe", fg: "#1d4ed8" };
    case "rejected": return { label: "Reddedildi", bg: "#fee2e2", fg: "#dc2626" };
    case "cancelled": return { label: "İptal", bg: "#f1f5f9", fg: "#64748b" };
    default: return { label: "Bekliyor", bg: "#fef9c3", fg: "#a16207" };
  }
}

function typeMeta(type: string) {
  switch (type) {
    case "aidat": return { label: "Aidat", color: "#6366f1" };
    case "extra_expense": case "gider": return { label: "Ek Gider", color: "#f59e0b" };
    case "personal_charge": return { label: "Kişisel", color: "#ec4899" };
    default: return { label: type, color: "#64748b" };
  }
}

function catLabel(cat: string) {
  return EXPENSE_CATEGORIES.find((c) => c.key === cat)?.label ?? cat;
}

export default function AdminPayments() {
  const colors = useColors();
  const { user } = useAuth();
  const {
    payments, userPayments, expenses,
    createPayment, approveUserPayment, rejectUserPayment,
    manualPayUserPayment, createExpense, deleteExpense,
  } = useData();

  const [activeTab, setActiveTab] = useState<AdminPayTab>("aidat");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [approveState, setApproveState] = useState({ open: false, upId: "", note: "" });
  const [rejectState, setRejectState] = useState({ open: false, upId: "", note: "" });
  const [manualState, setManualState] = useState({ open: false, upId: "", method: "cash", note: "" });
  const [receiptState, setReceiptState] = useState({ open: false, up: null as UserPayment | null });

  const [createType, setCreateType] = useState<"aidat" | "extra_expense" | "personal_charge">("aidat");
  const [createTitle, setCreateTitle] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "block">("all");
  const [targetBlocks, setTargetBlocks] = useState("");

  const [expForm, setExpForm] = useState({ open: false, title: "", amount: "", date: "", category: "other", description: "" });

  const siteId = user?.siteId ?? "";
  const pendingCount = userPayments.filter((up) => up.status === "pending_approval").length;
  const getRows = useCallback((pid: string) => userPayments.filter((up) => up.paymentId === pid), [userPayments]);

  const paymentsByTab = (tab: AdminPayTab): Payment[] => {
    if (tab === "aidat") return payments.filter((p) => p.type === "aidat" && !p.cancelledAt);
    if (tab === "extra") return payments.filter((p) => (p.type === "extra_expense" || p.type === "gider") && !p.cancelledAt);
    if (tab === "personal") return payments.filter((p) => p.type === "personal_charge" && !p.cancelledAt);
    return [];
  };

  const pendingApprovalRows = userPayments.filter((up) => up.status === "pending_approval");
  const activeExpenses = expenses.filter((e) => !e.cancelledAt);

  async function doApprove() {
    setLoading(true);
    try {
      await approveUserPayment(approveState.upId, approveState.note || undefined);
      setApproveState({ open: false, upId: "", note: "" });
    } catch (e: any) { Alert.alert("Hata", e?.data?.message ?? "Onaylama başarısız."); }
    finally { setLoading(false); }
  }

  async function doReject() {
    if (!rejectState.note.trim()) { Alert.alert("Not gerekli", "Reddetme sebebini yazınız."); return; }
    setLoading(true);
    try {
      await rejectUserPayment(rejectState.upId, rejectState.note);
      setRejectState({ open: false, upId: "", note: "" });
    } catch (e: any) { Alert.alert("Hata", e?.data?.message ?? "Reddetme başarısız."); }
    finally { setLoading(false); }
  }

  async function doManualPay() {
    setLoading(true);
    try {
      await manualPayUserPayment(manualState.upId, manualState.method, manualState.note || undefined);
      setManualState({ open: false, upId: "", method: "cash", note: "" });
    } catch (e: any) { Alert.alert("Hata", e?.data?.message ?? "İşlem başarısız."); }
    finally { setLoading(false); }
  }

  async function doCreatePayment() {
    if (!createTitle.trim() || !createAmount || !createDueDate.trim()) {
      Alert.alert("Eksik", "Başlık, tutar ve son tarih gereklidir."); return;
    }
    const parsed = parseFloat(createAmount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) { Alert.alert("Geçersiz tutar"); return; }
    setLoading(true);
    try {
      await createPayment({
        siteId, title: createTitle.trim(), amount: parsed,
        dueDate: createDueDate.trim(), type: createType,
        description: createDesc || undefined,
        targetBlocks: targetMode === "block" && targetBlocks.trim()
          ? targetBlocks.split(",").map((s) => s.trim()).filter(Boolean) : [],
        targetUserIds: [],
      } as any);
      setCreateTitle(""); setCreateAmount(""); setCreateDueDate(""); setCreateDesc(""); setTargetBlocks("");
      Alert.alert("Başarılı", "Ödeme oluşturuldu ve dairelere gönderildi.");
      setActiveTab("aidat");
    } catch (e: any) { Alert.alert("Hata", e?.data?.message ?? "Ödeme oluşturulamadı."); }
    finally { setLoading(false); }
  }

  async function doCreateExpense() {
    if (!expForm.title.trim() || !expForm.amount || !expForm.date.trim()) {
      Alert.alert("Eksik", "Başlık, tutar ve tarih gereklidir."); return;
    }
    setLoading(true);
    try {
      await createExpense({
        title: expForm.title.trim(), amount: parseFloat(expForm.amount.replace(",", ".")),
        date: expForm.date.trim(), category: expForm.category, description: expForm.description,
      });
      setExpForm({ open: false, title: "", amount: "", date: "", category: "other", description: "" });
    } catch (e: any) { Alert.alert("Hata", e?.data?.message ?? "Kayıt oluşturulamadı."); }
    finally { setLoading(false); }
  }

  const TABS: { key: AdminPayTab; label: string; badge?: number }[] = [
    { key: "aidat", label: "Aidat" },
    { key: "extra", label: "Ek Gider" },
    { key: "personal", label: "Kişisel" },
    { key: "pending", label: "Dekontlar", badge: pendingCount },
    { key: "expenses", label: "Gider" },
    { key: "create", label: "Oluştur" },
  ];

  const inputStyle = {
    backgroundColor: colors.muted + "40", borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 14,
    fontFamily: "Inter_400Regular" as const, marginBottom: 10,
  };

  function UnitRow({ up }: { up: UserPayment }) {
    const st = statusBadge(up.status);
    const label = up.unitKey ?? (up.userId ? `Kullanıcı …${up.userId.slice(-4)}` : "—");
    return (
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 }}>
        <Text style={{ flex: 1, color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{label}</Text>
        <View style={{ backgroundColor: st.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ color: st.fg, fontSize: 11, fontFamily: "Inter_500Medium" }}>{st.label}</Text>
        </View>
        {(up.status === "pending" || up.status === "rejected") && (
          <TouchableOpacity onPress={() => setManualState({ open: true, upId: up.id, method: "cash", note: "" })}
            style={{ backgroundColor: colors.primary + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Tahsil</Text>
          </TouchableOpacity>
        )}
        {up.status === "pending_approval" && (
          <TouchableOpacity onPress={() => setReceiptState({ open: true, up })}
            style={{ backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: "#1d4ed8", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Dekont</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function PaymentCard({ payment }: { payment: Payment }) {
    const rows = getRows(payment.id);
    const paidC = rows.filter((r) => r.status === "paid").length;
    const approvalC = rows.filter((r) => r.status === "pending_approval").length;
    const expanded = expandedId === payment.id;
    const meta = typeMeta(payment.type);
    const pct = rows.length > 0 ? (paidC / rows.length) * 100 : 0;
    const unitLabel = payment.type === "personal_charge" ? "kişi" : "daire";
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        <TouchableOpacity onPress={() => setExpandedId(expanded ? null : payment.id)} style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 }}>
            <View style={{ backgroundColor: meta.color + "18", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: meta.color, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{meta.label}</Text>
            </View>
            {approvalC > 0 && (
              <View style={{ backgroundColor: "#1d4ed8", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" }}>{approvalC} dekont</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Son Ödeme: {payment.dueDate}</Text>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, marginBottom: 6 }}>{payment.title}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
            {rows.length > 0 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                {paidC}/{rows.length} {unitLabel} ödedi
              </Text>
            )}
          </View>
          {rows.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <View style={{ height: 5, backgroundColor: colors.muted + "80", borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 5, backgroundColor: "#22c55e", borderRadius: 3, width: `${pct}%` }} />
              </View>
            </View>
          )}
        </TouchableOpacity>
        {expanded && rows.map((up) => <UnitRow key={up.id} up={up} />)}
        {expanded && rows.length === 0 && (
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 13 }}>Henüz daire kaydı oluşturulmadı.</Text>
          </View>
        )}
      </View>
    );
  }

  function PendingCard({ up }: { up: UserPayment }) {
    const payment = payments.find((p) => p.id === up.paymentId);
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#3b82f640", padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#1d4ed8", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Onay Bekliyor</Text>
          </View>
          <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
            {up.unitKey ?? `Kullanıcı …${up.userId?.slice(-4) ?? "?"}`}
          </Text>
        </View>
        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.text, fontSize: 14 }}>{payment?.title ?? "—"}</Text>
        {up.receiptUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(up.receiptUrl!)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary + "12", borderRadius: 8, padding: 10 }}>
            <Feather name="external-link" size={13} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>{up.receiptUrl}</Text>
          </TouchableOpacity>
        ) : <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Dekont linki yok.</Text>}
        {up.note ? <Text style={{ color: colors.mutedForeground, fontSize: 12, fontStyle: "italic" }}>"{up.note}"</Text> : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => setApproveState({ open: true, upId: up.id, note: "" })}
            style={{ flex: 1, backgroundColor: "#16a34a", borderRadius: 8, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>Onayla</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setRejectState({ open: true, upId: up.id, note: "" })}
            style={{ flex: 1, backgroundColor: "#dc2626", borderRadius: 8, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>Reddet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function ExpenseCard({ expense }: { expense: Expense }) {
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
          <View style={{ backgroundColor: colors.muted + "60", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{catLabel(expense.category)}</Text>
          </View>
          <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{expense.date}</Text>
          <TouchableOpacity onPress={() => Alert.alert("Sil", "Bu gider kaydını silmek istiyor musunuz?", [
            { text: "İptal", style: "cancel" },
            { text: "Sil", style: "destructive", onPress: () => deleteExpense(expense.id) },
          ])}>
            <Feather name="trash-2" size={15} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.text, fontSize: 14, marginBottom: 4 }}>{expense.title}</Text>
        {expense.description ? <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>{expense.description}</Text> : null}
        <Text style={{ color: "#dc2626", fontFamily: "Inter_700Bold", fontSize: 16 }}>₺{expense.amount.toLocaleString("tr-TR")}</Text>
      </View>
    );
  }

  const PaymentListContent = ({ tab }: { tab: AdminPayTab }) => {
    const list = paymentsByTab(tab);
    if (list.length === 0) {
      return (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <Feather name="inbox" size={38} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 14 }}>Kayıt yok.</Text>
          <TouchableOpacity onPress={() => setActiveTab("create")}
            style={{ marginTop: 14, backgroundColor: colors.primary + "18", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Yeni Oluştur</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <>{list.map((p) => <PaymentCard key={p.id} payment={p} />)}</>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.text }}>Ödeme Yönetimi</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: 12, alignItems: "center", gap: 6, flexDirection: "row" }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: active ? colors.primary : "transparent", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: active ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{t.label}</Text>
              {(t.badge ?? 0) > 0 && (
                <View style={{ backgroundColor: active ? "#ffffff50" : "#ef4444", borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" }}>{t.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {(activeTab === "aidat" || activeTab === "extra" || activeTab === "personal") && (
          <PaymentListContent tab={activeTab} />
        )}

        {activeTab === "pending" && (
          pendingApprovalRows.length === 0
            ? <View style={{ paddingTop: 60, alignItems: "center" }}>
              <Feather name="check-circle" size={38} color="#22c55e" />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 14 }}>Onay bekleyen dekont yok.</Text>
            </View>
            : pendingApprovalRows.map((up) => <PendingCard key={up.id} up={up} />)
        )}

        {activeTab === "expenses" && (
          <>
            <TouchableOpacity onPress={() => setExpForm({ open: true, title: "", amount: "", date: "", category: "other", description: "" })}
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 14, flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Gider Kalemi Ekle</Text>
            </TouchableOpacity>
            {activeExpenses.length === 0
              ? <View style={{ paddingTop: 40, alignItems: "center" }}>
                <Feather name="file-text" size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Henüz gider kaydı yok.</Text>
              </View>
              : activeExpenses.map((e) => <ExpenseCard key={e.id} expense={e} />)
            }
          </>
        )}

        {activeTab === "create" && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.text, marginBottom: 14 }}>Yeni Ödeme Oluştur</Text>

            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>Ödeme Türü</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {([
                { key: "aidat", label: "Aidat", color: "#6366f1" },
                { key: "extra_expense", label: "Ek Gider", color: "#f59e0b" },
                { key: "personal_charge", label: "Kişisel", color: "#ec4899" },
              ] as const).map((t) => {
                const sel = createType === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setCreateType(t.key)}
                    style={{ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: sel ? t.color : colors.muted + "40", borderWidth: 1, borderColor: sel ? t.color : colors.border }}>
                    <Text style={{ color: sel ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Başlık</Text>
            <TextInput style={inputStyle} placeholder="Örn: Ocak 2026 Aidatı" placeholderTextColor={colors.mutedForeground} value={createTitle} onChangeText={setCreateTitle} />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Tutar (₺)</Text>
                <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.mutedForeground} value={createAmount} onChangeText={setCreateAmount} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Son Tarih</Text>
                <TextInput style={inputStyle} placeholder="GG.AA.YYYY" placeholderTextColor={colors.mutedForeground} value={createDueDate} onChangeText={setCreateDueDate} keyboardType="numbers-and-punctuation" />
              </View>
            </View>

            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 }}>Açıklama (opsiyonel)</Text>
            <TextInput style={{ ...inputStyle, height: 80, textAlignVertical: "top" }} placeholder="Ödeme hakkında bilgi..." placeholderTextColor={colors.mutedForeground} value={createDesc} onChangeText={setCreateDesc} multiline />

            {createType !== "personal_charge" && (
              <>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>Hedefleme</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                  {([{ k: "all", l: "Tüm Site" }, { k: "block", l: "Blok Bazlı" }] as const).map((m) => (
                    <TouchableOpacity key={m.k} onPress={() => setTargetMode(m.k)}
                      style={{ flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center", backgroundColor: targetMode === m.k ? colors.primary : colors.muted + "40", borderWidth: 1, borderColor: targetMode === m.k ? colors.primary : colors.border }}>
                      <Text style={{ color: targetMode === m.k ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{m.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {targetMode === "block" && (
                  <TextInput style={inputStyle} placeholder="Blok adları virgülle (A, B, C)" placeholderTextColor={colors.mutedForeground} value={targetBlocks} onChangeText={setTargetBlocks} />
                )}
              </>
            )}

            <TouchableOpacity onPress={doCreatePayment} disabled={loading}
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Oluştur ve Gönder</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </ScrollView>

      {/* Approve Modal */}
      <Modal visible={approveState.open} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.text, marginBottom: 12 }}>Dekont Onayla</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 16 }} placeholder="Not (opsiyonel)" placeholderTextColor={colors.mutedForeground} value={approveState.note} onChangeText={(v) => setApproveState((s) => ({ ...s, note: v }))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setApproveState({ open: false, upId: "", note: "" })} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doApprove} disabled={loading} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: "#16a34a" }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Onayla</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectState.open} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.text, marginBottom: 12 }}>Dekont Reddet</Text>
            <TextInput style={{ ...inputStyle, marginBottom: 16 }} placeholder="Reddetme sebebi (zorunlu)" placeholderTextColor={colors.mutedForeground} value={rejectState.note} onChangeText={(v) => setRejectState((s) => ({ ...s, note: v }))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setRejectState({ open: false, upId: "", note: "" })} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doReject} disabled={loading} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: "#dc2626" }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Reddet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Pay Modal */}
      <Modal visible={manualState.open} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.text, marginBottom: 12 }}>Manuel Tahsilat</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity key={m.key} onPress={() => setManualState((s) => ({ ...s, method: m.key }))}
                  style={{ flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center", backgroundColor: manualState.method === m.key ? colors.primary : colors.muted + "40", borderWidth: 1, borderColor: manualState.method === m.key ? colors.primary : colors.border }}>
                  <Text style={{ color: manualState.method === m.key ? "#fff" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={{ ...inputStyle, marginBottom: 16 }} placeholder="Not (opsiyonel)" placeholderTextColor={colors.mutedForeground} value={manualState.note} onChangeText={(v) => setManualState((s) => ({ ...s, note: v }))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setManualState({ open: false, upId: "", method: "cash", note: "" })} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doManualPay} disabled={loading} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: colors.primary }}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Tahsil Et</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt View Modal */}
      <Modal visible={receiptState.open} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.text }}>Dekont İncele</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
              {receiptState.up?.unitKey ?? `Kullanıcı …${receiptState.up?.userId?.slice(-4)}`}
            </Text>
            {receiptState.up?.receiptUrl ? (
              <TouchableOpacity onPress={() => Linking.openURL(receiptState.up!.receiptUrl!)}
                style={{ backgroundColor: colors.primary + "15", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="external-link" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={2}>{receiptState.up.receiptUrl}</Text>
              </TouchableOpacity>
            ) : <Text style={{ color: colors.mutedForeground }}>Dekont URL'si yok.</Text>}
            {receiptState.up?.note ? (
              <View style={{ backgroundColor: colors.muted + "40", borderRadius: 8, padding: 10 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Not: {receiptState.up.note}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => { if (receiptState.up) setApproveState({ open: true, upId: receiptState.up.id, note: "" }); setReceiptState({ open: false, up: null }); }}
                style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: "#16a34a" }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (receiptState.up) setRejectState({ open: true, upId: receiptState.up.id, note: "" }); setReceiptState({ open: false, up: null }); }}
                style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: "#dc2626" }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Reddet</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setReceiptState({ open: false, up: null })}
              style={{ borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Expense Form Modal */}
      <Modal visible={expForm.open} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.text, marginBottom: 12 }}>Gider Kalemi Ekle</Text>
              <TextInput style={inputStyle} placeholder="Başlık" placeholderTextColor={colors.mutedForeground} value={expForm.title} onChangeText={(v) => setExpForm((s) => ({ ...s, title: v }))} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput style={{ ...inputStyle, flex: 1 }} placeholder="Tutar (₺)" placeholderTextColor={colors.mutedForeground} value={expForm.amount} onChangeText={(v) => setExpForm((s) => ({ ...s, amount: v }))} keyboardType="decimal-pad" />
                <TextInput style={{ ...inputStyle, flex: 1 }} placeholder="GG.AA.YYYY" placeholderTextColor={colors.mutedForeground} value={expForm.date} onChangeText={(v) => setExpForm((s) => ({ ...s, date: v }))} keyboardType="numbers-and-punctuation" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 6, flexDirection: "row" }}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.key} onPress={() => setExpForm((s) => ({ ...s, category: c.key }))}
                    style={{ borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: expForm.category === c.key ? colors.primary : colors.muted + "40", borderWidth: 1, borderColor: expForm.category === c.key ? colors.primary : colors.border }}>
                    <Text style={{ color: expForm.category === c.key ? "#fff" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput style={{ ...inputStyle, height: 70, textAlignVertical: "top" }} placeholder="Açıklama (opsiyonel)" placeholderTextColor={colors.mutedForeground} value={expForm.description} onChangeText={(v) => setExpForm((s) => ({ ...s, description: v }))} multiline />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <TouchableOpacity onPress={() => setExpForm((s) => ({ ...s, open: false }))} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={doCreateExpense} disabled={loading} style={{ flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: colors.primary }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold" }}>Kaydet</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
