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
import { MERCHANT_SECTORS } from "@/app/(auth)/register";

const SECTOR_ICON: Record<string, keyof typeof Feather.glyphMap> = Object.fromEntries(
  MERCHANT_SECTORS.map((s) => [s.value, s.icon])
);

function getIcon(category: string): keyof typeof Feather.glyphMap {
  const key = Object.keys(SECTOR_ICON).find((k) =>
    category.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SECTOR_ICON[key] : "briefcase";
}

function MerchantCard({ merchant, onChat }: { merchant: User; onChat: (m: User) => void }) {
  const colors = useColors();
  const icon = getIcon(merchant.businessCategory || "");

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.merchantIcon, { backgroundColor: colors.primaryLight, borderRadius: 14 }]}>
          <Feather name={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.merchantName, { color: colors.foreground }]}>
            {merchant.businessName || merchant.name}
          </Text>
          <View style={styles.metaRow}>
            {merchant.businessCategory ? (
              <View style={[styles.catPill, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
                <Text style={[styles.catText, { color: colors.primary }]}>{merchant.businessCategory}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {merchant.businessDescription ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {merchant.businessDescription}
        </Text>
      ) : null}

      {merchant.businessAddress ? (
        <View style={styles.addrRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.addrText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {merchant.businessAddress}
          </Text>
        </View>
      ) : null}

      <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => onChat(merchant)}
          style={[styles.chatBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
        >
          <Feather name="message-circle" size={15} color="#fff" />
          <Text style={styles.chatBtnText}>Mesaj Gönder</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SecurityMerchantsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getAllMerchants } = useAuth();
  const [merchants, setMerchants] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Tümü");
  const [refreshing, setRefreshing] = useState(false);

  const FILTER_CATS = ["Tümü", ...MERCHANT_SECTORS.map((s) => s.value)];

  const load = useCallback(async () => {
    const all = await getAllMerchants();
    setMerchants(all.filter((u) => u.status === "active"));
  }, [getAllMerchants]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleChat = (merchant: User) => {
    const chatId = [user?.id, merchant.id].sort().join("_");
    router.push({
      pathname: "/chat/[id]",
      params: { id: chatId, name: merchant.businessName || merchant.name, otherId: merchant.id },
    });
  };

  const filtered = merchants.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (m.businessName || m.name).toLowerCase().includes(q) ||
      (m.businessCategory || "").toLowerCase().includes(q) ||
      (m.businessAddress || "").toLowerCase().includes(q);
    const matchCat =
      catFilter === "Tümü" ||
      (m.businessCategory || "").toLowerCase().includes(catFilter.toLowerCase());
    return matchSearch && matchCat;
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
            placeholder="İşletme adı, sektör veya adres..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats} contentContainerStyle={styles.catsContent}>
          {FILTER_CATS.map((cat) => {
            const sec = MERCHANT_SECTORS.find((s) => s.value === cat);
            return (
              <Pressable
                key={cat}
                onPress={() => setCatFilter(cat)}
                style={[styles.catBtn, { borderRadius: 20, backgroundColor: catFilter === cat ? colors.primary : colors.muted }]}
              >
                {sec ? (
                  <Feather name={sec.icon} size={12} color={catFilter === cat ? "#fff" : colors.mutedForeground} />
                ) : null}
                <Text style={[styles.catBtnText, { color: catFilter === cat ? "#fff" : colors.mutedForeground }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
              {search || catFilter !== "Tümü" ? "Sonuç bulunamadı" : "Kayıtlı esnaf yok"}
            </Text>
          </View>
        ) : filtered.map((m) => (
          <MerchantCard key={m.id} merchant={m} onChat={handleChat} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  cats: { marginHorizontal: -16 },
  catsContent: { paddingHorizontal: 16, gap: 8, flexDirection: "row", alignItems: "center" },
  catBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  catBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  merchantIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  merchantName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addrText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  cardBottom: { borderTopWidth: 1, paddingTop: 12 },
  chatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  chatBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
