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
import { useAuth } from "@/context/AuthContext";
import { useData, Chat } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";

function ChatRow({ chat, onPress }: { chat: Chat; onPress: () => void }) {
  const colors = useColors();
  const isOpen = chat.status === "open";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chatRow,
        {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderColor: colors.border,
          borderRadius: 14,
        },
      ]}
    >
      <View style={[styles.chatAvatar, { backgroundColor: isOpen ? colors.primaryLight : colors.muted, borderRadius: 22 }]}>
        <Feather name="message-circle" size={20} color={isOpen ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.chatRowTop}>
          <Text style={[styles.chatTitle, { color: colors.foreground }]} numberOfLines={1}>{chat.title}</Text>
          <View style={[
            styles.statusPill,
            { backgroundColor: isOpen ? "#dcfce7" : colors.muted, borderRadius: 10 },
          ]}>
            <Text style={[styles.statusText, { color: isOpen ? colors.primary : colors.mutedForeground }]}>
              {isOpen ? "Açık" : "Kapalı"}
            </Text>
          </View>
        </View>
        <Text style={[styles.chatDate, { color: colors.mutedForeground }]}>
          {new Date(chat.createdAt).toLocaleDateString("tr-TR")}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ResidentChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { chats, openChat } = useData();
  const [showModal, setShowModal] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const [target, setTarget] = useState<"admin" | "security">("admin");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const myChats = chats
    .filter((c) => c.createdBy === user?.id || c.siteId === user?.siteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleOpenChat = (chat: Chat) => {
    router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: chat.title } });
  };

  const handleCreate = async () => {
    if (!chatTitle.trim() || !user) return;
    setLoading(true);
    try {
      const siteUsers = await getSiteUsers(user.siteId);
      const targets = siteUsers.filter((u) => u.role === target && u.status === "active");
      const participantIds = [user.id, ...targets.map((u) => u.id)];
      const chat = await openChat(chatTitle.trim(), participantIds);
      setLoading(false);
      setShowModal(false);
      setChatTitle("");
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: chat.title } });
    } catch {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Sohbetlerim</Text>
        <Pressable
          onPress={() => setShowModal(true)}
          style={[styles.newBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newBtnText}>Yeni Sohbet</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {done && (
          <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
            <Feather name="check-circle" size={15} color={colors.primary} />
            <Text style={[styles.successText, { color: colors.primary }]}>Sohbet başlatıldı!</Text>
          </View>
        )}
        {myChats.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-circle" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Henüz sohbet yok</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Yönetici veya güvenlik ile iletişime geçmek için yeni sohbet başlatın
            </Text>
          </View>
        ) : myChats.map((c) => (
          <ChatRow key={c.id} chat={c} onPress={() => handleOpenChat(c)} />
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

            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>KİME YAZIYORSUNUZ?</Text>
            <View style={styles.targetRow}>
              {([
                ["admin", "Yönetici", "settings"],
                ["security", "Güvenlik", "shield"],
              ] as [typeof target, string, string][]).map(([key, label, icon]) => (
                <Pressable
                  key={key}
                  onPress={() => setTarget(key)}
                  style={[
                    styles.targetBtn,
                    {
                      borderRadius: 12,
                      borderColor: target === key ? colors.primary : colors.border,
                      backgroundColor: target === key ? colors.primaryLight : colors.card,
                    },
                  ]}
                >
                  <Feather name={icon as any} size={18} color={target === key ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.targetLabel, { color: target === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
                </Pressable>
              ))}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  chatAvatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chatRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chatDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  empty: { paddingTop: 60, alignItems: "center", gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  modal: { flex: 1, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  formLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  targetRow: { flexDirection: "row", gap: 10 },
  targetBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1.5 },
  targetLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1.5, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
});
