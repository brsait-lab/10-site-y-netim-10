import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
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
import { useAuth, SiteDetail } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { LogoBadge } from "@/components/TreeLogo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function AdminProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getSiteDetails, updateSite, logout } = useAuth();

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBankEdit, setShowBankEdit] = useState(false);

  // Bank form state
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMsg, setBankMsg] = useState("");

  useEffect(() => {
    if (user?.siteId) {
      getSiteDetails(user.siteId).then((s) => {
        if (s) {
          setSite(s);
          setBankName(s.bankName ?? "");
          setAccountHolder(s.accountHolder ?? "");
          setIban(s.iban ?? "");
        }
      });
    }
  }, [user]);

  const handleCopyJoinCode = async () => {
    if (!site?.joinCode) return;
    try {
      await Clipboard.setStringAsync(site.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveBank = async () => {
    if (!user?.siteId) return;
    setBankSaving(true);
    setBankMsg("");
    const updated = await updateSite(user.siteId, { bankName, accountHolder, iban });
    setBankSaving(false);
    if (updated) {
      setSite(updated);
      setBankMsg("Site yönetim hesabı güncellendi.");
      setShowBankEdit(false);
    } else {
      setBankMsg("Güncelleme başarısız.");
    }
  };

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
  const hasBankInfo = site?.bankName || site?.accountHolder || site?.iban;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Header ── */}
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

      <LogoBadge size={48} bgColor={colors.primary} iconColor="#fff" />

      {/* ── Join Code Card ── */}
      {site?.joinCode && (
        <View style={[styles.joinCodeCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.primary + "40" }]}>
          <View style={styles.joinCodeHeader}>
            <View style={[styles.joinCodeIconBox, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
              <Feather name="key" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.joinCodeLabel, { color: colors.mutedForeground }]}>Katılım Kodu (Join Code)</Text>
              <Text style={[styles.joinCodeValue, { color: colors.foreground }]}>{site.joinCode}</Text>
            </View>
            <Pressable onPress={handleCopyJoinCode} style={[styles.copyBtn, { backgroundColor: copied ? colors.primaryLight : colors.muted, borderRadius: 8 }]}>
              <Feather name={copied ? "check" : "copy"} size={16} color={copied ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.copyBtnText, { color: copied ? colors.primary : colors.mutedForeground }]}>
                {copied ? "Kopyalandı" : "Kopyala"}
              </Text>
            </Pressable>
          </View>
          <View style={[styles.joinCodeInfo, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
            <Feather name="info" size={12} color={colors.mutedForeground} />
            <Text style={[styles.joinCodeInfoText, { color: colors.mutedForeground }]}>
              Sakin ve güvenlik görevlileri bu kodu kullanarak siteye katılabilir. QR kod desteği yakında eklenecek.
            </Text>
          </View>
        </View>
      )}

      {/* ── Site Info ── */}
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        {[
          { icon: "home" as const, label: "Site Adı", value: site?.name ?? "-" },
          { icon: "map-pin" as const, label: "Adres", value: site?.address || "Belirtilmedi" },
          { icon: "layers" as const, label: "Yerleşim Tipi", value: site?.settlementType ?? "site" },
          { icon: "mail" as const, label: "E-posta", value: user?.email ?? "-" },
          { icon: "phone" as const, label: "Telefon", value: user?.phone ?? "-" },
        ].map((item, idx, arr) => (
          <View key={item.label} style={[styles.menuRow, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
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

      {/* ── Site Management Account (IBAN) ── */}
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.menuIcon, { backgroundColor: "#dbeafe", borderRadius: 8 }]}>
            <Feather name="credit-card" size={16} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, { color: colors.mutedForeground }]}>Site Yönetim Hesabı</Text>
            <Text style={[styles.menuValue, { color: colors.foreground }]}>Aidat tahsilatı için IBAN</Text>
          </View>
          <Pressable
            onPress={() => { setShowBankEdit(!showBankEdit); setBankMsg(""); }}
            style={[styles.editBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}
          >
            <Feather name={showBankEdit ? "x" : "edit-2"} size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {!showBankEdit && (
          <View style={styles.bankInfoDisplay}>
            {hasBankInfo ? (
              <>
                {site?.bankName && (
                  <View style={[styles.bankRow, { borderColor: colors.border }]}>
                    <Feather name="briefcase" size={13} color={colors.mutedForeground} />
                    <View>
                      <Text style={[styles.bankRowLabel, { color: colors.mutedForeground }]}>Banka</Text>
                      <Text style={[styles.bankRowValue, { color: colors.foreground }]}>{site.bankName}</Text>
                    </View>
                  </View>
                )}
                {site?.accountHolder && (
                  <View style={[styles.bankRow, { borderColor: colors.border }]}>
                    <Feather name="user" size={13} color={colors.mutedForeground} />
                    <View>
                      <Text style={[styles.bankRowLabel, { color: colors.mutedForeground }]}>Hesap Sahibi</Text>
                      <Text style={[styles.bankRowValue, { color: colors.foreground }]}>{site.accountHolder}</Text>
                    </View>
                  </View>
                )}
                {site?.iban && (
                  <View style={[styles.bankRow, { borderColor: colors.border }]}>
                    <Feather name="hash" size={13} color={colors.mutedForeground} />
                    <View>
                      <Text style={[styles.bankRowLabel, { color: colors.mutedForeground }]}>IBAN</Text>
                      <Text style={[styles.bankRowValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{site.iban}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Pressable
                onPress={() => setShowBankEdit(true)}
                style={[styles.addBankBtn, { backgroundColor: "#dbeafe", borderRadius: colors.radius - 4 }]}
              >
                <Feather name="plus" size={16} color="#2563eb" />
                <Text style={[styles.addBankText, { color: "#2563eb" }]}>Site IBAN bilgisi ekle</Text>
              </Pressable>
            )}
          </View>
        )}

        {showBankEdit && (
          <View style={styles.bankEditForm}>
            <Input label="Banka Adı" placeholder="örn. Ziraat Bankası" value={bankName} onChangeText={setBankName} leftIcon="briefcase" />
            <Input label="Hesap Sahibi" placeholder="örn. Yeşilvadi Sitesi Yönetimi" value={accountHolder} onChangeText={setAccountHolder} leftIcon="user" />
            <Input label="IBAN" placeholder="TR00 0000 0000 0000 0000 0000 00" value={iban} onChangeText={(t) => setIban(t.toUpperCase())} leftIcon="hash" autoCapitalize="characters" />

            <View style={[styles.ibanPrivacyNote, { backgroundColor: "#fef3c7", borderRadius: colors.radius - 4 }]}>
              <Feather name="shield" size={12} color="#92400e" />
              <Text style={[styles.ibanPrivacyText, { color: "#92400e" }]}>
                Bu IBAN yalnızca aidat ödemesi sırasında sakinlere gösterilecektir. Kişisel banka hesabı paylaşımı KVKK kapsamında yasaktır.
              </Text>
            </View>

            <Button
              title={bankSaving ? "Kaydediliyor..." : "Kaydet"}
              onPress={handleSaveBank}
              disabled={bankSaving}
              size="sm"
            />
            {bankMsg ? <Text style={[styles.bankMsg, { color: bankMsg.includes("başarı") ? colors.primary : colors.destructive }]}>{bankMsg}</Text> : null}
          </View>
        )}
      </View>

      {/* ── Logout ── */}
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
  scroll: { paddingHorizontal: 16, gap: 16, alignItems: "center" },
  profileHeader: { alignItems: "center", gap: 10, width: "100%" },
  avatarLarge: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  avatarTextLarge: { fontSize: 32, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  roleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  joinCodeCard: { width: "100%", borderWidth: 1.5, padding: 16, gap: 12 },
  joinCodeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  joinCodeIconBox: { padding: 10 },
  joinCodeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.4 },
  joinCodeValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  copyBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  joinCodeInfo: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10 },
  joinCodeInfoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  card: { width: "100%", borderWidth: 1, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  menuIcon: { padding: 8 },
  menuLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  menuValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 0 },
  editBtn: { padding: 8 },
  bankInfoDisplay: { paddingHorizontal: 16, paddingBottom: 16, gap: 0 },
  bankRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  bankRowLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.4 },
  bankRowValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  addBankBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  addBankText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  bankEditForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  ibanPrivacyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10 },
  ibanPrivacyText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },
  bankMsg: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  logoutBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
