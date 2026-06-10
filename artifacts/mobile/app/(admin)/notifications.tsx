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
import { useData, AppNotification, NotificationType } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

const TYPE_META: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise:        { label: "Gürültü",      color: "#ef4444", icon: "volume-2" },
  cargo:        { label: "Kargo",        color: "#8b5cf6", icon: "package" },
  announcement: { label: "Genel Duyuru",color: "#3b82f6", icon: "volume-2" },
  payment:      { label: "Ödeme",        color: "#f59e0b", icon: "credit-card" },
  general:      { label: "Genel",        color: "#64748b", icon: "bell" },
  security:     { label: "Güvenlik",     color: "#ef4444", icon: "shield" },
};

const SEND_TYPES: { key: NotificationType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "announcement", label: "Genel Duyuru",    icon: "volume-2",   color: "#3b82f6" },
  { key: "payment",      label: "Ödeme Bildirimi", icon: "credit-card",color: "#8b5cf6" },
  { key: "security",     label: "Güvenlik",        icon: "shield",     color: "#ef4444" },
  { key: "general",      label: "Genel",           icon: "bell",       color: "#64748b" },
];

type Target = "all" | "resident" | "security" | "merchant";

function NotifCard({ n, userId }: { n: AppNotification; userId: string }) {
  const colors = useColors();
  const meta = TYPE_META[n.type] ?? TYPE_META.general;
  const isRead = n.readBy.includes(userId);
  const targetLabel =
    n.toRoles && n.toRoles.length > 0
      ? n.toRoles.map((r) => r === "resident" ? "Sakin" : r === "security" ? "Güvenlik" : r === "merchant" ? "Esnaf" : r).join(", ")
      : "Tüm Site";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.border, borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
      <View style={styles.cardTop}>
        <View style={[styles.catPill, { backgroundColor: meta.color + "20", borderRadius: 20 }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.catText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {new Date(n.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
        </Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{n.title}</Text>
      {n.fromName && n.type !== "noise" && (
        <View style={styles.senderRow}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.senderText, { color: colors.mutedForeground }]}>{n.fromName}</Text>
        </View>
      )}
      <Text style={[styles.cardMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{n.message}</Text>
      <View style={styles.cardFooter}>
        <View style={[styles.targetPill, { backgroundColor: colors.muted, borderRadius: 20 }]}>
          <Feather name="users" size={11} color={colors.mutedForeground} />
          <Text style={[styles.targetText, { color: colors.mutedForeground }]}>{targetLabel}</Text>
        </View>
        <Text style={[styles.readStatus, { color: isRead ? colors.primary : colors.mutedForeground }]}>
          {isRead ? "✓ Okundu" : "Yeni"}
        </Text>
      </View>
    </View>
  );
}

export default function AdminNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { notifications, sendNotification } = useData();
  const [tab, setTab] = useState<"send" | "history">("send");
  const [notifType, setNotifType] = useState<NotificationType>("announcement");
  const [target, setTarget] = useState<Target>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const siteNotifs = notifications
    .filter((n) => n.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || !user) return;
    setLoading(true);
    try {
      await sendNotification({
        type: notifType,
        title: title.trim(),
        message: message.trim(),
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toRoles: target === "all" ? [] : [target],
        toUserIds: [],
      });
      setSent(true); setTitle(""); setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      console.error("Bildirim gönderilemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          {([["send", "Gönder"], ["history", "Geçmiş"]] as [string, string][]).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k as any)}
              style={[styles.segBtn, { borderRadius: 8, backgroundColor: tab === k ? colors.card : "transparent" }]}>
              <Text style={[styles.segBtnText, { color: tab === k ? colors.foreground : colors.mutedForeground }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === "send" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM TÜRÜ</Text>
          <View style={styles.typeGrid}>
            {SEND_TYPES.map((t) => (
              <Pressable key={t.key} onPress={() => setNotifType(t.key)}
                style={[styles.typeCard, { borderRadius: 12, borderColor: notifType === t.key ? t.color : colors.border, backgroundColor: notifType === t.key ? t.color + "15" : colors.card }]}>
                <Feather name={t.icon} size={22} color={notifType === t.key ? t.color : colors.mutedForeground} />
                <Text style={[styles.typeCardLabel, { color: notifType === t.key ? t.color : colors.mutedForeground }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>HEDEF KİTLE</Text>
          <View style={styles.targetRow}>
            {([["all", "Tüm Site"], ["resident", "Sakinler"], ["security", "Güvenlik"], ["merchant", "Esnaflar"]] as [Target, string][]).map(([k, l]) => (
              <Pressable key={k} onPress={() => setTarget(k)}
                style={[styles.targetBtn, { borderRadius: 20, borderColor: target === k ? colors.primary : colors.border, backgroundColor: target === k ? colors.primaryLight : colors.card }]}>
                <Text style={[styles.targetText2, { color: target === k ? colors.primary : colors.mutedForeground }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>İÇERİK</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}>
            <TextInput style={[styles.inputTitle, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Bildirim başlığı..." placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.inputMessage, { color: colors.foreground }]} placeholder="Bildirim içeriğini yazın..."
              placeholderTextColor={colors.mutedForeground} value={message} onChangeText={setMessage} multiline textAlignVertical="top" />
          </View>

          {sent && (
            <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>Bildirim başarıyla gönderildi!</Text>
            </View>
          )}
          <Button title="Gönder" onPress={handleSend} loading={loading} disabled={!title.trim() || !message.trim()} fullWidth />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {siteNotifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Bildirim geçmişi boş</Text>
            </View>
          ) : siteNotifs.map((n) => <NotifCard key={n.id} n={n} userId={user?.id ?? ""} />)}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  segmented: { flexDirection: "row", padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47%", flexGrow: 1, padding: 14, alignItems: "center", gap: 8, borderWidth: 1.5 },
  typeCardLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  targetText2: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputBox: { borderWidth: 1, overflow: "hidden" },
  inputTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 14, borderBottomWidth: 1 },
  inputMessage: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, minHeight: 120 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { padding: 14, gap: 6, borderWidth: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  senderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  targetPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3 },
  targetText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  readStatus: { fontSize: 11, fontFamily: "Inter_500Medium" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
