import React, { useCallback, useEffect, useState } from "react";
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
import { useAuth, User } from "@/context/AuthContext";
import { useData, AppNotification, NotificationType } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise: { label: "Gürültü", color: "#ef4444", icon: "volume-2" },
  cargo: { label: "Kargo", color: "#8b5cf6", icon: "package" },
  package: { label: "Paket", color: "#8b5cf6", icon: "package" },
  announcement: { label: "Duyuru", color: "#3b82f6", icon: "volume-2" },
  payment: { label: "Ödeme", color: "#f59e0b", icon: "credit-card" },
  general: { label: "Genel", color: "#64748b", icon: "bell" },
  security: { label: "Güvenlik", color: "#ef4444", icon: "shield" },
};

function NotifItem({ notif, onRead }: { notif: AppNotification; onRead: (id: string) => void }) {
  const colors = useColors();
  const { user } = useAuth();
  const isRead = notif.readBy.includes(user?.id || "");
  const info = TYPE_LABELS[notif.type] || TYPE_LABELS.general;

  return (
    <Pressable
      onPress={() => { if (!isRead) onRead(notif.id); }}
      style={[
        styles.notifCard,
        {
          backgroundColor: isRead ? colors.card : colors.primaryLight + "60",
          borderRadius: colors.radius,
          borderColor: isRead ? colors.border : colors.primary + "40",
        },
      ]}
    >
      <View style={[styles.notifIcon, { backgroundColor: info.color + "20", borderRadius: 10 }]}>
        <Feather name={info.icon} size={18} color={info.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.notifHeader}>
          <Text style={[styles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
          {!isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
        <Text style={[styles.notifMsg, { color: colors.mutedForeground }]}>{notif.message}</Text>
        <View style={styles.notifFooter}>
          <View style={[styles.typePill, { backgroundColor: info.color + "20", borderRadius: 10 }]}>
            <Text style={[styles.typeText, { color: info.color }]}>{info.label}</Text>
          </View>
          <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
            {new Date(notif.createdAt).toLocaleDateString("tr-TR")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

type TargetMode = "admin" | "security" | "daire";

const NOTIF_TYPES: { key: NotificationType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "noise", label: "Gürültü Şikayeti", icon: "volume-2" },
  { key: "general", label: "Genel Bildirim", icon: "bell" },
];

export default function ResidentNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { getMyNotifications, markNotificationRead, sendNotification } = useData();
  const [activeTab, setActiveTab] = useState<"inbox" | "send">("inbox");

  // send form
  const [notifType, setNotifType] = useState<NotificationType>("noise");
  const [targetMode, setTargetMode] = useState<TargetMode>("admin");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // daire picker
  const [residents, setResidents] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadResidents = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active" && u.id !== user.id));
  }, [user, getSiteUsers]);

  useEffect(() => {
    if (activeTab === "send") loadResidents();
  }, [activeTab, loadResidents]);

  const myNotifs = getMyNotifications();
  const unread = myNotifs.filter((n) => !n.readBy.includes(user?.id || "")).length;

  const selectedResident = residents.find((r) => r.id === selectedUserId);
  const filteredResidents = residents.filter((r) => {
    const q = pickerSearch.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.unitNo || "").toLowerCase().includes(q);
  });

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || !user) return;
    if (targetMode === "daire" && !selectedUserId) return;

    setLoading(true);

    let toRoles: string[] | undefined;
    let toUserIds: string[] | undefined;

    if (targetMode === "admin") {
      toRoles = ["admin"];
    } else if (targetMode === "security") {
      toRoles = ["security"];
    } else if (targetMode === "daire") {
      toUserIds = [selectedUserId];
    }

    await sendNotification({
      type: notifType,
      title: title.trim(),
      message: message.trim(),
      fromUserId: user.id,
      fromName: user.name,
      siteId: user.siteId,
      toRoles,
      toUserIds,
    });

    setLoading(false);
    setSent(true);
    setTitle(""); setMessage(""); setSelectedUserId("");
    setTimeout(() => setSent(false), 3000);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: 10 }]}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {([["inbox", "Gelen"], ["send", "Gönder"]] as [string, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key as "inbox" | "send")}
              style={[styles.segmentBtn, { borderRadius: colors.radius - 2, backgroundColor: activeTab === key ? colors.card : "transparent" }]}
            >
              <Text style={[styles.segmentText, { color: activeTab === key ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "inbox" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
          {myNotifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Henüz bildirim yok</Text>
            </View>
          ) : myNotifs.map((n) => <NotifItem key={n.id} notif={n} onRead={markNotificationRead} />)}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Info banner - no broadcast for residents */}
          <View style={[styles.infoBanner, { backgroundColor: "#eff6ff", borderRadius: colors.radius, borderColor: "#bfdbfe" }]}>
            <Feather name="info" size={14} color="#1d4ed8" />
            <Text style={[styles.infoText, { color: "#1e40af" }]}>
              Toplu bildirim yalnızca yönetici tarafından gönderilebilir. Belirli bir daireye, güvenlik görevlisine veya yöneticiye mesaj gönderebilirsiniz.
            </Text>
          </View>

          {/* Target mode */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>KİME GÖNDERİLSİN?</Text>
          <View style={styles.targetRow}>
            {([
              ["admin", "Yönetici", "settings"],
              ["security", "Güvenlik", "shield"],
              ["daire", "Belirli Daire", "home"],
            ] as [TargetMode, string, string][]).map(([key, label, icon]) => (
              <Pressable
                key={key}
                onPress={() => { setTargetMode(key); setSelectedUserId(""); }}
                style={[
                  styles.targetBtn,
                  {
                    borderRadius: colors.radius - 2,
                    borderColor: targetMode === key ? colors.primary : colors.border,
                    backgroundColor: targetMode === key ? colors.primaryLight : colors.card,
                  },
                ]}
              >
                <Feather name={icon as any} size={16} color={targetMode === key ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.targetLabel, { color: targetMode === key ? colors.primary : colors.foreground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Daire picker */}
          {targetMode === "daire" && (
            <View style={styles.pickerSection}>
              <Pressable
                onPress={() => setShowPicker(!showPicker)}
                style={[styles.picker, { borderColor: selectedResident ? colors.primary : colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}
              >
                <Feather name="home" size={16} color={selectedResident ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.pickerText, { color: selectedResident ? colors.foreground : colors.mutedForeground }]}>
                  {selectedResident
                    ? `${selectedResident.name}${selectedResident.unitNo ? ` · Daire ${selectedResident.unitNo}` : ""}`
                    : "Daire veya sakin seçin..."}
                </Text>
                <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </Pressable>
              {showPicker && (
                <View style={[styles.dropdown, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
                  <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
                    <Feather name="search" size={14} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.dropdownInput, { color: colors.foreground }]}
                      placeholder="İsim veya daire ara..."
                      placeholderTextColor={colors.mutedForeground}
                      value={pickerSearch}
                      onChangeText={setPickerSearch}
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {filteredResidents.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => { setSelectedUserId(r.id); setShowPicker(false); setPickerSearch(""); }}
                        style={[styles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: selectedUserId === r.id ? colors.primaryLight : "transparent" }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownItemName, { color: selectedUserId === r.id ? colors.primary : colors.foreground }]}>{r.name}</Text>
                          {r.unitNo ? <Text style={[styles.dropdownItemSub, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text> : null}
                        </View>
                        {selectedUserId === r.id ? <Feather name="check" size={16} color={colors.primary} /> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Notification type */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM TÜRÜ</Text>
          <View style={styles.typeRow}>
            {NOTIF_TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setNotifType(t.key)}
                style={[
                  styles.typeBtn,
                  {
                    borderRadius: colors.radius,
                    borderColor: notifType === t.key ? colors.primary : colors.border,
                    backgroundColor: notifType === t.key ? colors.primaryLight : colors.card,
                  },
                ]}
              >
                <Feather name={t.icon} size={15} color={notifType === t.key ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.typeBtnText, { color: notifType === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Message */}
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <TextInput
              style={[styles.inputTitle, { color: colors.foreground, borderBottomColor: colors.border }]}
              placeholder="Konu..."
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.inputMessage, { color: colors.foreground }]}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />
          </View>

          {sent ? (
            <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>Bildirim gönderildi!</Text>
            </View>
          ) : null}

          <Button
            title="Gönder"
            onPress={handleSend}
            loading={loading}
            disabled={!title.trim() || !message.trim() || (targetMode === "daire" && !selectedUserId)}
            fullWidth
          />
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
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  notifCard: { flexDirection: "row", gap: 12, padding: 14, borderWidth: 1 },
  notifIcon: { padding: 10, alignSelf: "flex-start" },
  notifHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMsg: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  notifFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  targetRow: { flexDirection: "row", gap: 8 },
  targetBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderWidth: 1.5 },
  targetLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pickerSection: { gap: 0 },
  picker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1.5, height: 52 },
  pickerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdown: { borderWidth: 1, overflow: "hidden", marginTop: 4 },
  dropdownSearch: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  dropdownInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdownItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1 },
  dropdownItemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dropdownItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderWidth: 1.5 },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputBox: { borderWidth: 1, overflow: "hidden" },
  inputTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 14, borderBottomWidth: 1 },
  inputMessage: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, minHeight: 100 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
