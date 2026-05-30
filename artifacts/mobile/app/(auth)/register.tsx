import { router } from "expo-router";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export const MERCHANT_SECTORS: { value: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "Market", icon: "shopping-bag" },
  { value: "Restoran", icon: "coffee" },
  { value: "Kafe", icon: "coffee" },
  { value: "Berber / Kuaför", icon: "scissors" },
  { value: "Eczane", icon: "activity" },
  { value: "Fırın / Pastane", icon: "box" },
  { value: "Çiçekçi", icon: "feather" },
  { value: "Temizlik", icon: "wind" },
  { value: "Elektrikçi", icon: "zap" },
  { value: "Çilingir", icon: "key" },
  { value: "Diğer", icon: "briefcase" },
];

type PrimaryRole = "resident" | "security";
type AllRole = UserRole;

const PRIMARY_ROLES: { key: PrimaryRole; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { key: "resident", label: "Sakin", icon: "home", desc: "Daire sahibi veya kiracı" },
  { key: "security", label: "Görevli", icon: "shield", desc: "Güvenlik / personel" },
];

const SECONDARY_ROLES: { key: AllRole; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { key: "merchant", label: "Esnaf", icon: "shopping-bag", desc: "İşletme sahibi" },
  { key: "admin", label: "Yönetici", icon: "settings", desc: "Yeni site kur ve yönet" },
];

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, sites, refreshSites } = useAuth();

  const [role, setRole] = useState<AllRole>("resident");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  const [unitNo, setUnitNo] = useState("");
  const [plate1, setPlate1] = useState("");
  const [plate2, setPlate2] = useState("");
  const [showPlate2, setShowPlate2] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [merchantLat, setMerchantLat] = useState<number | undefined>(undefined);
  const [merchantLon, setMerchantLon] = useState<number | undefined>(undefined);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    refreshSites();
  }, []);

  const isAdmin = role === "admin";
  const isResident = role === "resident";
  const isSecurity = role === "security";
  const isMerchant = role === "merchant";
  const needsSite = !isAdmin && !isMerchant;

  const handleGetLocation = async () => {
    if (Platform.OS === "web") { setLocationMsg("Konum web'de desteklenmez, adres girerek devam edin."); return; }
    setLocationLoading(true);
    setLocationMsg("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationMsg("Konum izni reddedildi."); setLocationLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMerchantLat(loc.coords.latitude);
      setMerchantLon(loc.coords.longitude);
      setLocationMsg("Konumunuz alındı! Sakinler sizi haritada bulabilecek.");
    } catch {
      setLocationMsg("Konum alınamadı. Adres girerek devam edebilirsiniz.");
    }
    setLocationLoading(false);
  };

  const filteredSites = sites.filter((s) => {
    const q = siteSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q);
  });

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const handleRoleChange = (r: AllRole) => {
    setRole(r);
    setError("");
    setSelectedSiteId("");
    setSiteSearch("");
    setSitePickerOpen(false);
  };

  const handleRegister = async () => {
    setError("");

    if (!name.trim()) { setError("Ad Soyad zorunludur."); return; }
    if (!email.trim()) { setError("E-posta zorunludur."); return; }
    if (!phone.trim()) { setError("Telefon numarası zorunludur."); return; }
    if (!password || password.length < 6) { setError("Şifre en az 6 karakter olmalıdır."); return; }

    if (needsSite && !selectedSiteId) {
      setError("Sisteme katılmak için kayıtlı bir site seçmeniz zorunludur.");
      return;
    }
    if (isAdmin && !siteName.trim()) { setError("Site adı zorunludur."); return; }
    if (isResident && !unitNo.trim()) { setError("Daire numarası Sakin kayıtları için zorunludur."); return; }
    if (isMerchant && !businessName.trim()) { setError("İşletme adı zorunludur."); return; }
    if (isMerchant && !businessCategory.trim()) { setError("Lütfen bir sektör seçin."); return; }

    const plates: string[] = [];
    if (isResident) {
      if (plate1.trim()) plates.push(plate1.trim().toUpperCase());
      if (plate2.trim()) plates.push(plate2.trim().toUpperCase());
    }

    setLoading(true);
    if (!isMerchant) await refreshSites();
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      phone: phone.trim(),
      siteId: needsSite ? selectedSiteId : undefined,
      siteName: isAdmin ? siteName.trim() : undefined,
      siteAddress: isAdmin ? siteAddress.trim() : undefined,
      unitNo: isResident ? unitNo.trim() : undefined,
      plates: isResident ? plates : undefined,
      businessName: isMerchant ? businessName.trim() : undefined,
      businessCategory: isMerchant ? businessCategory.trim() : undefined,
      businessDescription: isMerchant ? businessDescription.trim() : undefined,
      businessAddress: isMerchant ? businessAddress.trim() : undefined,
      latitude: isMerchant ? merchantLat : undefined,
      longitude: isMerchant ? merchantLon : undefined,
    });
    setLoading(false);

    if (!result.success) {
      setError(result.message);
    } else {
      if (isAdmin) {
        router.replace("/(admin)");
      } else if (isSecurity) {
        router.replace("/(security)");
      } else {
        setSuccess(result.message);
      }
    }
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          <Text style={[styles.title, { color: colors.foreground }]}>Hesap Oluştur</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Kaydınızı tamamlamak için aşağıdaki adımları izleyin.
          </Text>

          {success ? (
            <View style={[styles.successCard, { backgroundColor: colors.primaryLight, borderRadius: colors.radius, borderColor: colors.primary + "60" }]}>
              <Feather name="check-circle" size={28} color={colors.primary} />
              <Text style={[styles.successTitle, { color: colors.primary }]}>Kayıt Talebiniz Alındı</Text>
              <Text style={[styles.successMsg, { color: colors.primary }]}>{success}</Text>
              <Button title="Giriş Sayfasına Dön" onPress={() => router.replace("/(auth)/login")} size="sm" />
            </View>
          ) : (
            <>
              {/* STEP 1: ROLE */}
              <View style={styles.section}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNum}>1</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>Kullanıcı Tipi</Text>
                </View>

                <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                  Sisteme hangi rolde dahil olacaksınız?
                </Text>

                <View style={styles.primaryRoleRow}>
                  {PRIMARY_ROLES.map((r) => {
                    const active = role === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => handleRoleChange(r.key)}
                        style={[
                          styles.primaryRoleBtn,
                          {
                            borderRadius: colors.radius,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryLight : colors.card,
                            borderWidth: active ? 2 : 1.5,
                          },
                        ]}
                      >
                        <View style={[styles.primaryRoleIcon, { backgroundColor: active ? colors.primary : colors.muted, borderRadius: 12 }]}>
                          <Feather name={r.icon} size={22} color={active ? "#fff" : colors.mutedForeground} />
                        </View>
                        <Text style={[styles.primaryRoleLabel, { color: active ? colors.primary : colors.foreground }]}>
                          {r.label}
                        </Text>
                        <Text style={[styles.primaryRoleDesc, { color: colors.mutedForeground }]}>{r.desc}</Text>
                        {active && (
                          <View style={[styles.checkCircle, { backgroundColor: colors.primary, borderRadius: 10 }]}>
                            <Feather name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.secondaryRoleRow}>
                  {SECONDARY_ROLES.map((r) => {
                    const active = role === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => handleRoleChange(r.key)}
                        style={[
                          styles.secondaryRoleBtn,
                          {
                            borderRadius: colors.radius,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryLight : colors.card,
                            borderWidth: active ? 2 : 1,
                          },
                        ]}
                      >
                        <Feather name={r.icon} size={15} color={active ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.secondaryRoleLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* STEP 2: SITE SELECTION (mandatory for non-admin) */}
              {!isAdmin && (
                <View style={styles.section}>
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNum}>2</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Site Seçimi</Text>
                      <Text style={[styles.stepRequired, { color: colors.destructive }]}>● Zorunlu</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.siteBanner,
                    {
                      backgroundColor: selectedSiteId ? colors.primaryLight : "#fef3c7",
                      borderRadius: colors.radius,
                      borderColor: selectedSiteId ? colors.primary + "40" : "#fcd34d",
                    },
                  ]}>
                    <Feather
                      name={selectedSiteId ? "check-circle" : "alert-circle"}
                      size={16}
                      color={selectedSiteId ? colors.primary : "#92400e"}
                    />
                    <Text style={[styles.siteBannerText, { color: selectedSiteId ? colors.primary : "#92400e" }]}>
                      {selectedSiteId
                        ? `Seçilen site: ${selectedSite?.name}`
                        : "Kayıtlı olmadığınız bir siteye dahil olamazsınız. Sitenizi seçin."}
                    </Text>
                  </View>

                  {sites.length === 0 ? (
                    <View style={[styles.noSiteBox, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                      <Feather name="info" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.noSiteText, { color: colors.mutedForeground }]}>
                        Sistemde henüz kayıtlı site bulunmuyor. Önce bir Yönetici site oluşturmalıdır.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setSitePickerOpen(!sitePickerOpen)}
                        style={[
                          styles.sitePicker,
                          {
                            borderColor: !selectedSiteId && error ? colors.destructive : selectedSiteId ? colors.primary : colors.border,
                            borderRadius: colors.radius,
                            backgroundColor: colors.card,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        <Feather name="home" size={18} color={selectedSiteId ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.sitePickerText, { color: selectedSite ? colors.foreground : colors.mutedForeground }]}>
                          {selectedSite ? selectedSite.name : "Sitenizi seçin..."}
                        </Text>
                        <Feather name={sitePickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                      </Pressable>

                      {sitePickerOpen && (
                        <View style={[styles.siteDropdown, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
                          <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
                            <Feather name="search" size={14} color={colors.mutedForeground} />
                            <TextInput
                              style={[styles.dropdownSearchInput, { color: colors.foreground }]}
                              placeholder="Site ara..."
                              placeholderTextColor={colors.mutedForeground}
                              value={siteSearch}
                              onChangeText={setSiteSearch}
                            />
                          </View>
                          {filteredSites.map((s, idx) => (
                            <Pressable
                              key={s.id}
                              onPress={() => { setSelectedSiteId(s.id); setSitePickerOpen(false); setSiteSearch(""); setError(""); }}
                              style={[
                                styles.siteOption,
                                {
                                  borderBottomWidth: idx < filteredSites.length - 1 ? 1 : 0,
                                  borderBottomColor: colors.border,
                                  backgroundColor: selectedSiteId === s.id ? colors.primaryLight : "transparent",
                                },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.siteOptionName, { color: selectedSiteId === s.id ? colors.primary : colors.foreground }]}>
                                  {s.name}
                                </Text>
                                {s.address ? (
                                  <Text style={[styles.siteOptionAddr, { color: colors.mutedForeground }]}>{s.address}</Text>
                                ) : null}
                              </View>
                              {selectedSiteId === s.id && <Feather name="check" size={16} color={colors.primary} />}
                            </Pressable>
                          ))}
                          {filteredSites.length === 0 && (
                            <View style={styles.dropdownEmpty}>
                              <Text style={[styles.dropdownEmptyText, { color: colors.mutedForeground }]}>Sonuç bulunamadı</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* STEP 3: PERSONAL INFO */}
              <View style={styles.section}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNum}>{isAdmin ? "2" : "3"}</Text>
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>Kişisel Bilgiler</Text>
                </View>
                <View style={styles.fields}>
                  <Input label="Ad Soyad *" placeholder="Ad Soyad" value={name} onChangeText={(t) => { setName(t); setError(""); }} leftIcon="user" />
                  <Input label="E-posta *" placeholder="ornek@email.com" value={email} onChangeText={(t) => { setEmail(t); setError(""); }} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" />
                  <View>
                    <Input label="Telefon *" placeholder="05XX XXX XX XX" value={phone} onChangeText={(t) => { setPhone(t); setError(""); }} keyboardType="phone-pad" leftIcon="phone" />
                    <View style={[styles.kvkkNote, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
                      <Feather name="shield" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.kvkkText, { color: colors.mutedForeground }]}>
                        KVKK: Telefon bilgisi yalnızca Yönetici ve Güvenlik görevlisi tarafından görüntülenebilir.
                      </Text>
                    </View>
                  </View>
                  <Input label="Şifre *" placeholder="En az 6 karakter" value={password} onChangeText={(t) => { setPassword(t); setError(""); }} isPassword leftIcon="lock" />
                </View>
              </View>

              {/* STEP 4: ADMIN - SITE INFO */}
              {isAdmin && (
                <View style={styles.section}>
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>Site Bilgileri</Text>
                  </View>
                  <View style={styles.fields}>
                    <Input label="Site Adı *" placeholder="örn. Yeşilvadi Sitesi" value={siteName} onChangeText={(t) => { setSiteName(t); setError(""); }} leftIcon="home" />
                    <Input label="Adres" placeholder="Mahalle, İlçe, İl" value={siteAddress} onChangeText={setSiteAddress} leftIcon="map-pin" />
                  </View>
                </View>
              )}

              {/* STEP 4: RESIDENT - UNIT + PLATES */}
              {isResident && (
                <View style={styles.section}>
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNum}>4</Text>
                    </View>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>Daire ve Araç Bilgileri</Text>
                  </View>
                  <View style={styles.fields}>
                    <View>
                      <Input label="Daire Numarası *" placeholder="örn. A-12, B-04..." value={unitNo} onChangeText={(t) => { setUnitNo(t); setError(""); }} leftIcon="hash" />
                      <View style={[styles.kvkkNote, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
                        <Feather name="shield" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.kvkkText, { color: colors.mutedForeground }]}>
                          Daire bilgisi finansal ve operasyonel takip için zorunludur.
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.plateSection, { borderColor: colors.border, borderRadius: colors.radius }]}>
                      <View style={styles.plateSectionHeader}>
                        <Feather name="truck" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.plateSectionTitle, { color: colors.foreground }]}>Araç Plakası</Text>
                        <View style={[styles.optionalBadge, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                          <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>İsteğe bağlı</Text>
                        </View>
                      </View>
                      <Text style={[styles.plateInfo, { color: colors.mutedForeground }]}>
                        Araç plakası bilginiz yalnızca Yönetici ve Güvenlik görevlisi tarafından görüntülenebilir.
                      </Text>
                      <View style={styles.fields}>
                        <Input
                          label="Araç Plakası 1"
                          placeholder="örn. 34 ABC 123"
                          value={plate1}
                          onChangeText={(t) => setPlate1(t.toUpperCase())}
                          leftIcon="truck"
                          autoCapitalize="characters"
                        />
                        {(showPlate2 || plate1.trim()) && (
                          <Input
                            label="Araç Plakası 2"
                            placeholder="İkinci araç plakası (opsiyonel)"
                            value={plate2}
                            onChangeText={(t) => setPlate2(t.toUpperCase())}
                            leftIcon="truck"
                            autoCapitalize="characters"
                          />
                        )}
                        {!showPlate2 && !plate1.trim() && (
                          <Pressable
                            onPress={() => setShowPlate2(true)}
                            style={[styles.addPlateBtn, { borderColor: colors.border, borderRadius: colors.radius - 2 }]}
                          >
                            <Feather name="plus" size={14} color={colors.mutedForeground} />
                            <Text style={[styles.addPlateBtnText, { color: colors.mutedForeground }]}>Araç plakası ekle</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 3: MERCHANT INFO + LOCATION (no site needed) */}
              {isMerchant && (
                <View style={styles.section}>
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                    <Text style={[styles.stepTitle, { color: colors.foreground }]}>İşletme Bilgileri</Text>
                  </View>

                  <View style={[styles.merchantInfoBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
                    <Feather name="info" size={14} color={colors.primary} />
                    <Text style={[styles.merchantInfoText, { color: colors.primary }]}>
                      Esnaflar siteye bağlı değildir. Kaydınız onaylanır ve sakinler sizi konum bazlı bulabilir.
                    </Text>
                  </View>

                  <View style={styles.fields}>
                    <Input label="İşletme Adı *" placeholder="İşletmenizin adı" value={businessName} onChangeText={setBusinessName} leftIcon="briefcase" />

                    {/* Sector picker */}
                    <View style={styles.sectorSection}>
                      <Text style={[styles.sectorLabel, { color: colors.foreground }]}>
                        Sektör <Text style={{ color: colors.destructive }}>*</Text>
                      </Text>
                      <View style={styles.sectorGrid}>
                        {MERCHANT_SECTORS.map((s) => (
                          <Pressable
                            key={s.value}
                            onPress={() => setBusinessCategory(s.value)}
                            style={[
                              styles.sectorBtn,
                              {
                                borderRadius: colors.radius - 2,
                                borderColor: businessCategory === s.value ? colors.primary : colors.border,
                                backgroundColor: businessCategory === s.value ? colors.primaryLight : colors.card,
                              },
                            ]}
                          >
                            <Feather name={s.icon} size={16} color={businessCategory === s.value ? colors.primary : colors.mutedForeground} />
                            <Text style={[styles.sectorBtnText, { color: businessCategory === s.value ? colors.primary : colors.foreground }]}>{s.value}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <Input label="İşletme Adresi" placeholder="Mahalle, sokak, bina no..." value={businessAddress} onChangeText={setBusinessAddress} leftIcon="map-pin" />
                    <Input label="Açıklama" placeholder="Kısa işletme açıklaması" value={businessDescription} onChangeText={setBusinessDescription} leftIcon="file-text" />

                    {/* Location getter */}
                    <View style={[styles.locationBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}>
                      <View style={styles.locationHeader}>
                        <Feather name="navigation" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.locationTitle, { color: colors.foreground }]}>Konum (GPS)</Text>
                        <View style={[styles.optionalBadge, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                          <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>İsteğe bağlı</Text>
                        </View>
                      </View>
                      <Text style={[styles.locationDesc, { color: colors.mutedForeground }]}>
                        GPS konumunuzu paylaşırsanız sakinler size olan mesafeyi görebilir.
                      </Text>
                      <Pressable
                        onPress={handleGetLocation}
                        style={[
                          styles.locationBtn,
                          {
                            backgroundColor: merchantLat ? colors.primaryLight : colors.muted,
                            borderRadius: colors.radius - 2,
                          },
                        ]}
                      >
                        {locationLoading ? (
                          <Text style={[styles.locationBtnText, { color: colors.mutedForeground }]}>Konum alınıyor...</Text>
                        ) : merchantLat ? (
                          <>
                            <Feather name="check-circle" size={15} color={colors.primary} />
                            <Text style={[styles.locationBtnText, { color: colors.primary }]}>Konum Alındı ✓</Text>
                          </>
                        ) : (
                          <>
                            <Feather name="map-pin" size={15} color={colors.mutedForeground} />
                            <Text style={[styles.locationBtnText, { color: colors.mutedForeground }]}>GPS Konumumu Paylaş</Text>
                          </>
                        )}
                      </Pressable>
                      {locationMsg ? (
                        <Text style={[styles.locationMsg, { color: merchantLat ? colors.primary : "#92400e" }]}>
                          {locationMsg}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}

              {/* APPROVAL INFO BANNER */}
              {isResident && (
                <View style={[styles.approvalBanner, { backgroundColor: "#dbeafe", borderRadius: colors.radius }]}>
                  <Feather name="clock" size={16} color="#1d4ed8" />
                  <Text style={[styles.approvalText, { color: "#1e40af" }]}>
                    Kayıt tamamlandıktan sonra seçtiğiniz sitenin Yöneticisi onaylayana kadar sisteme giriş yapamayacaksınız.
                  </Text>
                </View>
              )}

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderRadius: colors.radius, borderColor: "#fca5a5" }]}>
                  <Feather name="alert-circle" size={16} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              ) : null}

              <Button
                title={isAdmin ? "Site Oluştur ve Kayıt Ol" : "Kayıt Ol"}
                onPress={handleRegister}
                loading={loading}
                disabled={needsSite && !selectedSiteId && sites.length === 0}
                fullWidth
                size="lg"
              />

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
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: -4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: -12 },
  successCard: { padding: 24, alignItems: "center", gap: 12, borderWidth: 1 },
  successTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  successMsg: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  section: { gap: 12 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  stepTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  stepRequired: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  helperText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  primaryRoleRow: { flexDirection: "row", gap: 12 },
  primaryRoleBtn: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  primaryRoleIcon: { padding: 12 },
  primaryRoleLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  primaryRoleDesc: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  checkCircle: { position: "absolute", top: 8, right: 8, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  secondaryRoleRow: { flexDirection: "row", gap: 10 },
  secondaryRoleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  secondaryRoleLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  siteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  siteBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  noSiteBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  noSiteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  sitePicker: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 50 },
  sitePickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  siteDropdown: { borderWidth: 1, overflow: "hidden" },
  dropdownSearch: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderBottomWidth: 1 },
  dropdownSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  siteOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  siteOptionName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  siteOptionAddr: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dropdownEmpty: { padding: 16, alignItems: "center" },
  dropdownEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  fields: { gap: 14 },
  kvkkNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  kvkkText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  plateSection: { borderWidth: 1, padding: 14, gap: 10 },
  plateSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  plateSectionTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  optionalBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  optionalText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  plateInfo: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addPlateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1, borderStyle: "dashed" },
  addPlateBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  approvalBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  approvalText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  loginLink: { alignItems: "center", paddingVertical: 4 },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loginHighlight: { fontFamily: "Inter_600SemiBold" },
  merchantInfoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12 },
  merchantInfoText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  sectorSection: { gap: 8 },
  sectorLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectorBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1.5 },
  sectorBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationBox: { borderWidth: 1, padding: 14, gap: 10 },
  locationHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  locationDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  locationBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  locationBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationMsg: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
});
