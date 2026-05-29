import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
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
import { useAuth, User } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  market: "shopping-bag",
  restoran: "coffee",
  kafe: "coffee",
  berber: "scissors",
  kuafor: "scissors",
  eczane: "activity",
  default: "briefcase",
};

function MerchantCard({ merchant, onChat }: { merchant: User; onChat: (m: User) => void }) {
  const colors = useColors();
  const catKey = merchant.businessCategory?.toLowerCase() || "";
  const iconKey = Object.keys(CATEGORY_ICONS).find((k) => catKey.includes(k)) || "default";
  const icon = CATEGORY_ICONS[iconKey];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.merchantIcon, { backgroundColor: colors.primaryLight, borderRadius: 14 }]}>
          <Feather name={icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.merchantName, { color: colors.foreground }]}>{merchant.businessName || merchant.name}</Text>
          {merchant.businessCategory && (
            <View style={[styles.categoryPill, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>{merchant.businessCategory}</Text>
            </View>
          )}
        </View>
      </View>
      {merchant.businessDescription && (
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {merchant.businessDescription}
        </Text>
      )}
      <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => onChat(merchant)}
          style={[styles.chatBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
        >
          <Feather name="message-circle" size={16} color="#fff" />
          <Text style={styles.chatBtnText}>Sohbet Başlat</Text>
        </Pressable>
        <Pressable
          style={[styles.callBtn, { borderColor: colors.border, borderRadius: colors.radius - 2 }]}
        >
          <Feather name="phone" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

export default function MerchantsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const [merchants, setMerchants] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setMerchants(users.filter((u) => u.role === "merchant" && u.status === "active"));
  }, [user, getSiteUsers]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleChat = (merchant: User) => {
    const chatId = [user?.id, merchant.id].sort().join("_");
    router.push({ pathname: "/chat/[id]", params: { id: chatId, name: merchant.businessName || merchant.name, otherId: merchant.id } });
  };

  const filtered = merchants.filter((m) => {
    const q = search.toLowerCase();
    return !q || (m.businessName || m.name).toLowerCase().includes(q) || (m.businessCategory || "").toLowerCase().includes(q);
  });

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Esnaflar</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Esnaf veya kategori ara..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
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
            <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search ? "Arama sonucu bulunamadı" : "Sitenizde kayıtlı esnaf bulunmuyor"}
            </Text>
          </View>
        ) : filtered.map((m) => <MerchantCard key={m.id} merchant={m} onChat={handleChat} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderWidth: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  merchantIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  merchantName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  categoryPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  categoryText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cardBottom: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingTop: 12 },
  chatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  chatBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  callBtn: { width: 44, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
