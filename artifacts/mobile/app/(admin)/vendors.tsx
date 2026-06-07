import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { router } from "expo-router";
import { customFetch } from "@workspace/api-client-react";
import { useAuth, User } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MERCHANT_SECTORS } from "@/app/(auth)/register";

type VendorRequest = {
  id: string;
  siteId: string;
  requestedBy: string;
  vendorId?: string;
  title: string;
  description: string;
  status: string;
  assignedAt?: string;
  completedAt?: string;
  createdAt: string;
};

const SECTOR_ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = Object.fromEntries(
  MERCHANT_SECTORS.map((s) => [s.value.toLowerCase(), s.icon]),
);
function getIcon(category: string): keyof typeof Feather.glyphMap {
  const k = Object.keys(SECTOR_ICON_MAP).find((key) => category.toLowerCase().includes(key));
  return k ? SECTOR_ICON_MAP[k] : "briefcase";
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Bekliyor",   color: "#92400e", bg: "#fef3c7" },
  assigned:  { label: "Atandı",     color: "#1e40af", bg: "#dbeafe" },
  completed: { label: "Tamamlandı", color: "#065f46", bg: "#d1fae5" },
  cancelled: { label: "İptal",      color: "#7f1d1d", bg: "#fee2e2" },
};

type TabKey = "vendors" | "requests";

