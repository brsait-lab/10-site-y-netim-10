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

type TargetType = "all" | "role" | "resident" | "security" | "merchant";

const TYPE_OPTIONS: { key: NotificationType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "announcement", label: "Genel Duyuru", icon: "volume-2", color: "#3b82f6" },
  { key: "payment", label: "Ödeme Bildirimi", icon: "credit-card", color: "#8b5cf6" },
  { key: "security", label: "Güvenlik", icon: "shield", color: "#ef4444" },
  { key: "general", label: "Genel", icon: "bell", color: "#64748b" },
];

function NotifCard({ notif }: { notif: AppNotification }) {
  const colors = useColors();
  const typeInfo = TYPE_OPTIONS.find((t) => t.key === notif.type) || TYPE_OPTIONS[3];
  const targetLabel =
    notif.toRoles && notif.toRoles.length > 0
      ? notif.toRoles.map((r) => r === "resident" ? "Sakin" : r === "security" ? "Güvenlik" : r === "merchant" ? "Esnaf" : r).join(", ")
      : "Tüm Site";

  return (
    <View style={[styles.notifCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={[styles.notifIcon, { backgroundColor: typeInfo.color + "20", borderRadius: 10 }]}>
        <Feather name={typeInfo.icon} size={18} color={typeInfo.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
        <Text style={[styles.notifMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{notif.message}</Text>
        <View style={styles.notifMeta}>
          <Feather name="users" size={11} color={colors.mutedForeground} />
          <Text style={[styles.notifMetaText, { color: colors.mutedForeground }]}>{targetLabel}</Text>
          <Text style={[styles.notifMetaText, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.notifMetaText, { color: colors.mutedForeground }]}>
            {new Date(notif.createdAt).toLocaleDateString("tr-TR")}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { notifications, sendNotification } = useData();
  const [activeTab, setActiveTab] = useState<"send" | "history">("send");
  const [notifType, setNotifType] = useState<NotificationType>("announcement");
  const [target, setTarget] = useState<TargetType>("all");
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
    setLoading(false);
    setSent(true);
    setTitle("");
    setMessage("");
    setTimeout(() => setSent(false), 3000);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[{ flex: 1, backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {([["send", "Gönder"], ["history", "Geçmiş"]] as [string, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key as "send" | "history")}
              style={[
                styles.segmentBtn,
                { borderRadius: colors.radius - 2, backgroundColor: activeTab === key ? colors.card : "transparent" },
              ]}
            >
              <Text style={[styles.segmentText, { color: activeTab === key ? colors.foreground : colors.mutedForeground }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "send" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM TÜRÜ</Text>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setNotifType(t.key)}
                style={[
                  styles.typeCard,
                  {
                    borderRadius: colors.radius,
                    borderColor: notifType === t.key ? t.color : colors.border,
                    backgroundColor: notifType === t.key ? t.color + "15" : colors.card,
                  },
                ]}
              >
                <Feather name={t.icon} size={20} color={notifType === t.key ? t.color : colors.mutedForeground} />
                <Text style={[styles.typeLabel, { color: notifType === t.key ? t.color : colors.mutedForeground }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>HEDEF KİTLE</Text>
          <View style={styles.targetRow}>
            {([
              ["all", "Tüm Site"],
              ["resident", "Sakinler"],
              ["security", "Güvenlik"],
              ["merchant", "Esnaflar"],
            ] as [TargetType, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setTarget(key)}
                style={[
                  styles.targetBtn,
                  {
                    borderRadius: 20,
                    borderColor: target === key ? colors.primary : colors.border,
                    backgroundColor: target === key ? colors.primaryLight : colors.card,
                  },
                ]}
              >
                <Text style={[styles.targetText, { color: target === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM İÇERİĞİ</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <TextInput
              style={[styles.inputTitle, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Bildirim başlığı..."
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.inputMessage, { color: colors.foreground }]}
              placeholder="Bildirim içeriğini yazın..."
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />
          </View>

          {sent && (
            <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>Bildirim başarıyla gönderildi!</Text>
            </View>
          )}

          <Button
            title="Gönder"
            onPress={handleSend}
            loading={loading}
            disabled={!title.trim() || !message.trim()}
            fullWidth
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {siteNotifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz bildirim gönderilmedi</Text>
            </View>
          ) : siteNotifs.map((n) => <NotifCard key={n.id} notif={n} />)}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 14, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  segmented: { flexDirection: "row", padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47%", flexGrow: 1, padding: 14, alignItems: "center", gap: 8, borderWidth: 1.5 },
  typeLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  targetText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputBox: { borderWidth: 1, overflow: "hidden" },
  inputTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 14, borderBottomWidth: 1 },
  inputMessage: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, minHeight: 120 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  notifCard: { flexDirection: "row", gap: 12, padding: 14, borderWidth: 1 },
  notifIcon: { padding: 10, alignSelf: "flex-start" },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifMsg: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
  notifMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  notifMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
