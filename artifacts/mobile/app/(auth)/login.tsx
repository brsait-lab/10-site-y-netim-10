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
import { LogoBadge } from "@/components/TreeLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ROLES: {
  key: UserRole;
  label: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "admin", label: "Yönetici", sub: "Site yöneticisi", icon: "settings" },
  { key: "resident", label: "Sakin", sub: "Daire sahibi / kiracı", icon: "home" },
  { key: "security", label: "Güvenlik", sub: "Güvenlik görevlisi", icon: "shield" },
  { key: "merchant", label: "Esnaf", sub: "İşletme sahibi", icon: "shopping-bag" },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [step, setStep] = useState<"role" | "form">("role");
  const [role, setRole] = useState<UserRole>("resident");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRole = ROLES.find((r) => r.key === role)!;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleSelectRole = (r: UserRole) => {
    setRole(r);
    setError("");
    setStep("form");
  };

  const handleBack = () => {
    setStep("role");
    setError("");
    setEmail("");
    setPassword("");
  };

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

  if (step === "role") {
    return (
      <View style={[styles.root, { backgroundColor: colors.primary }]}>
        <ScrollView
          contentContainerStyle={[styles.roleScroll, { paddingTop: topPad + 32, paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={[styles.logoBg, { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 28 }]}>
              <LogoBadge size={64} bgColor="transparent" iconColor="#fff" />
            </View>
            <Text style={styles.appName}>Site Yönetim</Text>
            <Text style={styles.tagline}>Nasıl giriş yapıyorsunuz?</Text>
          </View>

          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => handleSelectRole(r.key)}
                style={({ pressed }) => [
                  styles.roleCard,
                  { backgroundColor: pressed ? "rgba(255,255,255,0.92)" : "#fff", borderRadius: 20 },
                ]}
              >
                <View style={[styles.roleIconWrap, { backgroundColor: colors.primaryLight, borderRadius: 16 }]}>
                  <Feather name={r.icon} size={26} color={colors.primary} />
                </View>
                <Text style={[styles.roleLabel, { color: colors.foreground }]}>{r.label}</Text>
                <Text style={[styles.roleSub, { color: colors.mutedForeground }]}>{r.sub}</Text>
                <View style={[styles.roleArrow, { backgroundColor: colors.primaryLight, borderRadius: 12 }]}>
                  <Feather name="arrow-right" size={14} color={colors.primary} />
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => router.push("/(auth)/register")} style={styles.registerLink}>
            <Text style={styles.registerLinkText}>Hesabınız yok mu? </Text>
            <Text style={[styles.registerLinkBold, { color: "#fff" }]}>Kayıt Ol</Text>
          </Pressable>

          <View style={styles.footer}>
            <Feather name="shield" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.footerText}>KVKK Uyumlu · Güvenli Bağlantı</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.formScroll, { paddingTop: topPad + 16, paddingBottom: botPad + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
            <Text style={styles.backText}>Rol Seçimi</Text>
          </Pressable>

          <View style={styles.hero}>
            <View style={[styles.logoBg, { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 28 }]}>
              <LogoBadge size={56} bgColor="transparent" iconColor="#fff" />
            </View>
            <Text style={styles.appName}>Site Yönetim</Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.background, borderRadius: 28, shadowColor: "#000" }]}>
            <View style={[styles.roleChip, { backgroundColor: colors.primaryLight, borderRadius: 14 }]}>
              <Feather name={selectedRole.icon} size={16} color={colors.primary} />
              <Text style={[styles.roleChipText, { color: colors.primary }]}>{selectedRole.label}</Text>
            </View>

            <Text style={[styles.formTitle, { color: colors.foreground }]}>Giriş Yapın</Text>

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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  roleScroll: { paddingHorizontal: 20, gap: 28 },
  formScroll: { paddingHorizontal: 20, gap: 20 },
  hero: { alignItems: "center", gap: 10 },
  logoBg: { padding: 16 },
  appName: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  roleCard: {
    width: "47%", flexGrow: 1, padding: 20, gap: 10, alignItems: "flex-start",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
  },
  roleIconWrap: { padding: 12 },
  roleLabel: { fontSize: 17, fontFamily: "Inter_700Bold" },
  roleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -4 },
  roleArrow: { padding: 7, marginTop: 4 },
  registerLink: { flexDirection: "row", justifyContent: "center" },
  registerLinkText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  registerLinkBold: { fontSize: 14, fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.9)" },
  formCard: {
    padding: 24, gap: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  roleChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, alignSelf: "flex-start" },
  roleChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  formTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: -4 },
  fields: { gap: 14 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  registerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  registerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7 },
  registerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
