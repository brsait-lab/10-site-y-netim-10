import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { LogoBadge } from "@/components/TreeLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ROLE_OPTIONS: {
  key: UserRole;
  label: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "resident", label: "Sakin", sub: "Daire sahibi veya kiracı", icon: "home" },
  { key: "security", label: "Güvenlik Görevlisi", sub: "Güvenlik / personel", icon: "shield" },
  { key: "merchant", label: "Esnaf", sub: "İşletme sahibi", icon: "shopping-bag" },
  { key: "admin", label: "Yönetici", sub: "Site yöneticisi", icon: "settings" },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("resident");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = ROLE_OPTIONS.find((r) => r.key === role)!;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Lütfen e-posta ve şifrenizi girin.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(email.trim(), password, role);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    } else {
      switch (role) {
        case "admin": router.replace("/(admin)"); break;
        case "resident": router.replace("/(resident)"); break;
        case "security": router.replace("/(security)"); break;
        case "merchant": router.replace("/(merchant)"); break;
      }
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── HERO ── */}
          <View style={styles.hero}>
            <View style={[styles.logoBg, { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 28 }]}>
              <LogoBadge size={64} bgColor="transparent" iconColor="#fff" />
            </View>
            <Text style={styles.appName}>Site Yönetim</Text>
            <Text style={styles.tagline}>Sitenizi kolayca yönetin</Text>
          </View>

          {/* ── CARD ── */}
          <View style={[styles.card, { backgroundColor: colors.background, borderRadius: 28, shadowColor: "#000" }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Hesabınıza Giriş Yapın</Text>

            {/* ── ROLE PICKER BUTTON ── */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Kullanıcı Tipi</Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={[
                  styles.rolePickerBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    borderRadius: colors.radius,
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={[styles.rolePickerIcon, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
                  <Feather name={selectedRole.icon} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rolePickerLabel, { color: colors.foreground }]}>{selectedRole.label}</Text>
                  <Text style={[styles.rolePickerSub, { color: colors.mutedForeground }]}>{selectedRole.sub}</Text>
                </View>
                <View style={[styles.changeChip, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
                  <Feather name="chevron-down" size={14} color={colors.primary} />
                  <Text style={[styles.changeText, { color: colors.primary }]}>Değiştir</Text>
                </View>
              </Pressable>
            </View>

            {/* ── FIELDS ── */}
            <View style={styles.fields}>
              <Input
                label="E-posta"
                placeholder="ornek@email.com"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail"
              />
              <Input
                label="Şifre"
                placeholder="••••••••"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                isPassword
                leftIcon="lock"
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderRadius: 10, borderColor: "#fca5a5" }]}>
                <Feather name="alert-circle" size={15} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <Button title="Giriş Yap" onPress={handleLogin} loading={loading} fullWidth size="lg" />

            <Pressable onPress={() => router.push("/(auth)/register")} style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.mutedForeground }]}>Hesabınız yok mu?</Text>
              <View style={[styles.registerBtn, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
                <Text style={[styles.registerBtnText, { color: colors.primary }]}>Kayıt Ol</Text>
                <Feather name="arrow-right" size={13} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={[styles.footerBadge, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20 }]}>
              <Feather name="shield" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.footerText}>KVKK Uyumlu · Güvenli Bağlantı</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── ROLE PICKER MODAL ── */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: colors.background, borderRadius: 24, shadowColor: "#000" }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Kullanıcı Tipi Seçin</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Sisteme hangi rolde giriş yapıyorsunuz?</Text>

            <View style={styles.modalOptions}>
              {ROLE_OPTIONS.map((r) => {
                const active = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => { setRole(r.key); setError(""); setPickerOpen(false); }}
                    style={[
                      styles.modalOption,
                      {
                        backgroundColor: active ? colors.primaryLight : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                        borderRadius: colors.radius,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: active ? colors.primary : colors.muted, borderRadius: 12 }]}>
                      <Feather name={r.icon} size={22} color={active ? "#fff" : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionLabel, { color: active ? colors.primary : colors.foreground }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.modalOptionSub, { color: colors.mutedForeground }]}>{r.sub}</Text>
                    </View>
                    {active && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.primary, borderRadius: 12 }]}>
                        <Feather name="check" size={14} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  hero: { alignItems: "center", gap: 10, paddingBottom: 4 },
  logoBg: { padding: 18, marginBottom: 2 },
  appName: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  card: {
    padding: 24, gap: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  rolePickerBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rolePickerIcon: { padding: 10 },
  rolePickerLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  rolePickerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  changeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  changeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  fields: { gap: 14 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  registerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  registerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7 },
  registerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  footer: { alignItems: "center" },
  footerBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    margin: 12, padding: 24, gap: 16,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -8 },
  modalOptions: { gap: 10 },
  modalOption: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  modalOptionIcon: { padding: 10 },
  modalOptionLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalOptionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  checkCircle: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
});
