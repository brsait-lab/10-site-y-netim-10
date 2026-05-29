import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, Site } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SecurityProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, sites, logout } = useAuth();
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    if (user && sites.length > 0) setSite(sites.find((s) => s.id === user.siteId) || null);
  }, [user, sites]);

  const handleLogout = () => {
    if (Platform.OS === "web") { logout().then(() => router.replace("/(auth)/login")); return; }
    Alert.alert("Çıkış Yap", "Çıkış yapmak istiyor musunuz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış Yap", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
    ]);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={[styles.avatarLarge, { backgroundColor: "#e0f2fe", borderRadius: 40 }]}>
          <Text style={[styles.avatarText, { color: "#0284c7" }]}>{user?.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
        <View style={[styles.rolePill, { backgroundColor: "#e0f2fe", borderRadius: 20 }]}>
          <Feather name="shield" size={12} color="#0284c7" />
          <Text style={[styles.roleText, { color: "#0284c7" }]}>Güvenlik Görevlisi</Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {[
          { icon: "home" as const, label: "Site", value: site?.name || "-" },
          { icon: "mail" as const, label: "E-posta", value: user?.email || "-" },
          { icon: "phone" as const, label: "Telefon", value: user?.phone || "-" },
        ].map((item, idx, arr) => (
          <View key={item.label} style={[styles.row, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.rowValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: "#fee2e2", borderRadius: colors.radius }]}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 20 },
  profileHeader: { alignItems: "center", gap: 10 },
  avatarLarge: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  roleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowIcon: { padding: 8 },
  rowLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
