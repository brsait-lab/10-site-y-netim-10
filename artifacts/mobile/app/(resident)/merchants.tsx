import { router } from "expo-router";
import * as Location from "expo-location";
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
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { MERCHANT_SECTORS } from "@/app/(auth)/register";

const SECTOR_ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = Object.fromEntries(
  MERCHANT_SECTORS.map((s) => [s.value.toLowerCase(), s.icon])
);

const CATEGORIES = ["Tümü", ...MERCHANT_SECTORS.map((s) => s.value)];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(km: number) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`; }

function merchantRating(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return (hash % 11 + 40) / 10;
}

function Stars({ rating }: { rating: number }) {
  const colors = useColors();
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather key={i} name={i <= full ? "star" : hasHalf && i === full + 1 ? "star" : "star"}
          size={12} color={i <= full || (hasHalf && i === full + 1) ? "#f59e0b" : "#e2e8f0"} />
      ))}
      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#f59e0b", marginLeft: 4 }}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function MerchantCard({ merchant, distKm, onChat, onCall }: { merchant: User; distKm: number | null; onChat: (m: User) => void; onCall: (m: User) => void }) {
  const colors = useColors();
  const catKey = Object.keys(SECTOR_ICON_MAP).find((k) => (merchant.businessCategory || "").toLowerCase().includes(k));
  const icon: keyof typeof Feather.glyphMap = catKey ? SECTOR_ICON_MAP[catKey] : "briefcase";
  const rating = merchantRating(merchant.id);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: 16, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.merchantIcon, { backgroundColor: colors.primaryLight, borderRadius: 14 }]}>
          <Feather name={icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.merchantName, { color: colors.foreground }]}>{merchant.businessName || merchant.name}</Text>
          <Stars rating={rating} />
          <View style={styles.metaRow}>
            {merchant.businessCategory && (
              <View style={[styles.catPill, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                <Text style={[styles.catText, { color: colors.mutedForeground }]}>{merchant.businessCategory}</Text>
              </View>
            )}
            {distKm !== null && (
              <View style={[styles.distPill, { backgroundColor: distKm < 0.5 ? colors.primaryLight : colors.muted, borderRadius: 20 }]}>
                <Feather name="map-pin" size={11} color={distKm < 0.5 ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.distText, { color: distKm < 0.5 ? colors.primary : colors.mutedForeground }]}>{distanceLabel(distKm)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {merchant.businessDescription ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>{merchant.businessDescription}</Text>
      ) : null}

      {merchant.businessAddress ? (
        <View style={styles.addressRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>{merchant.businessAddress}</Text>
        </View>
      ) : null}

      <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
        <Pressable onPress={() => onCall(merchant)}
          style={[styles.callBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}>
          <Feather name="phone-call" size={15} color="#fff" />
          <Text style={styles.callBtnText}>Çağır</Text>
        </Pressable>
        <Pressable onPress={() => onChat(merchant)}
          style={[styles.chatBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          <Feather name="message-circle" size={15} color={colors.foreground} />
          <Text style={[styles.chatBtnText, { color: colors.foreground }]}>Mesaj</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MerchantsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getAllMerchants, user } = useAuth();
  const { openChat, sendNotification } = useData();
  const [merchants, setMerchants] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Tümü");
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [callingMerchant, setCallingMerchant] = useState("");

  const requestLocation = async () => {
    try {
      if (Platform.OS === "web") { setLocationError("Konum web'de desteklenmez."); return; }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError("Konum izni verilmedi. Mesafe gösterilemiyor."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setLocationError("");
    } catch { setLocationError("Konum alınamadı."); }
  };

  const load = useCallback(async () => {
    const all = await getAllMerchants();
    setMerchants(all.filter((u) => u.status === "active"));
  }, [getAllMerchants]);

  useEffect(() => { load(); requestLocation(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleChat = async (merchant: User) => {
    if (!user) return;
    try {
      const chat = await openChat(`${merchant.businessName || merchant.name}`, [user.id, merchant.id]);
      router.push({ pathname: "/chat/[id]", params: { id: chat.id, name: merchant.businessName || merchant.name } });
    } catch (e) {
      console.error("Chat açılamadı:", e);
    }
  };

  const handleCall = async (merchant: User) => {
    if (!user || callingMerchant === merchant.id) return;
    setCallingMerchant(merchant.id);
    try {
      await sendNotification({
        type: "general",
        title: `Esnaf Çağrısı: ${merchant.businessName || merchant.name}`,
        message: `${user.name} tarafından ${merchant.businessCategory || "esnaf"} talebi gönderildi.`,
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toRoles: ["admin"],
        toUserIds: [],
      });
    } catch (e) {
      console.error("Çağrı bildirimi gönderilemedi:", e);
    } finally {
      setTimeout(() => setCallingMerchant(""), 3000);
    }
  };

  const filtered = merchants
    .filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (m.businessName || m.name).toLowerCase().includes(q) || (m.businessCategory || "").toLowerCase().includes(q) || (m.businessAddress || "").toLowerCase().includes(q);
      const matchCat = catFilter === "Tümü" || (m.businessCategory || "").toLowerCase().includes(catFilter.toLowerCase());
      return matchSearch && matchCat;
    })
    .map((m) => ({
      merchant: m,
      distKm: userLocation && m.latitude && m.longitude ? haversineKm(userLocation.lat, userLocation.lon, m.latitude, m.longitude) : null,
    }))
    .sort((a, b) => {
      if (a.distKm !== null && b.distKm !== null) return a.distKm - b.distKm;
      if (a.distKm !== null) return -1; if (b.distKm !== null) return 1; return 0;
    });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Esnaf Bul</Text>
          <Pressable onPress={requestLocation}
            style={[styles.locBtn, { backgroundColor: userLocation ? colors.primaryLight : colors.muted, borderRadius: 20 }]}>
            <Feather name="map-pin" size={14} color={userLocation ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.locBtnText, { color: userLocation ? colors.primary : colors.mutedForeground }]}>
              {userLocation ? "Konum Alındı" : "Konum Al"}
            </Text>
          </Pressable>
        </View>

        {locationError ? (
          <View style={[styles.locBanner, { backgroundColor: "#fef3c7", borderRadius: 10 }]}>
            <Feather name="alert-circle" size={13} color="#92400e" />
            <Text style={[styles.locBannerText, { color: "#92400e" }]}>{locationError}</Text>
          </View>
        ) : userLocation ? (
          <View style={[styles.locBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
            <Feather name="navigation" size={13} color={colors.primary} />
            <Text style={[styles.locBannerText, { color: colors.primary }]}>Konumunuza göre sıralanıyor</Text>
          </View>
        ) : null}

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="İşletme adı, kategori veya adres..."
            placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats} contentContainerStyle={styles.catsContent}>
          {CATEGORIES.map((cat) => (
            <Pressable key={cat} onPress={() => setCatFilter(cat)}
              style={[styles.catBtn, { borderRadius: 20, backgroundColor: catFilter === cat ? colors.primary : colors.muted }]}>
              <Text style={[styles.catBtnText, { color: catFilter === cat ? "#fff" : colors.mutedForeground }]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {filtered.length} esnaf{userLocation ? " · Yakına göre sıralanmış" : ""}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {callingMerchant && (
          <View style={[styles.calledBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.calledText, { color: colors.primary }]}>Çağrı yöneticiye iletildi!</Text>
          </View>
        )}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search || catFilter !== "Tümü" ? "Sonuç bulunamadı" : "Henüz kayıtlı esnaf yok"}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {search || catFilter !== "Tümü" ? "Farklı filtreler deneyin" : "Esnaflar kayıt yaptıktan sonra burada görünür"}
            </Text>
          </View>
        ) : filtered.map(({ merchant, distKm }) => (
          <MerchantCard key={merchant.id} merchant={merchant} distKm={distKm} onChat={handleChat} onCall={handleCall} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  locBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  locBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  locBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  locBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  cats: { marginHorizontal: -16 },
  catsContent: { paddingHorizontal: 16, gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  catBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scroll: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  calledBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  calledText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  merchantIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  merchantName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  distPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  distText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  cardBottom: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingTop: 12 },
  callBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11 },
  callBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  chatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11 },
  chatBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
