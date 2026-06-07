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
import * as Haptics from "expo-haptics";
import { useAuth, User } from "@/context/AuthContext";
import { useData, Package } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STATUS_META = {
  received: { bg: "#fef3c7", text: "#92400e", label: "Bekliyor", icon: "clock" as const },
  notified: { bg: "#dbeafe", text: "#1e40af", label: "Bildirildi", icon: "bell" as const },
  delivered: { bg: "#dcfce7", text: "#15803d", label: "Teslim Edildi", icon: "check-circle" as const },
};

function PackageCard({
  pkg,
  onNotify,
  onDeliver,
}: {
  pkg: Package;
  onNotify: (id: string) => void;
  onDeliver: (id: string) => void;
}) {
  const colors = useColors();
  const sm = STATUS_META[pkg.status];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.pkgIcon, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
          <Feather name="package" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recipient, { color: colors.foreground }]}>{pkg.recipientName}</Text>
          <Text style={[styles.sender, { color: colors.mutedForeground }]} numberOfLines={1}>{pkg.senderInfo}</Text>
          {pkg.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>{pkg.description}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sm.bg, borderRadius: 10 }]}>
          <Feather name={sm.icon} size={11} color={sm.text} />
          <Text style={[styles.statusText, { color: sm.text }]}>{sm.label}</Text>
        </View>
      </View>

      <View style={[styles.dateRow, { borderTopColor: colors.border }]}>
        <View style={styles.dateItem}>
          <Feather name="arrow-down-circle" size={12} color={colors.mutedForeground} />
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            Alındı: {new Date(pkg.receivedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
          </Text>
        </View>
        {pkg.deliveredAt ? (
          <View style={styles.dateItem}>
            <Feather name="check" size={12} color={colors.primary} />
            <Text style={[styles.dateText, { color: colors.primary }]}>
              Teslim: {new Date(pkg.deliveredAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
            </Text>
          </View>
        ) : null}
      </View>

      {pkg.status !== "delivered" && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {pkg.status === "received" && (
            <Pressable
              onPress={() => onNotify(pkg.id)}
              style={[styles.actionBtn, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: colors.radius - 2 }]}
            >
              <Feather name="bell" size={14} color="#1d4ed8" />
              <Text style={[styles.actionBtnText, { color: "#1d4ed8" }]}>Sakin'i Bildir</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onDeliver(pkg.id)}
            style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 2 }]}
          >
            <Feather name="check" size={14} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>Teslim Edildi</Text>
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
  const { packages, addPackage, updatePackageStatus, sendNotification, refresh } = useData();
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

  const pendingCount = sitePackages.filter((p) => p.status !== "delivered").length;

  const selectedResident = residents.find((r) => r.id === recipientId);
  const filteredResidents = residents.filter((r) => {
    const q = residentSearch.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.unitNo || "").toLowerCase().includes(q);
  });

  const handleNotify = async (pkgId: string) => {
    if (!user) return;
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updatePackageStatus(pkgId, "notified");
      await sendNotification({
        type: "cargo",
        title: "📦 Kargunuz Teslimatta Bekliyor",
        message: `Görevli ${user.name} tarafından kargunuz (${pkg.senderInfo}) güvenlik görevlisine teslim edildi. Lütfen en kısa sürede teslim alınız.`,
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toUserIds: [pkg.recipientUserId],
      });
    } catch (e) {
      console.error("Bildirim gönderilemedi:", e);
    }
  };

  const handleDeliver = async (pkgId: string) => {
    if (!user) return;
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updatePackageStatus(pkgId, "delivered");
      await sendNotification({
        type: "cargo",
        title: "✅ Kargo Teslim Alındı",
        message: `${pkg.senderInfo} tarafından gelen kargunuz ${user.name} tarafından size teslim edildi. İyi günler!`,
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toUserIds: [pkg.recipientUserId],
      });
    } catch (e) {
      console.error("Teslim bildirimi gönderilemedi:", e);
    }
  };

  const handleAddPackage = async () => {
    if (!recipientId || !senderInfo.trim() || !user) return;
    const resident = residents.find((r) => r.id === recipientId);
    if (!resident) return;
    setLoading(true);
    try {
      await addPackage({
        siteId: user.siteId,
        recipientUserId: recipientId,
        recipientName: resident.name + (resident.unitNo ? ` (Daire ${resident.unitNo})` : ""),
        senderInfo: senderInfo.trim(),
        description: description.trim(),
        status: "received",
      });
      await sendNotification({
        type: "cargo",
        title: "📦 Yeni Kargo Geldi",
        message: `${senderInfo.trim()} firmasından kargunuz güvenlik noktasına teslim edildi. Uygun olduğunuzda teslim alabilirsiniz.`,
        fromUserId: user.id,
        fromName: user.name,
        siteId: user.siteId,
        toUserIds: [recipientId],
      });
      setSuccess(true);
      setRecipientId(""); setSenderInfo(""); setDescription("");
      setTimeout(() => { setSuccess(false); setActiveTab("list"); }, 2200);
    } catch (e) {
      console.error("Kargo eklenemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Kargo Takibi</Text>
          {pendingCount > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: "#fef3c7", borderRadius: 10 }]}>
              <Text style={[styles.pendingBadgeText, { color: "#92400e" }]}>{pendingCount} bekleyen</Text>
            </View>
          )}
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          {([["list", "Kargo Listesi"], ["add", "Kargo Al"]] as [string, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key as "list" | "add")}
              style={[styles.segmentBtn, { borderRadius: colors.radius - 2, backgroundColor: activeTab === key ? colors.card : "transparent" }]}
            >
              <Text style={[styles.segmentText, { color: activeTab === key ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "list" && (
          <View style={styles.filterRow}>
            {([["all", "Tümü"], ["pending", "Bekleyen"], ["delivered", "Teslim Edildi"]] as [string, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key as "all" | "pending" | "delivered")}
                style={[styles.filterBtn, { borderRadius: 20, backgroundColor: filter === key ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.filterText, { color: filter === key ? "#fff" : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {activeTab === "list" ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="package" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Kargo bulunamadı</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {filter === "pending" ? "Bekleyen kargo yok" : filter === "delivered" ? "Teslim edilen kargo yok" : "Henüz kargo kaydı eklenmedi"}
              </Text>
            </View>
          ) : filtered.map((p) => (
            <PackageCard key={p.id} pkg={p} onNotify={handleNotify} onDeliver={handleDeliver} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.addCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={styles.addCardHeader}>
              <View style={[styles.addCardIcon, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
                <Feather name="package" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.addCardTitle, { color: colors.foreground }]}>Yeni Kargo Kaydı</Text>
                <Text style={[styles.addCardSub, { color: colors.mutedForeground }]}>Sakin otomatik bildirim alacak</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ALICI SAKİN</Text>
            <Pressable
              onPress={() => setShowResidentPicker(!showResidentPicker)}
              style={[styles.picker, { borderColor: selectedResident ? colors.primary : colors.border, borderRadius: colors.radius, backgroundColor: colors.background }]}
            >
              <Feather name="user" size={18} color={selectedResident ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.pickerText, { color: selectedResident ? colors.foreground : colors.mutedForeground }]}>
                {selectedResident
                  ? `${selectedResident.name}${selectedResident.unitNo ? ` · Daire ${selectedResident.unitNo}` : ""}`
                  : "Sakin seçin..."}
              </Text>
              <Feather name={showResidentPicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
            </Pressable>

            {showResidentPicker && (
              <View style={[styles.dropdown, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
                <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
                  <Feather name="search" size={14} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.dropdownSearchInput, { color: colors.foreground }]}
                    placeholder="İsim veya daire ara..."
                    placeholderTextColor={colors.mutedForeground}
                    value={residentSearch}
                    onChangeText={setResidentSearch}
                  />
                </View>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {filteredResidents.length === 0 ? (
                    <View style={styles.dropdownEmpty}>
                      <Text style={[styles.dropdownEmptyText, { color: colors.mutedForeground }]}>Sakin bulunamadı</Text>
                    </View>
                  ) : filteredResidents.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => { setRecipientId(r.id); setShowResidentPicker(false); setResidentSearch(""); }}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border, backgroundColor: recipientId === r.id ? colors.primaryLight : "transparent" }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownItemText, { color: recipientId === r.id ? colors.primary : colors.foreground }]}>{r.name}</Text>
                        {r.unitNo ? (
                          <Text style={[styles.dropdownItemSub, { color: colors.mutedForeground }]}>Daire {r.unitNo}</Text>
                        ) : null}
                      </View>
                      {recipientId === r.id ? <Feather name="check" size={16} color={colors.primary} /> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Input label="Kargo Firması / Gönderen *" placeholder="örn. Yurtiçi, PTT, MNG..." value={senderInfo} onChangeText={setSenderInfo} leftIcon="truck" />
            <Input label="Not / Açıklama" placeholder="Paket boyutu, içerik notu..." value={description} onChangeText={setDescription} leftIcon="file-text" />

            {success ? (
              <View style={[styles.successBanner, { backgroundColor: "#dcfce7", borderRadius: colors.radius, borderColor: "#86efac" }]}>
                <Feather name="check-circle" size={18} color={colors.primary} />
                <View>
                  <Text style={[styles.successTitle, { color: colors.primary }]}>Kargo kaydedildi!</Text>
                  <Text style={[styles.successSub, { color: colors.primary }]}>Sakin'e bildirim gönderildi.</Text>
                </View>
              </View>
            ) : null}

            <Button
              title="Kaydet ve Sakin'i Bildir"
              onPress={handleAddPackage}
              loading={loading}
              disabled={!recipientId || !senderInfo.trim()}
              fullWidth
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pendingBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  segmented: { flexDirection: "row", padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  pkgIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  recipient: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sender: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dateRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  dateItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addCard: { borderWidth: 1, padding: 16, gap: 14 },
  addCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  addCardIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  addCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  picker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1.5, height: 52 },
  pickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  dropdown: { borderWidth: 1, overflow: "hidden" },
  dropdownSearch: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  dropdownSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdownItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dropdownItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dropdownEmpty: { padding: 16, alignItems: "center" },
  dropdownEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  successTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  successSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
