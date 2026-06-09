import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

const TYPE_META: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  noise:        { label: "Gürültü",      color: "#ef4444", icon: "volume-2" },
  cargo:        { label: "Kargo",        color: "#8b5cf6", icon: "package" },
  package:      { label: "Paket",        color: "#8b5cf6", icon: "package" },
  announcement: { label: "Genel Duyuru", color: "#3b82f6", icon: "volume-2" },
  payment:      { label: "Ödeme",        color: "#f59e0b", icon: "credit-card" },
  general:      { label: "Genel",        color: "#64748b", icon: "bell" },
  security:     { label: "Güvenlik",     color: "#ef4444", icon: "shield" },
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
      <View style={styles.cardTop}>
        <View style={[styles.catPill, { backgroundColor: meta.color + "20", borderRadius: 20 }]}>
          <Feather name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.catText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
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

type TabMode = "inbox" | "send";
type SendTarget = "admin" | "specific";

const SEND_TYPES: { key: NotificationType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "general",  label: "Genel Bildirim",    icon: "bell",   color: "#64748b" },
  { key: "security", label: "Güvenlik Bildirimi", icon: "shield", color: "#ef4444" },
];

export default function SecurityNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { getMyNotifications, markNotificationRead, unreadCount, sendNotification } = useData();

  const notifs = getMyNotifications();
  const userId = user?.id ?? "";
  const unread = notifs.filter((n) => !n.readBy.includes(userId));
  const read = notifs.filter((n) => n.readBy.includes(userId));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabMode>(params.tab === "send" ? "send" : "inbox");

  const [sendTarget, setSendTarget] = useState<SendTarget>("admin");
  const [notifType, setNotifType] = useState<NotificationType>("general");
  const [titleText, setTitleText] = useState("");
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [siteUsers, setSiteUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user?.siteId || siteUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const all = await getSiteUsers(user.siteId);
      setSiteUsers(all.filter((u) => u.id !== user.id && u.status === "active"));
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  }, [user, getSiteUsers, siteUsers.length]);

  useEffect(() => {
    if (tab === "send" && sendTarget === "specific") {
      loadUsers();
    }
  }, [tab, sendTarget, loadUsers]);

  const filteredUsers = siteUsers.filter((u) =>
    pickerSearch.trim() === "" ||
    u.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    (u.unitNo ?? "").toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const handleSend = async () => {
    if (!titleText.trim() || !msgText.trim()) {
      Alert.alert("Eksik", "Başlık ve mesaj zorunludur.");
      return;
    }
    if (sendTarget === "specific" && !selectedUser) {
      Alert.alert("Eksik", "Lütfen bildirim göndermek istediğiniz kişiyi seçin.");
      return;
    }

    setSending(true);
    try {
      await sendNotification({
        siteId: user?.siteId ?? "",
        type: notifType,
        title: titleText.trim(),
        message: msgText.trim(),
        fromUserId: userId,
        fromName: user?.name ?? "",
        toRoles: sendTarget === "admin" ? ["admin"] : undefined,
        toUserIds: sendTarget === "specific" && selectedUser ? [selectedUser.id] : undefined,
      });
      setSent(true);
      setTitleText("");
      setMsgText("");
      setSelectedUser(null);
      setTimeout(() => setSent(false), 3000);
    } catch (e: any) {
      Alert.alert("Hata", e?.data?.message ?? e?.message ?? "Bildirim gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bildirimler</Text>
          {unreadCount > 0 && tab === "inbox" && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: 10 }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.muted + "50", borderRadius: 10 }]}>
          <Pressable
            onPress={() => setTab("inbox")}
            style={[styles.tabBtn, tab === "inbox" && { backgroundColor: colors.card, borderRadius: 8 }]}
          >
            <Feather name="inbox" size={13} color={tab === "inbox" ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabBtnText, { color: tab === "inbox" ? colors.primary : colors.mutedForeground }]}>
              Gelen
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("send")}
            style={[styles.tabBtn, tab === "send" && { backgroundColor: colors.card, borderRadius: 8 }]}
          >
            <Feather name="send" size={13} color={tab === "send" ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabBtnText, { color: tab === "send" ? colors.primary : colors.mutedForeground }]}>
              Gönder
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === "inbox" ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {notifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Bildirim yok</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Gelen bildirimler burada görünecek</Text>
            </View>
          ) : (
            <>
              {unread.length > 0 && (
                <>
                  <View style={styles.groupRow}>
                    <View style={[styles.groupDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.groupLabel, { color: colors.primary }]}>OKUNMAMIŞ — {unread.length}</Text>
                  </View>
                  {unread.map((n) => <NotifCard key={n.id} n={n} onRead={markNotificationRead} userId={userId} />)}
                </>
              )}
              {read.length > 0 && (
                <>
                  <View style={styles.groupRow}>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100, gap: 16 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {sent && (
              <View style={[styles.sentBanner, { backgroundColor: "#dcfce7", borderRadius: 10 }]}>
                <Feather name="check-circle" size={16} color="#16a34a" />
                <Text style={[styles.sentText, { color: "#16a34a" }]}>Bildirim başarıyla gönderildi!</Text>
              </View>
            )}

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14 }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ALICI</Text>
              <View style={styles.targetRow}>
                {(["admin", "specific"] as SendTarget[]).map((t) => {
                  const active = sendTarget === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => { setSendTarget(t); setSelectedUser(null); }}
                      style={[
                        styles.targetBtn,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primaryLight : colors.background,
                          borderRadius: 10,
                        },
                      ]}
                    >
                      <Feather
                        name={t === "admin" ? "shield" : "user"}
                        size={15}
                        color={active ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.targetBtnText, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {t === "admin" ? "Yönetici" : "Belirli Kişi"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {sendTarget === "specific" && (
                <View style={{ marginTop: 12 }}>
                  <Pressable
                    onPress={() => setShowPicker(!showPicker)}
                    style={[
                      styles.pickerBtn,
                      {
                        borderColor: showPicker ? colors.primary : colors.border,
                        backgroundColor: colors.background,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Feather name="user" size={14} color={selectedUser ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.pickerBtnText, { color: selectedUser ? colors.foreground : colors.mutedForeground }]}>
                      {selectedUser
                        ? `${selectedUser.name}${selectedUser.unitNo ? ` — Daire ${selectedUser.unitNo}` : ""}`
                        : "Kişi seçin..."}
                    </Text>
                    <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                  </Pressable>

                  {showPicker && (
                    <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 10 }]}>
                      <View style={[styles.pickerSearchWrap, { borderBottomColor: colors.border }]}>
                        <Feather name="search" size={13} color={colors.mutedForeground} />
                        <TextInput
                          style={[styles.pickerSearchInput, { color: colors.foreground }]}
                          placeholder="Ada veya daireye göre ara..."
                          placeholderTextColor={colors.mutedForeground}
                          value={pickerSearch}
                          onChangeText={setPickerSearch}
                          autoFocus
                        />
                      </View>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {usersLoading ? (
                          <View style={{ padding: 16, alignItems: "center" }}>
                            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Yükleniyor...</Text>
                          </View>
                        ) : filteredUsers.length === 0 ? (
                          <View style={{ padding: 16, alignItems: "center" }}>
                            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Sonuç bulunamadı</Text>
                          </View>
                        ) : (
                          filteredUsers.map((u) => (
                            <Pressable
                              key={u.id}
                              onPress={() => { setSelectedUser(u); setShowPicker(false); setPickerSearch(""); }}
                              style={[
                                styles.pickerOption,
                                {
                                  backgroundColor: selectedUser?.id === u.id ? colors.primaryLight : "transparent",
                                  borderBottomColor: colors.border,
                                },
                              ]}
                            >
                              <View style={[styles.pickerAvatar, { backgroundColor: colors.primary + "20", borderRadius: 20 }]}>
                                <Text style={[styles.pickerAvatarText, { color: colors.primary }]}>
                                  {u.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.pickerOptionName, { color: colors.foreground }]}>{u.name}</Text>
                                {u.unitNo && (
                                  <Text style={[styles.pickerOptionSub, { color: colors.mutedForeground }]}>Daire {u.unitNo}</Text>
                                )}
                              </View>
                              {selectedUser?.id === u.id && (
                                <Feather name="check" size={14} color={colors.primary} />
                              )}
                            </Pressable>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14 }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BİLDİRİM TÜRÜ</Text>
              <View style={styles.typeRow}>
                {SEND_TYPES.map((t) => {
                  const active = notifType === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setNotifType(t.key)}
                      style={[
                        styles.typeBtn,
                        {
                          borderColor: active ? t.color : colors.border,
                          backgroundColor: active ? t.color + "18" : colors.background,
                          borderRadius: 10,
                        },
                      ]}
                    >
                      <Feather name={t.icon} size={14} color={active ? t.color : colors.mutedForeground} />
                      <Text style={[styles.typeBtnText, { color: active ? t.color : colors.mutedForeground }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14 }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MESAJ</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.titleInput, { color: colors.foreground }]}
                  placeholder="Başlık..."
                  placeholderTextColor={colors.mutedForeground}
                  value={titleText}
                  onChangeText={setTitleText}
                  maxLength={80}
                />
              </View>
              <View style={[styles.inputWrap, { borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, marginTop: 10 }]}>
                <TextInput
                  style={[styles.msgInput, { color: colors.foreground }]}
                  placeholder="Mesajınızı yazın..."
                  placeholderTextColor={colors.mutedForeground}
                  value={msgText}
                  onChangeText={setMsgText}
                  multiline
                  textAlignVertical="top"
                  maxLength={400}
                />
              </View>
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{msgText.length}/400</Text>
            </View>

            <Pressable
              onPress={handleSend}
              disabled={sending}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: sending ? colors.primary + "80" : colors.primary,
                  borderRadius: 12,
                  opacity: sending ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.sendBtnText}>{sending ? "Gönderiliyor..." : "Gönder"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  tabBar: { flexDirection: "row", padding: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  card: { padding: 14, gap: 6, borderWidth: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  senderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sentBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  sentText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { padding: 16, borderWidth: 1, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  targetRow: { flexDirection: "row", gap: 10 },
  targetBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1.5 },
  targetBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderWidth: 1.5 },
  pickerBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  pickerDropdown: { borderWidth: 1, marginTop: 6, overflow: "hidden" },
  pickerSearchWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  pickerSearchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  pickerOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  pickerAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  pickerAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerOptionName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  pickerOptionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1.5 },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputWrap: { borderWidth: 1.5 },
  titleInput: { padding: 13, fontSize: 14, fontFamily: "Inter_500Medium" },
  msgInput: { padding: 13, minHeight: 100, fontSize: 14, fontFamily: "Inter_400Regular" },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15 },
  sendBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
