import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, Site } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { LogoBadge } from "@/components/TreeLogo";

export default function AdminProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites, logout } = useAuth();
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    if (user && sites.length > 0) {
      setSite(sites.find((s) => s.id === user.siteId) || null);
    }
  }, [user, sites]);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout().then(() => router.replace("/(auth)/login"));
      return;
    }
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkış yapmak istiyor musunuz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const menuItems = [
    { icon: "home" as const, label: "Site Bilgileri", value: site?.name || "-" },
    { icon: "map-pin" as const, label: "Site Adresi", value: site?.address || "Belirtilmedi" },
    { icon: "mail" as const, label: "E-posta", value: user?.email || "-" },
    { icon: "phone" as const, label: "Telefon", value: user?.phone || "-" },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.primaryLight, borderRadius: 40 }]}>
          <Text style={[styles.avatarTextLarge, { color: colors.primary }]}>{user?.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
        <View style={[styles.rolePill, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
          <Feather name="shield" size={12} color={colors.primary} />
          <Text style={[styles.roleText, { color: colors.primary }]}>Yönetici</Text>
        </View>
      </View>

      <LogoBadge size={56} bgColor={colors.primary} iconColor="#fff" />

      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {menuItems.map((item, idx) => (
          <View key={item.label} style={[styles.menuRow, idx < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.menuValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={handleLogout}
        style={[styles.logoutBtn, { backgroundColor: "#fee2e2", borderRadius: colors.radius }]}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 20, alignItems: "center" },
  profileHeader: { alignItems: "center", gap: 10, width: "100%" },
  avatarLarge: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  avatarTextLarge: { fontSize: 32, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  roleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { width: "100%", borderWidth: 1, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  menuIcon: { padding: 8 },
  menuLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  menuValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  logoutBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
