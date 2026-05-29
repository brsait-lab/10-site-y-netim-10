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

const ROLE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  resident: "home",
  security: "shield",
  merchant: "shopping-bag",
  admin: "settings",
};

function UserCard({ u, onApprove, onReject }: { u: User; onApprove: (u: User) => void; onReject: (u: User) => void }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const statusStyle = {
    active: { bg: "#dcfce7", text: colors.primary, label: "Aktif" },
    pending: { bg: "#fef3c7", text: "#92400e", label: "Bekliyor" },
    rejected: { bg: "#fee2e2", text: colors.destructive, label: "Reddedildi" },
  }[u.status];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      {/* Header row */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderRadius: 24 }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{u.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
          <View style={styles.roleMeta}>
            <Feather name={ROLE_ICONS[u.role] || "user"} size={12} color={colors.mutedForeground} />
            <Text style={[styles.roleName, { color: colors.mutedForeground }]}>
              {ROLE_LABELS[u.role]}
              {u.unitNo ? ` · Daire ${u.unitNo}` : ""}
              {u.businessName ? ` · ${u.businessName}` : ""}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderRadius: 10 }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {/* Expanded sensitive data — always visible to admin */}
      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YÖNETİCİ ERİŞİMİ — GİZLİ BİLGİLER</Text>

          <View style={styles.infoGrid}>
            {/* Email */}
            <View style={[styles.infoItem, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
              <Feather name="mail" size={13} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>E-posta</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{u.email}</Text>
              </View>
            </View>

            {/* Phone — admin-only */}
            <View style={[styles.infoItem, { backgroundColor: "#fef3c7", borderRadius: colors.radius - 4 }]}>
              <Feather name="phone" size={13} color="#92400e" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: "#a16207" }]}>Telefon (KVKK — Sadece Yönetici/Güvenlik)</Text>
                <Text style={[styles.infoValue, { color: "#92400e" }]}>{u.phone}</Text>
              </View>
            </View>

            {/* Unit No — residents only */}
            {u.unitNo && (
              <View style={[styles.infoItem, { backgroundColor: colors.primaryLight, borderRadius: colors.radius - 4 }]}>
                <Feather name="hash" size={13} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.primary }]}>Daire Numarası</Text>
                  <Text style={[styles.infoValue, { color: colors.primary }]}>{u.unitNo}</Text>
                </View>
              </View>
            )}

            {/* Plates — residents only, admin+security visible */}
            {u.plates && u.plates.length > 0 && (
              <View style={[styles.infoItem, { backgroundColor: "#ede9fe", borderRadius: colors.radius - 4 }]}>
                <Feather name="truck" size={13} color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: "#7c3aed" }]}>Araç Plakası (Yönetici/Güvenlik)</Text>
                  <Text style={[styles.infoValue, { color: "#5b21b6" }]}>{u.plates.join("  ·  ")}</Text>
                </View>
              </View>
            )}

            {/* Registration date */}
            <View style={[styles.infoItem, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Kayıt Tarihi</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {new Date(u.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          {u.status === "pending" && (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => onApprove(u)}
                style={[styles.approveBtn, { backgroundColor: "#dcfce7", borderRadius: colors.radius - 2 }]}
              >
                <Feather name="check" size={16} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Onayla</Text>
              </Pressable>
              <Pressable
                onPress={() => onReject(u)}
                style={[styles.rejectBtn, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}
              >
                <Feather name="x" size={16} color={colors.destructive} />
                <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Reddet</Text>
              </Pressable>
            </View>
          )}
          {u.status === "rejected" && (
            <Pressable
              onPress={() => onApprove(u)}
              style={[styles.approveBtn, { backgroundColor: "#dcfce7", borderRadius: colors.radius - 2 }]}
            >
              <Feather name="rotate-ccw" size={14} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Yeniden Onayla</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Pending quick actions (visible without expanding) */}
      {u.status === "pending" && !expanded && (
        <View style={[styles.quickActions, { borderTopColor: colors.border }]}>
          <Pressable onPress={() => onApprove(u)} style={[styles.quickApprove, { backgroundColor: "#dcfce7", borderRadius: colors.radius - 2 }]}>
            <Feather name="check" size={14} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.primary }]}>Onayla</Text>
          </Pressable>
          <Pressable onPress={() => onReject(u)} style={[styles.quickReject, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}>
            <Feather name="x" size={14} color={colors.destructive} />
            <Text style={[styles.quickActionText, { color: colors.destructive }]}>Reddet</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

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
    if (Platform.OS === "web") { rejectUser(u.id).then(load); return; }
    Alert.alert("Reddet", `${u.name} kullanıcısını reddetmek istiyor musunuz?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Reddet", style: "destructive", onPress: async () => { await rejectUser(u.id); await load(); } },
    ]);
  };

  const filtered = users.filter((u) => {
    const matchFilter = filter === "all" || u.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.unitNo || "").toLowerCase().includes(q) ||
      (u.plates || []).some((p) => p.toLowerCase().includes(q)) ||
      (u.phone || "").includes(q);
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

        {counts.pending > 0 && (
          <View style={[styles.pendingBanner, { backgroundColor: "#fef3c7", borderRadius: colors.radius }]}>
            <Feather name="clock" size={14} color="#92400e" />
            <Text style={[styles.pendingBannerText, { color: "#92400e" }]}>
              {counts.pending} kullanıcı onay bekliyor — Karta tıklayarak detayları görüntüleyin
            </Text>
          </View>
        )}

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="İsim, e-posta, daire no, plaka ara..."
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
          <UserCard key={u.id} u={u} onApprove={handleApprove} onReject={handleReject} />
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
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  pendingBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  tabs: { marginHorizontal: -16 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  roleMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  roleName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  expandedSection: { borderTopWidth: 1, padding: 14, gap: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  infoGrid: { gap: 8 },
  infoItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10 },
  infoLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  quickActions: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1 },
  quickApprove: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  quickReject: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  quickActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
