import { router } from "expo-router";
import * as Location from "expo-location";
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
import { useAuth, UserRole, SiteLookupResult } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// ─── Constants ───────────────────────────────────────────────────────────────

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

export const SETTLEMENT_TYPES: { value: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "site", label: "Site", icon: "home" },
  { value: "rezidans", label: "Rezidans", icon: "layers" },
  { value: "apartman", label: "Apartman", icon: "home" },
  { value: "villa", label: "Villa Sitesi", icon: "sun" },
  { value: "plaza", label: "Plaza", icon: "briefcase" },
  { value: "is_merkezi", label: "İş Merkezi", icon: "briefcase" },
  { value: "karma", label: "Karma Yaşam Alanı", icon: "grid" },
];

type AllRole = UserRole;

const PRIMARY_ROLES: { key: "resident" | "security"; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { key: "resident", label: "Sakin", icon: "home", desc: "Daire sahibi veya kiracı" },
  { key: "security", label: "Görevli", icon: "shield", desc: "Güvenlik / personel" },
];

const SECONDARY_ROLES: { key: AllRole; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { key: "merchant", label: "Esnaf", icon: "shopping-bag", desc: "İşletme sahibi" },
  { key: "admin", label: "Yönetici", icon: "settings", desc: "Yeni site kur ve yönet" },
];

// ─── Settlement type helpers ──────────────────────────────────────────────────

