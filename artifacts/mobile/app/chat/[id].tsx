import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useData, Message } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const colors = useColors();

  return (
    <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
      {!isMine && (
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: 16 }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{message.fromName[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={{ maxWidth: "75%" }}>
        {!isMine && (
          <Text style={[styles.senderName, { color: colors.mutedForeground }]}>{message.fromName}</Text>
        )}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? colors.primary : colors.card,
              borderRadius: 18,
              borderBottomRightRadius: isMine ? 4 : 18,
              borderBottomLeftRadius: isMine ? 18 : 4,
              borderColor: isMine ? "transparent" : colors.border,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMine ? "#ffffff" : colors.foreground }]}>
            {message.content}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: colors.mutedForeground }, isMine && styles.timeTextMine]}>
          {new Date(message.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name: string; otherId: string }>();
  const { user } = useAuth();
  const { sendMessage, getChat, messages } = useData();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const chatId = params.id;
  const chatMessages = getChat(chatId);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages.length]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    const msg = text.trim();
    setText("");
    setSending(true);
    await sendMessage(chatId, params.otherId, msg);
    setSending(false);
  };

  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
          <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
            {(params.name || "?")[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>{params.name}</Text>
          <Text style={[styles.headerStatus, { color: colors.primary }]}>Çevrimiçi</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.kvkkBanner, { backgroundColor: colors.muted }]}>
          <Feather name="shield" size={12} color={colors.mutedForeground} />
          <Text style={[styles.kvkkText, { color: colors.mutedForeground }]}>
            KVKK: Telefon numarası ve e-posta bilgileri otomatik maskelenir.
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messageList, { paddingBottom: bottomPad + 80 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Feather name="message-circle" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                Sohbet başlatmak için mesaj gönderin
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble message={item} isMine={item.fromId === user?.id} />
          )}
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, borderRadius: 24, color: colors.foreground }]}
            placeholder="Mesaj yazın..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.muted,
                borderRadius: 24,
                opacity: text.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Feather name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerStatus: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  kvkkBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  kvkkText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  messageList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  bubbleWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginVertical: 2 },
  bubbleWrapMine: { flexDirection: "row-reverse" },
  avatar: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  senderName: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4, marginLeft: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, marginLeft: 2 },
  timeTextMine: { textAlign: "right", marginRight: 2 },
  emptyChat: { paddingTop: 80, alignItems: "center", gap: 12 },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  textInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 100 },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
