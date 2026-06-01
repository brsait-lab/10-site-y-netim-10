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

type FilterTab = "all" | "active" | "security";

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

function getLocationSummary(u: User): string {
  const parts: string[] = [];
  if (u.tower) parts.push(`Kule ${u.tower}`);
  if (u.block) parts.push(`Blok ${u.block}`);
  if (u.floor) parts.push(`Kat ${u.floor}`);
  if (u.villaNo) parts.push(`Villa ${u.villaNo}`);
  if (u.officeNo) parts.push(`Ofis ${u.officeNo}`);
  if (u.unitNo) parts.push(`Daire ${u.unitNo}`);
  return parts.join(" · ");
}

function UserCard({
  u,
  isSelf,
  onDelete,
  onTransferAdmin,
}: {
  u: User;
  isSelf: boolean;
  onDelete: (u: User) => void;
  onTransferAdmin: (u: User) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const locationSummary = getLocationSummary(u);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
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
              {locationSummary ? ` · ${locationSummary}` : ""}
              {u.businessName ? ` · ${u.businessName}` : ""}
            </Text>
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YÖNETİCİ ERİŞİMİ — GİZLİ BİLGİLER</Text>

          <View style={styles.infoGrid}>
            <InfoItem icon="mail" label="E-posta" value={u.email} colors={colors} />
            <InfoItem icon="phone" label="Telefon (KVKK — Sadece Yönetici/Güvenlik)" value={u.phone} colors={colors} accent="#fef3c7" textColor="#92400e" />
            {u.plates && u.plates.length > 0 && (
              <InfoItem icon="truck" label="Araç Plakası" value={u.plates.join("  ·  ")} colors={colors} accent="#ede9fe" textColor="#5b21b6" />
            )}
            <InfoItem icon="calendar" label="Kayıt Tarihi" value={new Date(u.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} colors={colors} />
          </View>

          {/* Admin actions — not shown for self */}
          {!isSelf && (
            <View style={styles.actionRow}>
              {u.role !== "admin" && (
                <Pressable
                  onPress={() => onTransferAdmin(u)}
                  style={[styles.actionBtn, { backgroundColor: "#fef3c7", borderRadius: colors.radius - 2 }]}
                >
                  <Feather name="shield" size={15} color="#92400e" />
                  <Text style={[styles.actionBtnText, { color: "#92400e" }]}>Yönetimi Devret</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => onDelete(u)}
                style={[styles.actionBtnDanger, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
                <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Sil</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function InfoItem({
  icon, label, value, colors, accent, textColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  accent?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.infoItem, { backgroundColor: accent ?? colors.muted, borderRadius: 8 }]}>
      <Feather name={icon} size={13} color={textColor ?? colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: textColor ?? colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: textColor ?? colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function UsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers, softDeleteUser, transferAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const u = await getSiteUsers(user.siteId);
    setUsers(u.filter((x) => x.id !== user.id));
  }, [user, getSiteUsers]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (u: User) => {
    const doDelete = async () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const res = await softDeleteUser(u.id);
      if (res.success) {
        await load();
      } else {
        if (Platform.OS === "web") alert(res.message);
        else Alert.alert("Hata", res.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`${u.name} kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) doDelete();
    } else {
      Alert.alert("Kullanıcıyı Sil", `${u.name} kullanıcısını sistemden kaldırmak istediğinizden emin misiniz?\n\nÖdeme ve bildirim geçmişleri korunur.`, [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleTransferAdmin = (u: User) => {
    const doTransfer = async () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const res = await transferAdmin(u.id);
      if (res.success) {
        await load();
        if (Platform.OS === "web") alert(res.message);
        else Alert.alert("Devir Tamamlandı", res.message);
      } else {
        if (Platform.OS === "web") alert(res.message);
        else Alert.alert("Hata", res.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Yönetimi ${u.name} adlı kullanıcıya devretmek istediğinizden emin misiniz?\n\nSiz sakin rolüne geçeceksiniz.`)) doTransfer();
    } else {
      Alert.alert("Yönetimi Devret", `Yönetimi ${u.name} adlı kullanıcıya devretmek istediğinizden emin misiniz?\n\nBu işlem sonrasında siz sakin rolüne geçeceksiniz.`, [
        { text: "Vazgeç", style: "cancel" },
        { text: "Devret", style: "destructive", onPress: doTransfer },
      ]);
    }
  };

  const residents = users.filter((u) => u.role === "resident");
  const securityStaff = users.filter((u) => u.role === "security");

  const filtered = users.filter((u) => {
    const matchFilter =
      filter === "all" ||
      (filter === "active" && u.role === "resident") ||
      (filter === "security" && u.role === "security");
    const q = search.toLowerCase();
    const loc = getLocationSummary(u).toLowerCase();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      loc.includes(q) ||
      (u.plates || []).some((p) => p.toLowerCase().includes(q)) ||
      (u.phone || "").includes(q);
    return matchFilter && matchSearch;
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `Tümü (${users.length})` },
    { key: "active", label: `Sakinler (${residents.length})` },
    { key: "security", label: `Görevliler (${securityStaff.length})` },
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
              style={[styles.tabBtn, { borderRadius: 20, backgroundColor: filter === tab.key ? colors.primary : colors.muted }]}
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
          <UserCard
            key={u.id}
            u={u}
            isSelf={u.id === user?.id}
            onDelete={handleDelete}
            onTransferAdmin={handleTransferAdmin}
          />
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
  expandedSection: { borderTopWidth: 1, padding: 14, gap: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  infoGrid: { gap: 8 },
  infoItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10 },
  infoLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, minWidth: 120 },
  actionBtnDanger: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, minWidth: 80 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
