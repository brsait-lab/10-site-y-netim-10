import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, User } from "@/context/AuthContext";
import { useData, Payment, UserPayment } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ActiveTab = "aidat" | "gider" | "create";

function ProgressBar({ value, color }: { value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={[pbStyles.bar, { backgroundColor: colors.muted }]}>
      <View style={[pbStyles.fill, { width: `${Math.round(value * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pbStyles = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

function PaymentCard({
  payment,
  userPayments,
  residents,
}: {
  payment: Payment;
  userPayments: UserPayment[];
  residents: User[];
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const ups = userPayments.filter((up) => up.paymentId === payment.id);
  const paidUPs = ups.filter((up) => up.status === "paid");
  const pendingUPs = ups.filter((up) => up.status === "pending");
  const progress = ups.length > 0 ? paidUPs.length / ups.length : 0;
  const collected = paidUPs.reduce((s) => s + payment.amount, 0);
  const expected = ups.length * payment.amount;
  const isAidat = payment.type === "aidat";
  const accent = isAidat ? colors.primary : "#7c3aed";
  const accentLight = isAidat ? colors.primaryLight : "#ede9fe";
  const isOverdue = new Date(payment.dueDate) < new Date();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      {/* Card Header */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: accentLight, borderRadius: 10 }]}>
          <Feather name={isAidat ? "home" : "tool"} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{payment.title}</Text>
          <View style={styles.cardMetaRow}>
            <View style={[styles.typePill, { backgroundColor: accentLight, borderRadius: 6 }]}>
              <Text style={[styles.typePillText, { color: accent }]}>{isAidat ? "Aidat" : "Ek Gider"}</Text>
            </View>
            <Feather name="calendar" size={11} color={isOverdue ? colors.destructive : colors.mutedForeground} />
            <Text style={[styles.cardDate, { color: isOverdue ? colors.destructive : colors.mutedForeground }]}>
              {new Date(payment.dueDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
              {isOverdue ? " · Sona Erdi" : ""}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardAmount, { color: colors.foreground }]}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {/* Progress */}
      {ups.length > 0 && (
        <View style={[styles.progressSection, { borderTopColor: colors.border }]}>
          <ProgressBar value={progress} color={accent} />
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
              {paidUPs.length}/{ups.length} sakin ödedi
            </Text>
            <Text style={[styles.progressLabel, { color: accent }]}>
              ₺{collected.toLocaleString("tr-TR")} / ₺{expected.toLocaleString("tr-TR")}
            </Text>
          </View>
        </View>
      )}

      {/* Resident Detail (expanded) */}
      {expanded && ups.length > 0 && (
        <View style={[styles.residentList, { borderTopColor: colors.border }]}>
          <View style={styles.residentListHeader}>
            <Text style={[styles.residentListTitle, { color: colors.mutedForeground }]}>SAKİN DURUMU</Text>
            <View style={styles.residentListLegend}>
              <View style={[styles.legendDot, { backgroundColor: accent }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Ödedi</Text>
              <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
              <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Bekliyor</Text>
            </View>
          </View>

          {/* Paid residents */}
          {paidUPs.length > 0 && (
            <View style={styles.residentGroup}>
              <Text style={[styles.groupLabel, { color: colors.primary }]}>✓ Ödeyenler ({paidUPs.length})</Text>
              {paidUPs.map((up) => {
                const r = residents.find((u) => u.id === up.userId);
                return (
                  <View key={up.id} style={[styles.residentRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.residentAvatar, { backgroundColor: "#dcfce7", borderRadius: 14 }]}>
                      <Text style={[styles.residentAvatarText, { color: colors.primary }]}>
                        {(r?.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.residentName, { color: colors.foreground }]}>{r?.name || "Bilinmiyor"}</Text>
                      {r?.unitNo ? (
                        <Text style={[styles.residentUnit, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text>
                      ) : null}
                    </View>
                    <View style={styles.residentRight}>
                      <Text style={[styles.residentAmount, { color: colors.primary }]}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
                      {up.paidAt ? (
                        <Text style={[styles.residentDate, { color: colors.mutedForeground }]}>
                          {new Date(up.paidAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Pending residents */}
          {pendingUPs.length > 0 && (
            <View style={styles.residentGroup}>
              <Text style={[styles.groupLabel, { color: "#92400e" }]}>⏳ Bekleyenler ({pendingUPs.length})</Text>
              {pendingUPs.map((up) => {
                const r = residents.find((u) => u.id === up.userId);
                return (
                  <View key={up.id} style={[styles.residentRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.residentAvatar, { backgroundColor: "#fef3c7", borderRadius: 14 }]}>
                      <Text style={[styles.residentAvatarText, { color: "#92400e" }]}>
                        {(r?.name || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.residentName, { color: colors.foreground }]}>{r?.name || "Bilinmiyor"}</Text>
                      {r?.unitNo ? (
                        <Text style={[styles.residentUnit, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text>
                      ) : null}
                    </View>
                    <View style={styles.residentRight}>
                      <Text style={[styles.residentAmount, { color: "#92400e" }]}>₺{payment.amount.toLocaleString("tr-TR")}</Text>
                      <Text style={[styles.residentDate, { color: "#92400e" }]}>Bekliyor</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminPaymentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { payments, userPayments, createPayment } = useData();
  const [activeTab, setActiveTab] = useState<ActiveTab>("aidat");
  const [payType, setPayType] = useState<"aidat" | "gider">("aidat");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [residents, setResidents] = useState<User[]>([]);

  const loadResidents = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active"));
  }, [user, getSiteUsers]);

  useEffect(() => { loadResidents(); }, [loadResidents]);

  const sitePayments = payments
    .filter((p) => p.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const aidatPayments = sitePayments.filter((p) => p.type === "aidat");
  const giderPayments = sitePayments.filter((p) => p.type === "gider");

  const totalCollected = userPayments
    .filter((up) => up.siteId === user?.siteId && up.status === "paid")
    .reduce((sum, up) => sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);

  const aidatCollected = userPayments
    .filter((up) => {
      const p = payments.find((p) => p.id === up.paymentId);
      return up.siteId === user?.siteId && up.status === "paid" && p?.type === "aidat";
    })
    .reduce((sum, up) => sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);

  const giderCollected = userPayments
    .filter((up) => {
      const p = payments.find((p) => p.id === up.paymentId);
      return up.siteId === user?.siteId && up.status === "paid" && p?.type === "gider";
    })
    .reduce((sum, up) => sum + (payments.find((p) => p.id === up.paymentId)?.amount || 0), 0);

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
    setTimeout(() => { setSuccess(false); setActiveTab(payType); }, 2200);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const displayPayments = activeTab === "aidat" ? aidatPayments : activeTab === "gider" ? giderPayments : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ödeme Yönetimi</Text>

        {/* Summary */}
        <View style={[styles.summaryBox, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>₺{totalCollected.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Toplam Tahsilat</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.primary + "40" }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: colors.primary }]}>₺{aidatCollected.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Aidat</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.primary + "40" }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: "#7c3aed" }]}>₺{giderCollected.toLocaleString("tr-TR")}</Text>
            <Text style={[styles.summaryLabel, { color: "#7c3aed" }]}>Ek Gider</Text>
          </View>
        </View>

        {/* Tab navigation */}
        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          {([
            ["aidat", "Aidat", "home", colors.primary, colors.primaryLight, aidatPayments.length],
            ["gider", "Ek Giderler", "tool", "#7c3aed", "#ede9fe", giderPayments.length],
            ["create", "Yeni Oluştur", "plus-circle", colors.foreground, colors.muted, null],
          ] as [ActiveTab, string, string, string, string, number | null][]).map(([key, label, icon, accent, accentLight, count]) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              style={[styles.tabBtn, activeTab === key && [styles.tabBtnActive, { borderBottomColor: accent }]]}
            >
              <Feather name={icon as any} size={14} color={activeTab === key ? accent : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: activeTab === key ? accent : colors.mutedForeground }]}>{label}</Text>
              {count !== null && count > 0 ? (
                <View style={[styles.countBadge, { backgroundColor: accentLight, borderRadius: 8 }]}>
                  <Text style={[styles.countText, { color: accent }]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab !== "create" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {displayPayments.length === 0 ? (
            <View style={styles.empty}>
              <Feather name={activeTab === "aidat" ? "home" : "tool"} size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {activeTab === "aidat" ? "Aidat talebi yok" : "Ek gider talebi yok"}
              </Text>
              <Button
                title={activeTab === "aidat" ? "Aidat Oluştur" : "Ek Gider Oluştur"}
                onPress={() => { setPayType(activeTab as "aidat" | "gider"); setActiveTab("create"); }}
                size="sm"
              />
            </View>
          ) : displayPayments.map((p) => (
            <PaymentCard key={p.id} payment={p} userPayments={userPayments} residents={residents} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.createCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ÖDEME TÜRÜ</Text>
            <View style={styles.typeRow}>
              {([
                ["aidat", "Aidat", "home", colors.primary, colors.primaryLight],
                ["gider", "Ek Gider", "tool", "#7c3aed", "#ede9fe"],
              ] as [string, string, string, string, string][]).map(([key, label, icon, accent, accentLight]) => (
                <Pressable
                  key={key}
                  onPress={() => setPayType(key as "aidat" | "gider")}
                  style={[
                    styles.typeBtn,
                    {
                      borderRadius: colors.radius,
                      borderColor: payType === key ? accent : colors.border,
                      backgroundColor: payType === key ? accentLight : colors.background,
                    },
                  ]}
                >
                  <View style={[styles.typeBtnIcon, { backgroundColor: payType === key ? accent : colors.muted, borderRadius: 10 }]}>
                    <Feather name={icon as any} size={18} color={payType === key ? "#fff" : colors.mutedForeground} />
                  </View>
                  <Text style={[styles.typeBtnLabel, { color: payType === key ? accent : colors.mutedForeground }]}>{label}</Text>
                  {payType === key ? (
                    <View style={[styles.typeCheck, { backgroundColor: accent, borderRadius: 10 }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>

            <View style={styles.fields}>
              <Input label="Başlık *" placeholder={payType === "aidat" ? "örn. Haziran 2025 Aidatı" : "örn. Asansör Bakım Gideri"} value={title} onChangeText={setTitle} leftIcon="file-text" />
              <Input label="Tutar (₺) *" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="numeric" leftIcon="dollar-sign" />
              <Input label="Son Ödeme Tarihi *" placeholder="GG.AA.YYYY" value={dueDate} onChangeText={setDueDate} leftIcon="calendar" />
              <Input label="Açıklama" placeholder="İsteğe bağlı not veya açıklama" value={description} onChangeText={setDescription} leftIcon="info" />
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>
                Oluşturulduğunda siteye kayıtlı tüm aktif sakinlere otomatik bildirim gönderilecek.
              </Text>
            </View>

            {success ? (
              <View style={[styles.successBanner, { backgroundColor: "#dcfce7", borderRadius: colors.radius, borderColor: "#86efac" }]}>
                <Feather name="check-circle" size={18} color={colors.primary} />
                <View>
                  <Text style={[styles.successTitle, { color: colors.primary }]}>Ödeme talebi oluşturuldu!</Text>
                  <Text style={[styles.successSub, { color: colors.primary }]}>Sakinlere bildirim gönderildi.</Text>
                </View>
              </View>
            ) : null}

            <Button
              title="Oluştur ve Gönder"
              onPress={handleCreate}
              loading={loading}
              disabled={!title.trim() || !amount || !dueDate.trim()}
              fullWidth
            />
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 0 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryBox: { flexDirection: "row", alignItems: "center", padding: 16 },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryDivider: { width: 1, height: 36 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11 },
  tabBtnActive: { borderBottomWidth: 2 },
  tabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  cardIcon: { padding: 10 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  typePill: { paddingHorizontal: 7, paddingVertical: 2 },
  typePillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardRight: { alignItems: "flex-end", gap: 5 },
  cardAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  progressSection: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, gap: 6 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  residentList: { borderTopWidth: 1 },
  residentListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  residentListTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  residentListLegend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  residentGroup: { paddingHorizontal: 14, paddingBottom: 8, gap: 2 },
  groupLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", paddingVertical: 6 },
  residentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  residentAvatar: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  residentAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  residentName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  residentUnit: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  residentRight: { alignItems: "flex-end" },
  residentAmount: { fontSize: 13, fontFamily: "Inter_700Bold" },
  residentDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  createCard: { borderWidth: 1, padding: 16, gap: 16 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: { flex: 1, alignItems: "center", paddingVertical: 16, gap: 8, borderWidth: 1.5, position: "relative" },
  typeBtnIcon: { padding: 10 },
  typeBtnLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  typeCheck: { position: "absolute", top: 8, right: 8, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  fields: { gap: 14 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  successTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  successSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
