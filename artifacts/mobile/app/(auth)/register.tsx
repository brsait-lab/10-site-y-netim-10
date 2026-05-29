import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ROLES: { key: UserRole; label: string; desc: string }[] = [
  { key: "resident", label: "Sakin", desc: "Site sakini olarak kayıt" },
  { key: "security", label: "Güvenlik", desc: "Görevli / Güvenlik personeli" },
  { key: "merchant", label: "Esnaf", desc: "Ürün veya hizmet sağlayıcı" },
  { key: "admin", label: "Yönetici", desc: "Yeni site oluştur ve yönet" },
];

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, sites, refreshSites } = useAuth();
  const [role, setRole] = useState<UserRole>("resident");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sitePickerOpen, setSitePickerOpen] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      setError("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (role === "admin" && !siteName.trim()) {
      setError("Site adı zorunludur.");
      return;
    }
    if (role !== "admin" && !selectedSiteId) {
      setError("Lütfen sitenizi seçin.");
      return;
    }
    setLoading(true);
    setError("");
    await refreshSites();
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      phone: phone.trim(),
      siteId: role !== "admin" ? selectedSiteId : undefined,
      siteName: role === "admin" ? siteName.trim() : undefined,
      siteAddress: role === "admin" ? siteAddress.trim() : undefined,
      unitNo: role === "resident" ? unitNo.trim() : undefined,
      businessName: role === "merchant" ? businessName.trim() : undefined,
      businessCategory: role === "merchant" ? businessCategory.trim() : undefined,
      businessDescription: role === "merchant" ? businessDescription.trim() : undefined,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    } else {
      if (role === "admin" || role === "security") {
        const dest = role === "admin" ? "/(admin)" : "/(security)";
        router.replace(dest as never);
      } else {
        setSuccess(result.message);
      }
    }
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 30,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          <Text style={[styles.title, { color: colors.foreground }]}>Hesap Oluştur</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Sisteme kayıt olmak için bilgilerinizi girin
          </Text>

          {success ? (
            <View style={[styles.successBox, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="check-circle" size={20} color={colors.primary} />
              <Text style={[styles.successText, { color: colors.primary }]}>{success}</Text>
              <Button title="Giriş Yap" onPress={() => router.replace("/(auth)/login")} size="sm" />
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Kullanıcı Tipi</Text>
                <View style={styles.roleList}>
                  {ROLES.map((r) => {
                    const active = role === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => { setRole(r.key); setError(""); setSelectedSiteId(""); }}
                        style={[
                          styles.roleCard,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryLight : colors.card,
                            borderRadius: colors.radius,
                          },
                        ]}
                      >
                        <View style={styles.roleCardContent}>
                          <View style={[styles.radioOuter, { borderColor: active ? colors.primary : colors.border }]}>
                            {active && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.roleName, { color: active ? colors.primary : colors.foreground }]}>
                              {r.label}
                            </Text>
                            <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>{r.desc}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Kişisel Bilgiler</Text>
                <View style={styles.fields}>
                  <Input label="Ad Soyad *" placeholder="Ad Soyad" value={name} onChangeText={(t) => { setName(t); setError(""); }} leftIcon="user" />
                  <Input label="E-posta *" placeholder="ornek@email.com" value={email} onChangeText={(t) => { setEmail(t); setError(""); }} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" />
                  <Input label="Telefon *" placeholder="05XX XXX XX XX" value={phone} onChangeText={(t) => { setPhone(t); setError(""); }} keyboardType="phone-pad" leftIcon="phone" />
                  <Input label="Şifre *" placeholder="En az 6 karakter" value={password} onChangeText={(t) => { setPassword(t); setError(""); }} isPassword leftIcon="lock" />
                </View>
              </View>

              {role === "admin" && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Site Bilgileri</Text>
                  <View style={styles.fields}>
                    <Input label="Site Adı *" placeholder="örn. Yeşilvadi Sitesi" value={siteName} onChangeText={(t) => { setSiteName(t); setError(""); }} leftIcon="home" />
                    <Input label="Adres" placeholder="Mahalle, İlçe, İl" value={siteAddress} onChangeText={setSiteAddress} leftIcon="map-pin" />
                  </View>
                </View>
              )}

              {role !== "admin" && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Site Seçimi</Text>
                  {sites.length === 0 ? (
                    <View style={[styles.noSite, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                      <Feather name="info" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.noSiteText, { color: colors.mutedForeground }]}>
                        Henüz kayıtlı site bulunmuyor. Önce bir yönetici site oluşturmalıdır.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setSitePickerOpen(!sitePickerOpen)}
                        style={[styles.sitePicker, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}
                      >
                        <Feather name="home" size={18} color={colors.mutedForeground} />
                        <Text style={[styles.sitePickerText, { color: selectedSite ? colors.foreground : colors.mutedForeground }]}>
                          {selectedSite ? selectedSite.name : "Site seçin..."}
                        </Text>
                        <Feather name={sitePickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                      </Pressable>
                      {sitePickerOpen && (
                        <View style={[styles.siteDropdown, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
                          {sites.map((s) => (
                            <Pressable
                              key={s.id}
                              onPress={() => { setSelectedSiteId(s.id); setSitePickerOpen(false); setError(""); }}
                              style={[
                                styles.siteOption,
                                { borderBottomColor: colors.border },
                                selectedSiteId === s.id && { backgroundColor: colors.primaryLight },
                              ]}
                            >
                              <Text style={[styles.siteOptionText, { color: selectedSiteId === s.id ? colors.primary : colors.foreground }]}>
                                {s.name}
                              </Text>
                              {s.address ? (
                                <Text style={[styles.siteOptionAddr, { color: colors.mutedForeground }]}>{s.address}</Text>
                              ) : null}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {role === "resident" && (
                <View style={styles.section}>
                  <Input label="Daire No" placeholder="örn. A-12" value={unitNo} onChangeText={setUnitNo} leftIcon="hash" />
                </View>
              )}

              {role === "merchant" && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>İşletme Bilgileri</Text>
                  <View style={styles.fields}>
                    <Input label="İşletme Adı" placeholder="İşletmenizin adı" value={businessName} onChangeText={setBusinessName} leftIcon="briefcase" />
                    <Input label="Kategori" placeholder="örn. Market, Restoran..." value={businessCategory} onChangeText={setBusinessCategory} leftIcon="tag" />
                    <Input label="Açıklama" placeholder="Kısa işletme açıklaması" value={businessDescription} onChangeText={setBusinessDescription} leftIcon="file-text" />
                  </View>
                </View>
              )}

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderRadius: colors.radius }]}>
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              ) : null}

              <Button title="Kayıt Ol" onPress={handleRegister} loading={loading} fullWidth size="lg" />

              <Pressable onPress={() => router.back()} style={styles.loginLink}>
                <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
                  Zaten hesabınız var mı?{" "}
                  <Text style={[styles.loginHighlight, { color: colors.primary }]}>Giriş Yap</Text>
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 20 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -12 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  roleList: { gap: 8 },
  roleCard: { borderWidth: 1.5, padding: 14 },
  roleCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  roleName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  roleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  fields: { gap: 14 },
  noSite: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  noSiteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  sitePicker: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1.5, height: 50 },
  sitePickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  siteDropdown: { borderWidth: 1, marginTop: -8 },
  siteOption: { padding: 14, borderBottomWidth: 1 },
  siteOptionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  siteOptionAddr: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  errorBox: { padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  successBox: { padding: 20, alignItems: "center", gap: 12 },
  successText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  loginLink: { alignItems: "center", paddingVertical: 4 },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loginHighlight: { fontFamily: "Inter_600SemiBold" },
});
