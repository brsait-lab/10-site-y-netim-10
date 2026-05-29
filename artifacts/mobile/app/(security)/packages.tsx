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
import * as Haptics from "expo-haptics";
import { useAuth, User } from "@/context/AuthContext";
import { useData, Package } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function PackageCard({ pkg, onUpdateStatus }: { pkg: Package; onUpdateStatus: (id: string, status: Package["status"]) => void }) {
  const colors = useColors();
  const statusColors = {
    received: { bg: "#fef3c7", text: "#92400e", label: "Alındı" },
    notified: { bg: "#dbeafe", text: "#1e40af", label: "Bildirildi" },
    delivered: { bg: "#dcfce7", text: colors.primary, label: "Teslim Edildi" },
  };
  const sc = statusColors[pkg.status];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.pkgIcon, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
          <Feather name="package" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recipient, { color: colors.foreground }]}>{pkg.recipientName}</Text>
          <Text style={[styles.sender, { color: colors.mutedForeground }]} numberOfLines={2}>{pkg.senderInfo}</Text>
          {pkg.description && <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>{pkg.description}</Text>}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderRadius: 10 }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>
      </View>
      <View style={[styles.dateRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          Alınma: {new Date(pkg.receivedAt).toLocaleDateString("tr-TR")}
        </Text>
        {pkg.deliveredAt && (
          <Text style={[styles.dateText, { color: colors.primary }]}>
            Teslim: {new Date(pkg.deliveredAt).toLocaleDateString("tr-TR")}
          </Text>
        )}
      </View>
      {pkg.status !== "delivered" && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {pkg.status === "received" && (
            <Pressable
              onPress={() => onUpdateStatus(pkg.id, "notified")}
              style={[styles.actionBtn, { backgroundColor: "#dbeafe", borderRadius: colors.radius - 2 }]}
            >
              <Feather name="bell" size={14} color="#1e40af" />
              <Text style={[styles.actionText, { color: "#1e40af" }]}>Bildir</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onUpdateStatus(pkg.id, "delivered")}
            style={[styles.actionBtn, { backgroundColor: colors.primaryLight, borderRadius: colors.radius - 2 }]}
          >
            <Feather name="check" size={14} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Teslim Et</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function PackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteUsers } = useAuth();
  const { packages, addPackage, updatePackageStatus, refresh } = useData();
  const [residents, setResidents] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");
  const [filter, setFilter] = useState<"all" | "pending" | "delivered">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [senderInfo, setSenderInfo] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [residentSearch, setResidentSearch] = useState("");
  const [showResidentPicker, setShowResidentPicker] = useState(false);

  const loadResidents = useCallback(async () => {
    if (!user) return;
    const users = await getSiteUsers(user.siteId);
    setResidents(users.filter((u) => u.role === "resident" && u.status === "active"));
  }, [user, getSiteUsers]);

  useEffect(() => { loadResidents(); }, [loadResidents]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); await loadResidents(); setRefreshing(false); };

  const sitePackages = packages.filter((p) => p.siteId === user?.siteId);
  const filtered = sitePackages.filter((p) => {
    if (filter === "pending") return p.status !== "delivered";
    if (filter === "delivered") return p.status === "delivered";
    return true;
  }).sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  const selectedResident = residents.find((r) => r.id === recipientId);
  const filteredResidents = residents.filter((r) => {
    const q = residentSearch.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.unitNo || "").toLowerCase().includes(q);
  });

  const handleAddPackage = async () => {
    if (!recipientId || !senderInfo.trim() || !user) return;
    const resident = residents.find((r) => r.id === recipientId);
    if (!resident) return;
    setLoading(true);
    await addPackage({
      siteId: user.siteId,
      recipientUserId: recipientId,
      recipientName: resident.name + (resident.unitNo ? ` (${resident.unitNo})` : ""),
      senderInfo: senderInfo.trim(),
      description: description.trim(),
      status: "received",
    });
    setLoading(false);
    setSuccess(true);
    setRecipientId(""); setSenderInfo(""); setDescription("");
    setTimeout(() => { setSuccess(false); setActiveTab("list"); }, 2000);
  };

  const handleUpdateStatus = (id: string, status: Package["status"]) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePackageStatus(id, status);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Kargo Takibi</Text>
        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {([["list", "Liste"], ["add", "Kargo Al"]] as [string, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setActiveTab(key as "list" | "add")} style={[styles.segmentBtn, { borderRadius: colors.radius - 2, backgroundColor: activeTab === key ? colors.card : "transparent" }]}>
              <Text style={[styles.segmentText, { color: activeTab === key ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {activeTab === "list" && (
          <View style={styles.filterRow}>
            {([["all", "Tümü"], ["pending", "Bekleyen"], ["delivered", "Teslim"]] as [string, string][]).map(([key, label]) => (
              <Pressable key={key} onPress={() => setFilter(key as "all" | "pending" | "delivered")} style={[styles.filterBtn, { borderRadius: 20, backgroundColor: filter === key ? colors.primary : colors.muted }]}>
                <Text style={[styles.filterText, { color: filter === key ? "#fff" : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {activeTab === "list" ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="package" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Kargo bulunamadı</Text>
            </View>
          ) : filtered.map((p) => <PackageCard key={p.id} pkg={p} onUpdateStatus={handleUpdateStatus} />)}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ALICI SAKİN</Text>
          <Pressable
            onPress={() => setShowResidentPicker(!showResidentPicker)}
            style={[styles.picker, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}
          >
            <Feather name="user" size={18} color={colors.mutedForeground} />
            <Text style={[styles.pickerText, { color: selectedResident ? colors.foreground : colors.mutedForeground }]}>
              {selectedResident ? `${selectedResident.name}${selectedResident.unitNo ? ` (${selectedResident.unitNo})` : ""}` : "Sakin seçin..."}
            </Text>
            <Feather name={showResidentPicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
          </Pressable>
          {showResidentPicker && (
            <View style={[styles.dropdown, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
              <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput style={[styles.dropdownSearchInput, { color: colors.foreground }]} placeholder="Ara..." placeholderTextColor={colors.mutedForeground} value={residentSearch} onChangeText={setResidentSearch} />
              </View>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {filteredResidents.map((r) => (
                  <Pressable key={r.id} onPress={() => { setRecipientId(r.id); setShowResidentPicker(false); setResidentSearch(""); }} style={[styles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: recipientId === r.id ? colors.primaryLight : "transparent" }]}>
                    <Text style={[styles.dropdownItemText, { color: recipientId === r.id ? colors.primary : colors.foreground }]}>{r.name}</Text>
                    {r.unitNo && <Text style={[styles.dropdownItemSub, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <Input label="Gönderen / Kargo Firması *" placeholder="örn. PTT, Yurtiçi Kargo..." value={senderInfo} onChangeText={setSenderInfo} leftIcon="truck" />
          <Input label="Açıklama" placeholder="Paket içeriği veya not..." value={description} onChangeText={setDescription} leftIcon="file-text" />
          {success && <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={[styles.successText, { color: colors.primary }]}>Kargo kaydedildi!</Text></View>}
          <Button title="Kaydet" onPress={handleAddPackage} loading={loading} disabled={!recipientId || !senderInfo.trim()} fullWidth />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  segmented: { flexDirection: "row", padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  pkgIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  recipient: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sender: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dateRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  picker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1.5, height: 50 },
  pickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  dropdown: { borderWidth: 1, overflow: "hidden" },
  dropdownSearch: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  dropdownSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdownItem: { padding: 14, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dropdownItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
