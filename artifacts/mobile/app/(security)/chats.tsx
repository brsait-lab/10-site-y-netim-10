import React, { useState } from "react";
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

function ChatRow({ chat, onPress, onClose }: { chat: Chat; onPress: () => void; onClose?: () => void }) {
  const colors = useColors();
  const isOpen = chat.status === "open";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chatRow,
        { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border, borderRadius: 14 },
      ]}
    >
      <View style={[styles.chatAvatar, { backgroundColor: isOpen ? colors.primaryLight : colors.muted, borderRadius: 22 }]}>
        <Feather name="message-circle" size={20} color={isOpen ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.chatRowTop}>
          <Text style={[styles.chatTitle, { color: colors.foreground }]} numberOfLines={1}>{chat.title}</Text>
          <View style={[styles.statusPill, { backgroundColor: isOpen ? "#dcfce7" : colors.muted, borderRadius: 10 }]}>
            <Text style={[styles.statusText, { color: isOpen ? colors.primary : colors.mutedForeground }]}>
              {isOpen ? "Açık" : "Kapalı"}
            </Text>
          </View>
        </View>
        <Text style={[styles.chatDate, { color: colors.mutedForeground }]}>
          {new Date(chat.createdAt).toLocaleDateString("tr-TR")}
        </Text>
      </View>
      {isOpen && onClose && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onClose(); }}
          style={[styles.closeAction, { backgroundColor: "#fef2f2", borderRadius: 8 }]}
        >
          <Feather name="x-circle" size={16} color="#ef4444" />
        </Pressable>
      )}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function SecurityChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { chats, openChat, closeMyChat } = useData();
  const [showModal, setShowModal] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const [residents, setResidents] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");

  const siteChats = chats
    .filter((c) => c.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = siteChats.filter((c) =>
    (tab === "open" ? c.status === "open" : c.status !== "open") &&
    (!search || c.title.toLowerCase().includes(search.toLowerCase()))
  );

  const loadResidents = async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active"));
  };

  const handleOpenModal = async () => {
    await loadResidents();
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!chatTitle.trim() || !user) return;
    setLoading(true);
    try {
      const participantIds = [user.id, ...(selectedUser ? [selectedUser] : [])];
      const chat = await openChat(chatTitle.trim(), participantIds);
      setLoading(false);
      setShowModal(false);
      setChatTitle("");
      setSelectedUser("");
      router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: chat.title } });
    } catch {
      setLoading(false);
    }
  };

  const handleCloseChat = async (chatId: string) => {
    await closeMyChat(chatId);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.headerWrap, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.foreground }]}>Sohbetler</Text>
          <Pressable
            onPress={handleOpenModal}
            style={[styles.newBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Yeni</Text>
          </Pressable>
        </View>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          {([["open", "Açık"], ["closed", "Kapalı"]] as [typeof tab, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segBtn, { borderRadius: 8, backgroundColor: tab === key ? colors.card : "transparent" }]}
            >
              <Text style={[styles.segBtnText, { color: tab === key ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10 }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Sohbet ara..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-circle" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {tab === "open" ? "Açık sohbet yok" : "Kapalı sohbet yok"}
            </Text>
          </View>
        ) : filtered.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id, name: c.title } })}
            onClose={c.status === "open" ? () => handleCloseChat(c.id) : undefined}
          />
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Yeni Sohbet</Text>
              <Pressable onPress={() => setShowModal(false)} style={[styles.closeBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>KONU</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 12 }]}
              placeholder="Sohbet konusu..."
              placeholderTextColor={colors.mutedForeground}
              value={chatTitle}
              onChangeText={setChatTitle}
              maxLength={60}
            />

            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>SAKİN (opsiyonel)</Text>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {residents.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedUser(selectedUser === r.id ? "" : r.id)}
                  style={[
                    styles.residentRow,
                    {
                      borderColor: selectedUser === r.id ? colors.primary : colors.border,
                      backgroundColor: selectedUser === r.id ? colors.primaryLight : colors.card,
                      borderRadius: 10,
                    },
                  ]}
                >
                  <View style={[styles.resAvatar, { backgroundColor: colors.primaryLight, borderRadius: 16 }]}>
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

            <Button
              title="Sohbet Başlat"
              onPress={handleCreate}
              loading={loading}
              disabled={!chatTitle.trim()}
              fullWidth
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  segmented: { flexDirection: "row", padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  chatAvatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chatRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chatDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  closeAction: { padding: 7 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
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