function getResidentialFields(settlementType: string) {
  switch (settlementType) {
    case "rezidans":
      return { tower: true, floor: true, unitNo: true, block: false, villaNo: false, officeNo: false };
    case "villa":
      return { villaNo: true, block: false, tower: false, floor: false, unitNo: false, officeNo: false };
    case "plaza":
    case "is_merkezi":
      return { floor: true, officeNo: true, block: false, tower: false, unitNo: false, villaNo: false };
    case "apartman":
      return { unitNo: true, block: false, tower: false, floor: false, villaNo: false, officeNo: false };
    case "site":
    case "karma":
    default:
      return { block: true, unitNo: true, tower: false, floor: false, villaNo: false, officeNo: false };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register, lookupSiteByJoinCode } = useAuth();

  const [role, setRole] = useState<AllRole>("resident");

  // Join code state (resident/security)
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeLookupLoading, setJoinCodeLookupLoading] = useState(false);
  const [lookedUpSite, setLookedUpSite] = useState<SiteLookupResult | null>(null);
  const [joinCodeError, setJoinCodeError] = useState("");

  // Admin site creation
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [settlementType, setSettlementType] = useState("site");

  // Personal info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Residential fields
  const [unitNo, setUnitNo] = useState("");
  const [block, setBlock] = useState("");
  const [tower, setTower] = useState("");
  const [villaNo, setVillaNo] = useState("");
  const [floor, setFloor] = useState("");
  const [officeNo, setOfficeNo] = useState("");

  // Plates
  const [plate1, setPlate1] = useState("");
  const [plate2, setPlate2] = useState("");

  // Merchant
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [merchantLat, setMerchantLat] = useState<number | undefined>();
  const [merchantLon, setMerchantLon] = useState<number | undefined>();
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [kvkkAccepted, setKvkkAccepted] = useState(false);

  const isAdmin = role === "admin";
  const isResident = role === "resident";
  const isSecurity = role === "security";
  const isMerchant = role === "merchant";
  const needsJoinCode = isResident || isSecurity;

  const siteSettlement = lookedUpSite?.settlementType ?? "site";
  const fields = getResidentialFields(siteSettlement);

  const handleRoleChange = (r: AllRole) => {
    setRole(r);
    setError("");
    setJoinCode("");
    setLookedUpSite(null);
    setJoinCodeError("");
  };

  const handleJoinCodeLookup = async () => {
    if (!joinCode.trim()) return;
    setJoinCodeLookupLoading(true);
    setJoinCodeError("");
    setLookedUpSite(null);
    const site = await lookupSiteByJoinCode(joinCode.trim());
    setJoinCodeLookupLoading(false);
    if (site) {
      setLookedUpSite(site);
    } else {
      setJoinCodeError("Geçersiz katılım kodu. Yöneticinizden doğru kodu alın.");
    }
  };

  const handleGetLocation = async () => {
    if (Platform.OS === "web") { setLocationMsg("Konum web'de desteklenmez."); return; }
    setLocationLoading(true);
    setLocationMsg("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationMsg("Konum izni reddedildi."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMerchantLat(loc.coords.latitude);
      setMerchantLon(loc.coords.longitude);
      setLocationMsg("Konumunuz alındı!");
    } catch {
      setLocationMsg("Konum alınamadı.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");

    if (!name.trim()) { setError("Ad Soyad zorunludur."); return; }
    if (!email.trim()) { setError("E-posta zorunludur."); return; }
    if (!phone.trim()) { setError("Telefon numarası zorunludur."); return; }
    if (!password || password.length < 6) { setError("Şifre en az 6 karakter olmalıdır."); return; }

    if (needsJoinCode && !lookedUpSite) {
      setError("Geçerli bir katılım kodu girip doğrulamanız zorunludur.");
      return;
    }

    if (isAdmin && !siteName.trim()) { setError("Site adı zorunludur."); return; }

    if (isResident) {
      if (fields.villaNo && !villaNo.trim()) { setError("Villa numarası zorunludur."); return; }
      if (fields.officeNo && !officeNo.trim()) { setError("Ofis numarası zorunludur."); return; }
      if (fields.unitNo && !unitNo.trim()) { setError("Daire numarası zorunludur."); return; }
    }

    if (isMerchant && !businessName.trim()) { setError("İşletme adı zorunludur."); return; }
    if (isMerchant && !businessCategory.trim()) { setError("Lütfen bir sektör seçin."); return; }

    if (!kvkkAccepted) { setError("KVKK aydınlatma metnini kabul etmeniz gerekmektedir."); return; }

    const plates: string[] = [];
    if (isResident) {
      if (plate1.trim()) plates.push(plate1.trim().toUpperCase());
      if (plate2.trim()) plates.push(plate2.trim().toUpperCase());
    }

    setLoading(true);
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      phone: phone.trim(),
      // Admin
      siteName: isAdmin ? siteName.trim() : undefined,
      siteAddress: isAdmin ? siteAddress.trim() : undefined,
      settlementType: isAdmin ? settlementType : undefined,
      // Non-admin join
      joinCode: needsJoinCode ? joinCode.trim().toUpperCase() : undefined,
      // Residential
      unitNo: (isResident && fields.unitNo) ? unitNo.trim() : undefined,
      block: (isResident && fields.block) ? block.trim() : undefined,
      tower: (isResident && fields.tower) ? tower.trim() : undefined,
      villaNo: (isResident && fields.villaNo) ? villaNo.trim() : undefined,
      floor: (isResident && (fields.floor)) ? floor.trim() : undefined,
      officeNo: (isResident && fields.officeNo) ? officeNo.trim() : undefined,
      plates: isResident ? plates : undefined,
      // Merchant
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
      if (isAdmin) router.replace("/(admin)");
      else if (isSecurity) router.replace("/(security)");
      else if (isMerchant) router.replace("/(merchant)");
      else router.replace("/(resident)");
    }
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const stepNum = (base: number) => base + (needsJoinCode ? 1 : 0) + (isAdmin ? 0 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 12, paddingBottom: insets.bottom + 60 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>

          <Text style={[styles.title, { color: colors.foreground }]}>Hesap Oluştur</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Kaydınızı tamamlamak için adımları izleyin.
          </Text>

          {success ? (
            <View style={[styles.successCard, { backgroundColor: colors.primaryLight, borderRadius: colors.radius, borderColor: colors.primary + "60" }]}>
              <Feather name="check-circle" size={28} color={colors.primary} />
              <Text style={[styles.successTitle, { color: colors.primary }]}>Kayıt Başarılı!</Text>
              <Text style={[styles.successMsg, { color: colors.primary }]}>{success}</Text>
              <Button title="Giriş Sayfasına Dön" onPress={() => router.replace("/(auth)/login")} size="sm" />
            </View>
          ) : (
            <>
              {/* ── STEP 1: ROLE ── */}
              <View style={styles.section}>
                <StepHeader num={1} title="Kullanıcı Tipi" colors={colors} />
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
                        style={[styles.primaryRoleBtn, { borderRadius: colors.radius, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.card, borderWidth: active ? 2 : 1.5 }]}
                      >
                        <View style={[styles.primaryRoleIcon, { backgroundColor: active ? colors.primary : colors.muted, borderRadius: 12 }]}>
                          <Feather name={r.icon} size={22} color={active ? "#fff" : colors.mutedForeground} />
                        </View>
                        <Text style={[styles.primaryRoleLabel, { color: active ? colors.primary : colors.foreground }]}>{r.label}</Text>
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
                        style={[styles.secondaryRoleBtn, { borderRadius: colors.radius, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.card, borderWidth: active ? 2 : 1 }]}
                      >
                        <Feather name={r.icon} size={15} color={active ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.secondaryRoleLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* ── STEP 2: JOIN CODE (resident / security) ── */}
              {needsJoinCode && (
                <View style={styles.section}>
                  <StepHeader num={2} title="Katılım Kodu" required colors={colors} />
                  <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                    Sitenizin yöneticisinden aldığınız 6 haneli kodu girin.
                  </Text>

                  <View style={styles.joinCodeRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label=""
                        placeholder="örn. AB1234"
                        value={joinCode}
                        onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinCodeError(""); setLookedUpSite(null); }}
                        autoCapitalize="characters"
                        leftIcon="key"
                        maxLength={8}
                      />
                    </View>
                    <Pressable
                      onPress={handleJoinCodeLookup}
                      disabled={joinCodeLookupLoading || !joinCode.trim()}
                      style={[styles.lookupBtn, { backgroundColor: (!joinCode.trim() || joinCodeLookupLoading) ? colors.muted : colors.primary, borderRadius: colors.radius }]}
                    >
                      {joinCodeLookupLoading
                        ? <Feather name="loader" size={18} color="#fff" />
                        : <Feather name="search" size={18} color="#fff" />}
                    </Pressable>
                  </View>

                  {joinCodeError ? (
                    <View style={[styles.joinCodeFeedback, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}>
                      <Feather name="x-circle" size={14} color={colors.destructive} />
                      <Text style={[styles.joinCodeFeedbackText, { color: colors.destructive }]}>{joinCodeError}</Text>
                    </View>
                  ) : null}

                  {lookedUpSite && (
                    <View style={[styles.joinCodeFeedback, { backgroundColor: colors.primaryLight, borderRadius: colors.radius - 2 }]}>
                      <Feather name="check-circle" size={14} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.joinCodeFeedbackText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                          Site bulundu: {lookedUpSite.name}
                        </Text>
                        <Text style={[styles.joinCodeFeedbackText, { color: colors.primary }]}>
                          {SETTLEMENT_TYPES.find((s) => s.value === lookedUpSite.settlementType)?.label ?? lookedUpSite.settlementType}
                          {lookedUpSite.address ? ` · ${lookedUpSite.address}` : ""}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 2/3: PERSONAL INFO ── */}
              <View style={styles.section}>
                <StepHeader num={needsJoinCode ? 3 : 2} title="Kişisel Bilgiler" colors={colors} />
                <View style={styles.fields}>
                  <Input label="Ad Soyad *" placeholder="Ad Soyad" value={name} onChangeText={(t) => { setName(t); setError(""); }} leftIcon="user" />
                  <Input label="E-posta *" placeholder="ornek@email.com" value={email} onChangeText={(t) => { setEmail(t); setError(""); }} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" />
                  <View>
                    <Input label="Telefon *" placeholder="05XX XXX XX XX" value={phone} onChangeText={(t) => { setPhone(t); setError(""); }} keyboardType="phone-pad" leftIcon="phone" />
                    <View style={[styles.infoNote, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}>
                      <Feather name="eye-off" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.infoNoteText, { color: colors.mutedForeground }]}>
                        Telefon numaranız diğer sakinler tarafından görüntülenemez.
                      </Text>
                    </View>
                  </View>
                  <Input label="Şifre *" placeholder="En az 6 karakter" value={password} onChangeText={(t) => { setPassword(t); setError(""); }} isPassword leftIcon="lock" />
                </View>
              </View>

              {/* ── STEP: ADMIN SITE INFO ── */}
              {isAdmin && (
                <View style={styles.section}>
                  <StepHeader num={3} title="Site Bilgileri" colors={colors} />
                  <View style={styles.fields}>
                    <Input label="Site Adı *" placeholder="örn. Yeşilvadi Sitesi" value={siteName} onChangeText={(t) => { setSiteName(t); setError(""); }} leftIcon="home" />
                    <Input label="Adres" placeholder="Mahalle, İlçe, İl" value={siteAddress} onChangeText={setSiteAddress} leftIcon="map-pin" />

                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Yerleşim Tipi</Text>
                      <View style={styles.settlementGrid}>
                        {SETTLEMENT_TYPES.map((s) => {
                          const active = settlementType === s.value;
                          return (
                            <Pressable
                              key={s.value}
                              onPress={() => setSettlementType(s.value)}
                              style={[styles.settlementChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.card, borderWidth: active ? 2 : 1, borderRadius: colors.radius - 4 }]}
                            >
                              <Feather name={s.icon} size={13} color={active ? colors.primary : colors.mutedForeground} />
                              <Text style={[styles.settlementChipText, { color: active ? colors.primary : colors.foreground }]}>{s.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ── STEP: RESIDENTIAL INFO (resident only, after joinCode lookup) ── */}
              {isResident && lookedUpSite && (
                <View style={styles.section}>
                  <StepHeader num={4} title="Konut Bilgileri" required colors={colors} />
                  <View style={styles.fields}>
                    {fields.tower && (
                      <Input label="Kule *" placeholder="örn. A Kulesi, Kule 1" value={tower} onChangeText={(t) => { setTower(t); setError(""); }} leftIcon="layers" />
                    )}
                    {fields.block && (
                      <Input label="Blok" placeholder="örn. A Blok, B Blok" value={block} onChangeText={(t) => { setBlock(t); setError(""); }} leftIcon="grid" />
                    )}
                    {fields.floor && (
                      <Input label="Kat" placeholder="örn. 3, 5" value={floor} onChangeText={(t) => { setFloor(t); setError(""); }} keyboardType="numeric" leftIcon="arrow-up" />
                    )}
                    {fields.unitNo && (
                      <Input label="Daire Numarası *" placeholder="örn. 12, A-04" value={unitNo} onChangeText={(t) => { setUnitNo(t); setError(""); }} leftIcon="hash" />
                    )}
                    {fields.villaNo && (
                      <Input label="Villa Numarası *" placeholder="örn. V-12" value={villaNo} onChangeText={(t) => { setVillaNo(t); setError(""); }} leftIcon="home" />
                    )}
                    {fields.officeNo && (
                      <Input label="Ofis Numarası *" placeholder="örn. 301, B-12" value={officeNo} onChangeText={(t) => { setOfficeNo(t); setError(""); }} leftIcon="briefcase" />
                    )}

                    <View style={[styles.kvkkInfoBox, { backgroundColor: "#f0fdf4", borderRadius: colors.radius - 4, borderColor: colors.primary + "30" }]}>
                      <Feather name="info" size={12} color={colors.primary} />
                      <Text style={[styles.kvkkInfoText, { color: colors.primary }]}>
                        {fields.tower && "Kule, "}
                        {fields.block && "Blok, "}
                        {fields.villaNo && "Villa numarası, "}
                        {fields.officeNo && "Ofis numarası, "}
                        {fields.unitNo && "Daire numarası "}
                        aynı sitedeki diğer kullanıcılar tarafından görüntülenebilir.
                        Telefon, e-posta ve finansal bilgileriniz gizlidir.
                      </Text>
                    </View>

                    {/* Plates — optional */}
                    <View style={[styles.plateSection, { borderColor: colors.border, borderRadius: colors.radius }]}>
                      <View style={styles.plateSectionHeader}>
                        <Feather name="truck" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.plateSectionTitle, { color: colors.foreground }]}>Araç Plakası</Text>
                        <View style={[styles.optionalBadge, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                          <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>İsteğe bağlı</Text>
                        </View>
                      </View>
                      <View style={styles.fields}>
                        <Input label="Araç Plakası 1" placeholder="örn. 34 ABC 123" value={plate1} onChangeText={(t) => setPlate1(t.toUpperCase())} leftIcon="truck" autoCapitalize="characters" />
                        {plate1.trim() && (
                          <Input label="Araç Plakası 2" placeholder="örn. 34 XYZ 456" value={plate2} onChangeText={(t) => setPlate2(t.toUpperCase())} leftIcon="truck" autoCapitalize="characters" />
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ── STEP: MERCHANT BUSINESS INFO ── */}
              {isMerchant && (
                <View style={styles.section}>
                  <StepHeader num={3} title="İşletme Bilgileri" colors={colors} />
                  <View style={styles.fields}>
                    <Input label="İşletme Adı *" placeholder="örn. Ali Elektrik" value={businessName} onChangeText={(t) => { setBusinessName(t); setError(""); }} leftIcon="shopping-bag" />

                    <View>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Sektör *</Text>
                      <View style={styles.sectorGrid}>
                        {MERCHANT_SECTORS.map((s) => {
                          const active = businessCategory === s.value;
                          return (
                            <Pressable
                              key={s.value}
                              onPress={() => { setBusinessCategory(s.value); setError(""); }}
                              style={[styles.sectorChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.card, borderWidth: active ? 2 : 1, borderRadius: colors.radius - 4 }]}
                            >
                              <Feather name={s.icon} size={13} color={active ? colors.primary : colors.mutedForeground} />
                              <Text style={[styles.sectorChipText, { color: active ? colors.primary : colors.foreground }]}>{s.value}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <Input label="Açıklama" placeholder="Verdiğiniz hizmetler..." value={businessDescription} onChangeText={setBusinessDescription} leftIcon="info" />
                    <Input label="İşletme Adresi" placeholder="Cadde / sokak / ilçe" value={businessAddress} onChangeText={setBusinessAddress} leftIcon="map-pin" />

                    <Pressable
                      onPress={handleGetLocation}
                      disabled={locationLoading}
                      style={[styles.locationBtn, { borderColor: merchantLat ? colors.primary : colors.border, backgroundColor: merchantLat ? colors.primaryLight : colors.card, borderRadius: colors.radius }]}
                    >
                      <Feather name={merchantLat ? "check-circle" : "map-pin"} size={16} color={merchantLat ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.locationBtnText, { color: merchantLat ? colors.primary : colors.mutedForeground }]}>
                        {locationLoading ? "Konum alınıyor..." : merchantLat ? "Konum alındı ✓" : "GPS Konumumu Al (Önerilen)"}
                      </Text>
                    </Pressable>
                    {locationMsg ? <Text style={[styles.locationMsg, { color: colors.mutedForeground }]}>{locationMsg}</Text> : null}
                  </View>
                </View>
              )}

              {/* ── KVKK CONSENT ── */}
              <View style={[styles.kvkkCard, { borderRadius: colors.radius, borderColor: kvkkAccepted ? colors.primary + "50" : colors.border, backgroundColor: kvkkAccepted ? colors.primaryLight : colors.card }]}>
                <Text style={[styles.kvkkTitle, { color: colors.foreground }]}>KVKK Aydınlatma Metni</Text>
                <Text style={[styles.kvkkBody, { color: colors.mutedForeground }]}>
                  Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında bilginize sunarız:{"\n\n"}
                  • <Text style={{ fontFamily: "Inter_600SemiBold" }}>Görüntülenebilecek bilgiler:</Text> Ad Soyad, Blok/Kule/Villa bilgileri ve Daire/Ofis numarası aynı site içerisindeki diğer kullanıcılar tarafından görüntülenebilir.{"\n\n"}
                  • <Text style={{ fontFamily: "Inter_600SemiBold" }}>Gizli tutulan bilgiler:</Text> Telefon, e-posta, finansal bilgiler ve ödeme bilgileriniz diğer kullanıcılara kesinlikle gösterilmez.{"\n\n"}
                  • TC Kimlik numarası sistemimizde toplanmamaktadır.{"\n\n"}
                  Devam ederek kişisel verilerinizin yukarıda belirtilen şekilde işlenmesine onay vermiş olursunuz.
                </Text>
                <Pressable
                  onPress={() => setKvkkAccepted(!kvkkAccepted)}
                  style={styles.kvkkCheckRow}
                >
                  <View style={[styles.kvkkCheck, { borderColor: kvkkAccepted ? colors.primary : colors.border, backgroundColor: kvkkAccepted ? colors.primary : "transparent", borderRadius: 4 }]}>
                    {kvkkAccepted && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={[styles.kvkkCheckLabel, { color: colors.foreground }]}>
                    Aydınlatma metnini okudum ve kabul ediyorum.
                  </Text>
                </Pressable>
              </View>

              {/* ── ERROR ── */}
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "#fee2e2", borderRadius: colors.radius - 2 }]}>
                  <Feather name="alert-circle" size={15} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              ) : null}

              <Button
                title={loading ? "Kaydediliyor..." : "Hesap Oluştur"}
                onPress={handleRegister}
                disabled={loading}
                size="lg"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────

function StepHeader({ num, title, required, colors }: { num: number; title: string; required?: boolean; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.stepNum}>{num}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{title}</Text>
        {required && <Text style={[styles.requiredDot, { color: colors.destructive }]}>● Zorunlu</Text>}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  section: { gap: 12 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNum: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  stepTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  requiredDot: { fontSize: 11, fontFamily: "Inter_500Medium" },
  helperText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  fields: { gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  primaryRoleRow: { flexDirection: "row", gap: 10 },
  primaryRoleBtn: { flex: 1, padding: 14, gap: 8, position: "relative" },
  primaryRoleIcon: { padding: 10, alignSelf: "flex-start" },
  primaryRoleLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  primaryRoleDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  checkCircle: { position: "absolute", top: 10, right: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  secondaryRoleRow: { flexDirection: "row", gap: 8 },
  secondaryRoleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  secondaryRoleLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  joinCodeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lookupBtn: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  joinCodeFeedback: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10 },
  joinCodeFeedbackText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoNote: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, marginTop: 4 },
  infoNoteText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  settlementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  settlementChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  settlementChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  kvkkInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderWidth: 1 },
  kvkkInfoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  plateSection: { borderWidth: 1, padding: 12, gap: 10 },
  plateSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  plateSectionTitle: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  optionalBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  optionalText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sectorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectorChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  sectorChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  locationBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1 },
  locationBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  locationMsg: { fontSize: 12, fontFamily: "Inter_400Regular" },
  kvkkCard: { borderWidth: 1, padding: 16, gap: 12 },
  kvkkTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  kvkkBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  kvkkCheckRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  kvkkCheck: { width: 20, height: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  kvkkCheckLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  successCard: { alignItems: "center", padding: 24, gap: 12, borderWidth: 1 },
  successTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  successMsg: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
