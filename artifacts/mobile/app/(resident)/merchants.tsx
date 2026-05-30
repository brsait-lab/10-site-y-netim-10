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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function MerchantCard({
  merchant,
  distKm,
  onChat,
}: {
  merchant: User;
  distKm: number | null;
  onChat: (m: User) => void;
}) {
  const colors = useColors();
  const catKey =
    Object.keys(SECTOR_ICON_MAP).find((k) =>
      (merchant.businessCategory || "").toLowerCase().includes(k)
    );
  const icon: keyof typeof Feather.glyphMap = catKey ? SECTOR_ICON_MAP[catKey] : "briefcase";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.merchantIcon,
            { backgroundColor: colors.primaryLight, borderRadius: 14 },
          ]}
        >
          <Feather name={icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.merchantName, { color: colors.foreground }]}>
            {merchant.businessName || merchant.name}
          </Text>
          <View style={styles.metaRow}>
            {merchant.businessCategory ? (
              <View
                style={[
                  styles.catPill,
                  { backgroundColor: colors.muted, borderRadius: 10 },
                ]}
              >
                <Text style={[styles.catText, { color: colors.mutedForeground }]}>
                  {merchant.businessCategory}
                </Text>
              </View>
            ) : null}
            {distKm !== null && (
              <View
                style={[
                  styles.distPill,
                  {
                    backgroundColor:
                      distKm < 0.5 ? colors.primaryLight : colors.muted,
                    borderRadius: 10,
                  },
                ]}
              >
                <Feather
                  name="map-pin"
                  size={11}
                  color={distKm < 0.5 ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.distText,
                    {
                      color:
                        distKm < 0.5 ? colors.primary : colors.mutedForeground,
                    },
                  ]}
                >
                  {distanceLabel(distKm)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {merchant.businessDescription ? (
        <Text
          style={[styles.description, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {merchant.businessDescription}
        </Text>
      ) : null}

      {merchant.businessAddress ? (
        <View style={styles.addressRow}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text
            style={[styles.addressText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {merchant.businessAddress}
          </Text>
        </View>
      ) : null}

      <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => onChat(merchant)}
          style={[
            styles.chatBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius - 2 },
          ]}
        >
          <Feather name="message-circle" size={16} color="#fff" />
          <Text style={styles.chatBtnText}>Mesaj Gönder</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MerchantsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getAllMerchants, user } = useAuth();
  const [merchants, setMerchants] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Tümü");
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] =
    useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState("");

  const requestLocation = async () => {
    try {
      if (Platform.OS === "web") {
        setLocationError("Konum web'de desteklenmez.");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Konum izni verilmedi. Mesafe gösterilemiyor.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setLocationError("");
    } catch {
      setLocationError("Konum alınamadı.");
    }
  };

  const load = useCallback(async () => {
    const all = await getAllMerchants();
    setMerchants(all.filter((u) => u.status === "active"));
  }, [getAllMerchants]);

  useEffect(() => {
    load();
    requestLocation();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleChat = (merchant: User) => {
    const chatId = [user?.id, merchant.id].sort().join("_");
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chatId,
        name: merchant.businessName || merchant.name,
        otherId: merchant.id,
      },
    });
  };

  const filtered = merchants
    .filter((m) => {
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
    })
    .map((m) => ({
      merchant: m,
      distKm:
        userLocation && m.latitude && m.longitude
          ? haversineKm(userLocation.lat, userLocation.lon, m.latitude, m.longitude)
          : null,
    }))
    .sort((a, b) => {
      if (a.distKm !== null && b.distKm !== null) return a.distKm - b.distKm;
      if (a.distKm !== null) return -1;
      if (b.distKm !== null) return 1;
      return 0;
    });

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 16, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Yakınımdaki Esnaflar
          </Text>
          <Pressable
            onPress={requestLocation}
            style={[
              styles.locBtn,
              {
                backgroundColor: userLocation
                  ? colors.primaryLight
                  : colors.muted,
                borderRadius: 20,
              },
            ]}
          >
            <Feather
              name="map-pin"
              size={14}
              color={userLocation ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.locBtnText,
                {
                  color: userLocation ? colors.primary : colors.mutedForeground,
                },
              ]}
            >
              {userLocation ? "Konum Alındı" : "Konum Al"}
            </Text>
          </Pressable>
        </View>

        {locationError ? (
          <View
            style={[
              styles.locErrorBanner,
              { backgroundColor: "#fef3c7", borderRadius: colors.radius },
            ]}
          >
            <Feather name="alert-circle" size={13} color="#92400e" />
            <Text style={[styles.locErrorText, { color: "#92400e" }]}>
              {locationError}
            </Text>
          </View>
        ) : userLocation ? (
          <View
            style={[
              styles.locOkBanner,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="navigation" size={13} color={colors.primary} />
            <Text style={[styles.locOkText, { color: colors.primary }]}>
              Konumunuza göre mesafeler hesaplanıyor
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="İşletme adı, kategori veya adres ara..."
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cats}
          contentContainerStyle={styles.catsContent}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCatFilter(cat)}
              style={[
                styles.catBtn,
                {
                  borderRadius: 20,
                  backgroundColor:
                    catFilter === cat ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.catBtnText,
                  {
                    color:
                      catFilter === cat ? "#fff" : colors.mutedForeground,
                  },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search || catFilter !== "Tümü"
                ? "Arama sonucu bulunamadı"
                : "Henüz kayıtlı esnaf bulunmuyor"}
            </Text>
          </View>
        ) : (
          filtered.map(({ merchant, distKm }) => (
            <MerchantCard
              key={merchant.id}
              merchant={merchant}
              distKm={distKm}
              onChat={handleChat}
            />
          ))
        )}
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
  locErrorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  locErrorText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  locOkBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  locOkText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  cats: { marginHorizontal: -16 },
  catsContent: { paddingHorizontal: 16, gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  catBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
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
  chatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  chatBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