export default function AdminVendorsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getAllMerchants } = useAuth();
  const [tab, setTab] = useState<TabKey>("vendors");
  const [merchants, setMerchants] = useState<User[]>([]);
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<User | null>(null);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loadMerchants = useCallback(async () => {
    const all = await getAllMerchants();
    setMerchants(all.filter((u) => u.status === "active"));
  }, [getAllMerchants]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await customFetch("/api/vendor-requests", { method: "GET" });
      if (res.ok) setRequests(await res.json());
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadMerchants(), loadRequests()]);
  }, [loadMerchants, loadRequests]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const openRequestModal = (merchant?: User) => {
    setSelectedMerchant(merchant ?? null);
    setReqTitle(merchant ? `${merchant.businessName || merchant.name} — Hizmet Talebi` : "");
    setReqDesc("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!reqTitle.trim() || !reqDesc.trim()) return;
    setSaving(true);
    try {
      const res = await customFetch("/api/vendor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reqTitle.trim(),
          description: reqDesc.trim(),
        }),
      });
      if (res.ok) {
        const newReq = await res.json();
        setRequests((prev) => [newReq, ...prev]);
        setShowModal(false);
        setReqTitle(""); setReqDesc(""); setSelectedMerchant(null);
        setSuccessMsg("Hizmet talebi oluşturuldu!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (reqId: string, status: string) => {
    try {
      const res = await customFetch(`/api/vendor-requests/${reqId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await loadRequests();
    } catch {}
  };

  const filteredMerchants = merchants.filter((m) => {
    const q = search.toLowerCase();
    return !q || (m.businessName || m.name).toLowerCase().includes(q) || (m.businessCategory || "").toLowerCase().includes(q);
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Esnaf Yönetimi</Text>
          <Pressable onPress={() => openRequestModal()}
            style={[styles.newBtn, { backgroundColor: colors.primary, borderRadius: 20 }]}>
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.newBtnText}>Yeni Talep</Text>
          </Pressable>
        </View>

        {successMsg ? (
          <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
            <Feather name="check-circle" size={14} color={colors.primary} />
            <Text style={[styles.successText, { color: colors.primary }]}>{successMsg}</Text>
          </View>
        ) : null}

        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {(["vendors", "requests"] as TabKey[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}>
              <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
                {t === "vendors" ? `Esnaflar (${merchants.length})` : `Talepler (${requests.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "vendors" && (
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="İşletme adı veya kategori..." placeholderTextColor={colors.mutedForeground}
              value={search} onChangeText={setSearch} />
            {search ? <Pressable onPress={() => setSearch("")}><Feather name="x" size={15} color={colors.mutedForeground} /></Pressable> : null}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === "vendors" ? (
          filteredMerchants.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "Sonuç bulunamadı" : "Kayıtlı esnaf yok"}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Esnaflar kayıt yaptıktan sonra burada görünür
              </Text>
            </View>
          ) : filteredMerchants.map((m) => (
            <View key={m.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14 }]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
                  <Feather name={getIcon(m.businessCategory || "")} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.merchantName, { color: colors.foreground }]}>{m.businessName || m.name}</Text>
                  {m.businessCategory && (
                    <View style={[styles.catPill, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                      <Text style={[styles.catText, { color: colors.mutedForeground }]}>{m.businessCategory}</Text>
                    </View>
                  )}
                </View>
              </View>
              {m.businessDescription ? (
                <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{m.businessDescription}</Text>
              ) : null}
              {m.businessHours ? (
                <View style={styles.infoRow}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{m.businessHours}</Text>
                </View>
              ) : null}
              {m.phone ? (
                <View style={styles.infoRow}>
                  <Feather name="phone" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{m.phone}</Text>
                </View>
              ) : null}
              <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                <Pressable onPress={() => openRequestModal(m)}
                  style={[styles.reqBtn, { backgroundColor: "#8b5cf620", borderRadius: 10 }]}>
                  <Feather name="file-plus" size={15} color="#8b5cf6" />
                  <Text style={[styles.reqBtnText, { color: "#8b5cf6" }]}>Talep Oluştur</Text>
                </Pressable>
                <Pressable onPress={() => {
                  const chatName = m.businessName || m.name;
                  router.push({ pathname: "/chat/[id]", params: { id: [user?.id, m.id].sort().join("_"), name: chatName, otherId: m.id } });
                }} style={[styles.chatBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                  <Feather name="message-circle" size={15} color={colors.foreground} />
                  <Text style={[styles.chatBtnText, { color: colors.foreground }]}>Mesaj</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          requests.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="clipboard" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Henüz talep yok</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Esnaf Çağır butonu ile yeni talep oluşturun</Text>
            </View>
          ) : requests.map((r) => {
            const st = STATUS_LABELS[r.status] ?? { label: r.status, color: "#374151", bg: "#f3f4f6" };
            return (
              <View key={r.id} style={[styles.reqCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14 }]}>
                <View style={styles.reqCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reqTitle, { color: colors.foreground }]}>{r.title}</Text>
                    <Text style={[styles.reqDate, { color: colors.mutedForeground }]}>
                      {new Date(r.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: st.bg, borderRadius: 20 }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                {r.description ? (
                  <Text style={[styles.reqDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{r.description}</Text>
                ) : null}
                {r.status === "pending" || r.status === "assigned" ? (
                  <View style={[styles.reqActions, { borderTopColor: colors.border }]}>
                    {r.status === "assigned" && (
                      <Pressable onPress={() => handleUpdateStatus(r.id, "completed")}
                        style={[styles.smallBtn, { backgroundColor: "#d1fae5", borderRadius: 8 }]}>
                        <Feather name="check" size={13} color="#065f46" />
                        <Text style={[styles.smallBtnText, { color: "#065f46" }]}>Tamamlandı</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => handleUpdateStatus(r.id, "cancelled")}
                      style={[styles.smallBtn, { backgroundColor: "#fee2e2", borderRadius: 8 }]}>
                      <Feather name="x" size={13} color="#dc2626" />
                      <Text style={[styles.smallBtnText, { color: "#dc2626" }]}>İptal Et</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.modal, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Hizmet Talebi</Text>
              <Pressable onPress={() => setShowModal(false)}
                style={[styles.closeBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {selectedMerchant && (
              <View style={[styles.selectedMerchant, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
                <Feather name={getIcon(selectedMerchant.businessCategory || "")} size={18} color={colors.primary} />
                <Text style={[styles.selectedMerchantName, { color: colors.primary }]}>
                  {selectedMerchant.businessName || selectedMerchant.name}
                </Text>
              </View>
            )}

            <Input label="Talep Başlığı" value={reqTitle} onChangeText={setReqTitle}
              placeholder="Kısaca talep konusu..." leftIcon="file-text" />

            <Text style={[styles.descLabel, { color: colors.mutedForeground }]}>AÇIKLAMA</Text>
            <View style={[styles.descBox, { borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.descInput, { color: colors.foreground }]}
                placeholder="Talep detaylarını açıklayın..."
                placeholderTextColor={colors.mutedForeground}
                value={reqDesc} onChangeText={setReqDesc}
                multiline textAlignVertical="top"
              />
            </View>

            <Button title="Talebi Gönder" onPress={handleSubmit} loading={saving}
              disabled={!reqTitle.trim() || !reqDesc.trim()} fullWidth />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  merchantName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  catPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cardActions: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingTop: 12 },
  reqBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10 },
  reqBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10 },
  chatBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reqCard: { borderWidth: 1, padding: 16, gap: 8 },
  reqCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reqTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reqDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reqDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reqActions: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 10 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { paddingTop: 60, alignItems: "center", gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  modal: { flex: 1, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  selectedMerchant: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  selectedMerchantName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  descLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  descBox: { borderWidth: 1.5 },
  descInput: { padding: 12, minHeight: 100, fontSize: 14, fontFamily: "Inter_400Regular" },
});
