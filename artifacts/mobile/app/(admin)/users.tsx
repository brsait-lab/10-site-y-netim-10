import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

type FilterTab = "all" | "pending" | "active" | "rejected";

const ROLE_LABELS: Record<string, string> = {
  resident: "Sakin",
  security: "Güvenlik",
  merchant: "Esnaf",
  admin: "Yönetici",
};

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers, approveUser, rejectUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const u = await getSiteUsers(user.siteId);
    setUsers(u.filter((x) => x.role !== "admin"));
  }, [user, getSiteUsers]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleApprove = async (u: User) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await approveUser(u.id);
    await load();
  };

  const handleReject = (u: User) => {
    if (Platform.OS === "web") {
      rejectUser(u.id).then(load);
      return;
    }
    Alert.alert("Reddet", `${u.name} kullanıcısını reddetmek istiyor musunuz?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Reddet", style: "destructive", onPress: async () => { await rejectUser(u.id); await load(); } },
    ]);
  };

  const filtered = users.filter((u) => {
    const matchFilter = filter === "all" || u.status === filter;
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all: users.length,
    pending: users.filter((u) => u.status === "pending").length,
    active: users.filter((u) => u.status === "active").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `Tümü (${counts.all})` },
    { key: "pending", label: `Bekliyor (${counts.pending})` },
    { key: "active", label: `Aktif (${counts.active})` },
    { key: "rejected", label: `Reddedildi (${counts.rejected})` },
  ];

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Kullanıcı Yönetimi</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="İsim veya e-posta ara..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.mutedForeground} /></Pressable> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[
                styles.tabBtn,
                {
                  borderRadius: 20,
                  backgroundColor: filter === tab.key ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text style={[styles.tabText, { color: filter === tab.key ? "#fff" : colors.mutedForeground }]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((u) => (
          <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={styles.cardTop}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: 24 }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{u.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{u.email}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.roleBadge, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                    <Text style={[styles.roleText, { color: colors.mutedForeground }]}>{ROLE_LABELS[u.role]}</Text>
                  </View>
                  {u.unitNo ? <Text style={[styles.unit, { color: colors.mutedForeground }]}>Daire: {u.unitNo}</Text> : null}
                  {u.businessName ? <Text style={[styles.unit, { color: colors.mutedForeground }]}>{u.businessName}</Text> : null}
                </View>
              </View>
              <View style={[
                styles.statusDot,
                {
                  backgroundColor: u.status === "active" ? colors.primary : u.status === "pending" ? colors.warning : colors.destructive,
                  borderRadius: 6,
                },
              ]} />
            </View>
            <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
              <Feather name="phone" size={13} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{u.phone}</Text>
            </View>
            {u.status === "pending" && (
              <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={() => handleApprove(u)}
                  style={[styles.approveBtn, { backgroundColor: "#dcfce7", borderRadius: colors.radius - 2 }]}
                >
                  <Feather name="check" size={16} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Onayla</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleReject(u)}
                  style={[styles.rejectBtn, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}
                >
                  <Feather name="x" size={16} color={colors.destructive} />
                  <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Reddet</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search ? "Arama sonucu bulunamadı" : "Bu kategoride kullanıcı yok"}
            </Text>
          </View>
        )}
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
  tabs: { marginHorizontal: -16 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  unit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusDot: { width: 12, height: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
