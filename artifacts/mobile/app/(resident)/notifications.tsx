import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useAuth, User } from "@/context/AuthContext";
import { useData, AppNotification, NotificationType } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

const TYPE_META: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise:        { label: "Gürültü",          color: "#ef4444", icon: "volume-2" },
  cargo:        { label: "Kargo",            color: "#8b5cf6", icon: "package" },
  package:      { label: "Paket",            color: "#8b5cf6", icon: "package" },
  announcement: { label: "Genel Duyuru",     color: "#3b82f6", icon: "volume-2" },
  payment:      { label: "Ödeme",            color: "#f59e0b", icon: "credit-card" },
  general:      { label: "Genel",            color: "#64748b", icon: "bell" },
  security:     { label: "Güvenlik",         color: "#ef4444", icon: "shield" },
};

function NotifCard({ n, onRead, userId }: { n: AppNotification; onRead: (id: string) => void; userId: string }) {
  const colors = useColors();
  const isRead = n.readBy.includes(userId);
  const meta = TYPE_META[n.type] ?? TYPE_META.general;

  return (
    <Pressable
      onPress={() => { if (!isRead) onRead(n.id); }}
      style={[
        styles.card,
        {
          backgroundColor: isRead ? colors.card : "#f0fdf4",
          borderColor: isRead ? colors.border : colors.primary + "40",
          borderLeftColor: meta.color,
          borderLeftWidth: 3,
          borderRadius: 14,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.catPill, { backgroundColor: meta.color + "20", borderRadius: 20 }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.catText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            {new Date(n.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
          </Text>
          {!isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{n.title}</Text>
      {n.fromName ? (
        <View style={styles.senderRow}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.senderText, { color: colors.mutedForeground }]}>{n.fromName}</Text>
        </View>
      ) : null}
      <Text style={[styles.cardMsg, { color: colors.mutedForeground }]} numberOfLines={2}>{n.message}</Text>
    </Pressable>
  );
}

type TargetMode = "admin" | "security" | "daire";
const NOTIF_TYPES: { key: NotificationType; label: string; icon: keyof typeof Feather.glyphMap; hint: string }[] = [
  { key: "noise",   label: "Gürültü Şikayeti", icon: "volume-2", hint: "Komşu gürültüsünü yöneticiye bildirin" },
  { key: "cargo",   label: "Kargo Talebi",     icon: "package",  hint: "Güvenliğe kargo bildirimi gönderin" },
  { key: "general", label: "Genel Bildirim",   icon: "bell",     hint: "" },
];

export default function ResidentNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { getMyNotifications, markNotificationRead, sendNotification } = useData();
  const params = useLocalSearchParams<{ action?: string }>();

  const [tab, setTab] = useState<"inbox" | "send">("inbox");
  const [notifType, setNotifType] = useState<NotificationType>("noise");
  const [targetMode, setTargetMode] = useState<TargetMode>("admin");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [residents, setResidents] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const paramsApplied = useRef(false);

  useEffect(() => {
    if (paramsApplied.current) return;
    paramsApplied.current = true;
    if (params.action === "cargo") { setTab("send"); setNotifType("cargo"); setTargetMode("security"); }
    else if (params.action === "noise") { setTab("send"); setNotifType("noise"); setTargetMode("admin"); }
  }, [params.action]);

  const loadResidents = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active" && u.id !== user.id));
  }, [user, getSiteUsers]);

  useEffect(() => { if (tab === "send") loadResidents(); }, [tab, loadResidents]);

  const myNotifs = getMyNotifications();
  const userId = user?.id ?? "";
  const unread = myNotifs.filter((n) => !n.readBy.includes(userId));
  const read = myNotifs.filter((n) => n.readBy.includes(userId));

  const selectedResident = residents.find((r) => r.id === selectedUserId);
  const filteredResidents = residents.filter((r) => {
    const q = pickerSearch.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.unitNo || "").toLowerCase().includes(q);
  });

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || !user) return;
    if (targetMode === "daire" && !selectedUserId) return;
    setLoading(true);
    try {
      await sendNotification({
        type: notifType,
        title: title.trim(),
        message: message.trim(),
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toRoles: targetMode === "daire" ? undefined : [targetMode],
        toUserIds: targetMode === "daire" ? [selectedUserId] : undefined,
      });
      setSent(true); setTitle(""); setMessage(""); setSelectedUserId("");
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      console.error("Bildirim gönderilemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const currentTypeMeta = NOTIF_TYPES.find((t) => t.key === notifType);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
          {unread.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: 10 }]}>
              <Text style={styles.badgeText}>{unread.length}</Text>
            </View>
          )}
        </View>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          {([["inbox", "Gelen"], ["send", "Gönder"]] as [string, string][]).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k as any)}
              style={[styles.segBtn, { borderRadius: 8, backgroundColor: tab === k ? colors.card : "transparent" }]}>
              <Text style={[styles.segBtnText, { color: tab === k ? colors.foreground : colors.mutedForeground }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === "inbox" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {myNotifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Bildirim yok</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Gelen bildirimler burada görünecek</Text>
            </View>
          ) : (
            <>
              {unread.length > 0 && (
                <>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.groupLabel, { color: colors.primary }]}>OKUNMAMIŞ — {unread.length}</Text>
                  </View>
                  {unread.map((n) => <NotifCard key={n.id} n={n} onRead={markNotificationRead} userId={userId} />)}
                </>
              )}
              {read.length > 0 && (
                <>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupDot, { backgroundColor: colors.mutedForeground }]} />
                    <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>OKUNMUŞ — {read.length}</Text>
                  </View>
                  {read.map((n) => <NotifCard key={n.id} n={n} onRead={markNotificationRead} userId={userId} />)}
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.infoBanner, { backgroundColor: "#eff6ff", borderRadius: 10, borderColor: "#bfdbfe" }]}>
            <Feather name="info" size={14} color="#1d4ed8" />
            <Text style={[styles.infoText, { color: "#1e40af" }]}>Toplu bildirim sadece yönetici tarafından gönderilebilir.</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>KİME GÖNDERİLSİN?</Text>
          <View style={styles.targetRow}>
            {([["admin", "Yönetici", "settings"], ["security", "Güvenlik", "shield"], ["daire", "Belirli Daire", "home"]] as [TargetMode, string, string][]).map(([k, l, i]) => (
              <Pressable key={k} onPress={() => { setTargetMode(k); setSelectedUserId(""); }}
                style={[styles.targetBtn, { borderRadius: 10, borderColor: targetMode === k ? colors.primary : colors.border, backgroundColor: targetMode === k ? colors.primaryLight : colors.card }]}>
                <Feather name={i as any} size={16} color={targetMode === k ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.targetLabel, { color: targetMode === k ? colors.primary : colors.foreground }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {targetMode === "daire" && (
            <View>
              <Pressable onPress={() => setShowPicker(!showPicker)}
                style={[styles.picker, { borderColor: selectedResident ? colors.primary : colors.border, borderRadius: 10, backgroundColor: colors.card }]}>
                <Feather name="home" size={16} color={selectedResident ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.pickerText, { color: selectedResident ? colors.foreground : colors.mutedForeground }]}>
                  {selectedResident ? `${selectedResident.name}${selectedResident.unitNo ? ` · Daire ${selectedResident.unitNo}` : ""}` : "Daire veya sakin seçin..."}
                </Text>
                <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </Pressable>
              {showPicker && (
                <View style={[styles.dropdown, { borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card }]}>
                  <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
                    <Feather name="search" size={14} color={colors.mutedForeground} />
                    <TextInput style={[styles.dropdownInput, { color: colors.foreground }]} placeholder="İsim veya daire ara..."
                      placeholderTextColor={colors.mutedForeground} value={pickerSearch} onChangeText={setPickerSearch} />
                  </View>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {filteredResidents.map((r) => (
                      <Pressable key={r.id} onPress={() => { setSelectedUserId(r.id); setShowPicker(false); setPickerSearch(""); }}
                        style={[styles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: selectedUserId === r.id ? colors.primaryLight : "transparent" }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownName, { color: selectedUserId === r.id ? colors.primary : colors.foreground }]}>{r.name}</Text>
                          {r.unitNo ? <Text style={[styles.dropdownSub, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text> : null}
                        </View>
                        {selectedUserId === r.id && <Feather name="check" size={16} color={colors.primary} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM TÜRÜ</Text>
          <View style={styles.typeCol}>
            {NOTIF_TYPES.map((t) => (
              <Pressable key={t.key} onPress={() => setNotifType(t.key)}
                style={[styles.typeBtn, { borderRadius: 10, borderColor: notifType === t.key ? colors.primary : colors.border, backgroundColor: notifType === t.key ? colors.primaryLight : colors.card }]}>
                <Feather name={t.icon} size={16} color={notifType === t.key ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeBtnText, { color: notifType === t.key ? colors.primary : colors.foreground }]}>{t.label}</Text>
                  {t.hint ? <Text style={[styles.typeBtnHint, { color: notifType === t.key ? colors.primary : colors.mutedForeground }]}>{t.hint}</Text> : null}
                </View>
                {notifType === t.key && <Feather name="check-circle" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>

          {currentTypeMeta?.hint ? (
            <View style={[styles.hintBanner, { backgroundColor: colors.primaryLight, borderRadius: 8 }]}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={[styles.hintText, { color: colors.primary }]}>{currentTypeMeta.hint}</Text>
            </View>
          ) : null}

          <View style={[styles.inputBox, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}>
            <TextInput style={[styles.inputTitle, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Konu..." placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.inputMessage, { color: colors.foreground }]} placeholder="Mesajınızı yazın..."
              placeholderTextColor={colors.mutedForeground} value={message} onChangeText={setMessage} multiline textAlignVertical="top" />
          </View>

          {sent && (
            <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>Bildirim gönderildi!</Text>
            </View>
          )}

          <Button title="Gönder" onPress={handleSend} loading={loading}
            disabled={!title.trim() || !message.trim() || (targetMode === "daire" && !selectedUserId)} fullWidth />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  segmented: { flexDirection: "row", padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  card: { padding: 14, gap: 6, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  senderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  targetRow: { flexDirection: "row", gap: 8 },
  targetBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderWidth: 1.5 },
  targetLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  picker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1.5, height: 52 },
  pickerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdown: { borderWidth: 1, overflow: "hidden", marginTop: 4 },
  dropdownSearch: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  dropdownInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdownItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  dropdownName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dropdownSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  typeCol: { gap: 8 },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1.5 },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  typeBtnHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  hintBanner: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  hintText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inputBox: { borderWidth: 1, overflow: "hidden" },
  inputTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 14, borderBottomWidth: 1 },
  inputMessage: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, minHeight: 100 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
