import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth, User } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

function ResidentCard({ resident, onNotify, onChat }: { resident: User; onNotify: (r: User) => void; onChat: (r: User) => void }) {
  const colors = useColors();
  const initials = resident.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 14, borderColor: colors.border }]}>
      <View style={styles.cardMain}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: 24 }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resName, { color: colors.foreground }]}>{resident.name}</Text>
          <View style={styles.metaRow}>
            {resident.unitNo ? (
              <>
                <View style={[styles.metaPill, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
                  <Feather name="home" size={11} color={colors.primary} />
                  <Text style={[styles.metaPillText, { color: colors.primary }]}>Daire {resident.unitNo}</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.metaEmpty, { color: colors.mutedForeground }]}>Daire bilgisi yok</Text>
            )}
          </View>
        </View>
        <View style={[styles.activeDot, { backgroundColor: "#22c55e", borderRadius: 5 }]} />
      </View>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={() => onNotify(resident)}
          style={[styles.actionBtn, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
          <Feather name="bell" size={15} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>Bildirim Gönder</Text>
        </Pressable>
        <Pressable onPress={() => onChat(resident)}
          style={[styles.actionBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          <Feather name="message-circle" size={15} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Sohbet Aç</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ResidentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { openChat, sendNotification } = useData();
  const [residents, setResidents] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Notify modal
  const [notifyTarget, setNotifyTarget] = useState<User | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active" && u.id !== user.id));
  }, [user, getSiteUsers]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = residents.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.unitNo || "").toLowerCase().includes(q);
  });

  const handleChat = async (resident: User) => {
    if (!user) return;
    try {
      const chat = await openChat(`${user.name} → ${resident.name}`, [user.id, resident.id]);
      router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: resident.name } });
    } catch (e) {
      console.error("Chat açılamadı:", e);
    }
  };

  const handleSendNotif = async () => {
    if (!notifTitle.trim() || !notifMessage.trim() || !notifyTarget || !user) return;
    setSending(true);
    try {
      await sendNotification({
        type: "general",
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toUserIds: [notifyTarget.id],
        toRoles: [],
      });
      setSent(true); setNotifTitle(""); setNotifMessage("");
      setTimeout(() => { setSent(false); setNotifyTarget(null); }, 2000);
    } catch (e) {
      console.error("Bildirim gönderilemedi:", e);
    } finally {
      setSending(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Sakinler</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{residents.length}</Text>
          </View>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Telefon, e-posta ve TC kimlik bilgileri gizlidir.
          </Text>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Ad veya daire no ara..."
            placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? "Sakin bulunamadı" : "Henüz aktif sakin yok"}
            </Text>
          </View>
        ) : filtered.map((r) => (
          <ResidentCard key={r.id} resident={r} onNotify={setNotifyTarget} onChat={handleChat} />
        ))}
      </ScrollView>

      <Modal visible={!!notifyTarget} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNotifyTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Bildirim Gönder</Text>
                {notifyTarget && <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>→ {notifyTarget.name}</Text>}
              </View>
              <Pressable onPress={() => { setNotifyTarget(null); setNotifTitle(""); setNotifMessage(""); }}
                style={[styles.closeBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {sent ? (
              <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
                <Feather name="check-circle" size={20} color={colors.primary} />
                <Text style={[styles.successText, { color: colors.primary }]}>Bildirim gönderildi!</Text>
              </View>
            ) : (
              <>
                <View style={[styles.inputBox, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}>
                  <TextInput style={[styles.inputTitle, { color: colors.foreground, borderBottomColor: colors.border }]}
                    placeholder="Konu..." placeholderTextColor={colors.mutedForeground} value={notifTitle} onChangeText={setNotifTitle} />
                  <TextInput style={[styles.inputMessage, { color: colors.foreground }]} placeholder="Mesajınızı yazın..."
                    placeholderTextColor={colors.mutedForeground} value={notifMessage} onChangeText={setNotifMessage}
                    multiline textAlignVertical="top" />
                </View>
                <Button title="Gönder" onPress={handleSendNotif} loading={sending}
                  disabled={!notifTitle.trim() || !notifMessage.trim()} fullWidth />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  infoBanner: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  resName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 5, flexWrap: "wrap" },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  metaPillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  metaEmpty: { fontSize: 12, fontFamily: "Inter_400Regular" },
  activeDot: { width: 10, height: 10, alignSelf: "flex-start", marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 10, padding: 12, paddingTop: 10, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  inputBox: { borderWidth: 1, overflow: "hidden" },
  inputTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", padding: 14, borderBottomWidth: 1 },
  inputMessage: { fontSize: 14, fontFamily: "Inter_400Regular", padding: 14, minHeight: 120 },
  successBanner: { alignItems: "center", gap: 8, padding: 24 },
  successText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
