import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { router } from "expo-router";
import { useAuth, User } from "@/context/AuthContext";
import { useData, Chat } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

type Tab = "active" | "closed" | "archive";

function getArchiveKey(userId: string) { return `chat_archive_${userId}`; }
async function loadArchive(userId: string): Promise<string[]> {
  try { const raw = await AsyncStorage.getItem(getArchiveKey(userId)); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function saveArchive(userId: string, ids: string[]) {
  try { await AsyncStorage.setItem(getArchiveKey(userId), JSON.stringify(ids)); } catch {}
}

function ChatRow({ chat, onPress, onArchive, onClose }: { chat: Chat; onPress: () => void; onArchive?: () => void; onClose?: () => void }) {
  const colors = useColors();
  const isOpen = chat.status === "open";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.chatRow,
      { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border, borderRadius: 14, borderLeftColor: isOpen ? colors.primary : colors.mutedForeground, borderLeftWidth: 3 },
    ]}>
      <View style={[styles.chatAvatar, { backgroundColor: isOpen ? colors.primaryLight : colors.muted, borderRadius: 22 }]}>
        <Feather name="message-circle" size={20} color={isOpen ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.chatTitle, { color: colors.foreground }]} numberOfLines={1}>{chat.title}</Text>
        <Text style={[styles.chatDate, { color: colors.mutedForeground }]}>
          {new Date(chat.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
        </Text>
      </View>
      <View style={styles.actionRow}>
        {onClose && isOpen && (
          <Pressable onPress={(e) => { e.stopPropagation(); onClose(); }}
            style={[styles.actionBtn, { backgroundColor: "#fef2f2", borderRadius: 8 }]}>
            <Feather name="x-circle" size={15} color="#ef4444" />
          </Pressable>
        )}
        {onArchive && (
          <Pressable onPress={(e) => { e.stopPropagation(); onArchive(); }}
            style={[styles.actionBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}>
            <Feather name="archive" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

export default function SecurityChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { chats, openChat, closeMyChat } = useData();
  const [tab, setTab] = useState<Tab>("active");
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const [residents, setResidents] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);

  const userId = user?.id ?? "";

  const refreshArchive = useCallback(async () => {
    const ids = await loadArchive(userId);
    setArchiveIds(ids);
  }, [userId]);

  useEffect(() => { refreshArchive(); }, [refreshArchive]);

  const archiveChat = async (chatId: string) => {
    const ids = [...archiveIds, chatId];
    setArchiveIds(ids);
    await saveArchive(userId, ids);
  };

  const unarchiveChat = async (chatId: string) => {
    const ids = archiveIds.filter((id) => id !== chatId);
    setArchiveIds(ids);
    await saveArchive(userId, ids);
  };

  const siteChats = chats.filter((c) => c.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeChats = siteChats.filter((c) => c.status === "open" && !archiveIds.includes(c.id));
  const closedChats = siteChats.filter((c) => c.status !== "open" && !archiveIds.includes(c.id));
  const archivedChats = siteChats.filter((c) => archiveIds.includes(c.id));

  const applySearch = (list: Chat[]) =>
    !search ? list : list.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  const currentChats = applySearch(tab === "active" ? activeChats : tab === "closed" ? closedChats : archivedChats);

  const loadResidents = async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active"));
  };

  const handleOpenModal = async () => { await loadResidents(); setShowModal(true); };

  const handleCreate = async () => {
    if (!chatTitle.trim() || !user) return;
    setLoading(true);
    try {
      const participantIds = [user.id, ...(selectedUser ? [selectedUser] : [])];
      const chat = await openChat(chatTitle.trim(), participantIds);
      setLoading(false); setShowModal(false); setChatTitle(""); setSelectedUser("");
      router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: chat.title } });
    } catch { setLoading(false); }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "active",  label: "Aktif",  count: activeChats.length },
    { key: "closed",  label: "Kapalı", count: closedChats.length },
    { key: "archive", label: "Arşiv",  count: archivedChats.length },
  ];

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.foreground }]}>Sohbetler</Text>
          <Pressable onPress={handleOpenModal}
            style={[styles.newBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Yeni</Text>
          </Pressable>
        </View>

        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)}
              style={[styles.tabBtn, tab === t.key && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
              <Text style={[styles.tabLabel, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: tab === t.key ? colors.primary : colors.muted, borderRadius: 10 }]}>
                  <Text style={[styles.tabBadgeText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10 }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Sohbet ara..."
            placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {currentChats.length === 0 ? (
          <View style={styles.empty}>
            <Feather name={tab === "archive" ? "archive" : "message-circle"} size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {tab === "active" ? "Aktif sohbet yok" : tab === "closed" ? "Kapalı sohbet yok" : "Arşiv boş"}
            </Text>
          </View>
        ) : currentChats.map((c) => (
          <View key={c.id} style={{ gap: 6 }}>
            <ChatRow
              chat={c}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id, name: c.title } })}
              onArchive={tab !== "archive" ? () => archiveChat(c.id) : undefined}
              onClose={tab === "active" ? () => closeMyChat(c.id) : undefined}
            />
            {tab === "archive" && (
              <Pressable onPress={() => unarchiveChat(c.id)}
                style={[styles.unarchiveBtn, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
                <Feather name="rotate-ccw" size={13} color={colors.primary} />
                <Text style={[styles.unarchiveBtnText, { color: colors.primary }]}>Arşivden çıkar</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Yeni Sohbet</Text>
              <Pressable onPress={() => setShowModal(false)}
                style={[styles.closeBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>KONU</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12 }]}
              placeholder="Sohbet konusu..." placeholderTextColor={colors.mutedForeground}
              value={chatTitle} onChangeText={setChatTitle} maxLength={60} />

            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>SAKİN (opsiyonel)</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {residents.map((r) => (
                <Pressable key={r.id} onPress={() => setSelectedUser(selectedUser === r.id ? "" : r.id)}
                  style={[styles.residentRow, { borderColor: selectedUser === r.id ? colors.primary : colors.border, backgroundColor: selectedUser === r.id ? colors.primaryLight : colors.card, borderRadius: 10 }]}>
                  <View style={[styles.resAvatar, { backgroundColor: colors.primaryLight, borderRadius: 18 }]}>
                    <Text style={[styles.resAvatarText, { color: colors.primary }]}>{r.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resName, { color: selectedUser === r.id ? colors.primary : colors.foreground }]}>{r.name}</Text>
                    {r.unitNo && <Text style={[styles.resUnit, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text>}
                  </View>
                  {selectedUser === r.id && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>

            <Button title="Sohbet Başlat" onPress={handleCreate} loading={loading} disabled={!chatTitle.trim()} fullWidth />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 0 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  chatAvatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chatTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chatDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: { padding: 7 },
  unarchiveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, marginTop: -4 },
  unarchiveBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  formLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  input: { borderWidth: 1.5, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  residentRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1.5, marginBottom: 8 },
  resAvatar: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  resAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  resName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  resUnit: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
