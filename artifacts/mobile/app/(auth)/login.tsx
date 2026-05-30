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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("resident");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24 }]}
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
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Rolünüzü seçerek devam edin</Text>

            {/* ── PRIMARY SEGMENT: Sakin / Güvenlik ── */}
            <View style={[styles.segmentWrapper, { backgroundColor: colors.muted, borderRadius: 14 }]}>
              {(["resident", "security"] as UserRole[]).map((r, i) => {
                const active = role === r;
                const label = r === "resident" ? "Sakin" : "Güvenlik";
                const icon: keyof typeof Feather.glyphMap = r === "resident" ? "home" : "shield";
                return (
                  <Pressable
                    key={r}
                    onPress={() => { setRole(r); setError(""); }}
                    style={[
                      styles.segment,
                      {
                        borderRadius: 11,
                        backgroundColor: active ? colors.card : "transparent",
                        shadowColor: active ? "#000" : "transparent",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: active ? 0.08 : 0,
                        shadowRadius: 6,
                        elevation: active ? 3 : 0,
                        borderWidth: active ? 1 : 0,
                        borderColor: active ? colors.border : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.segmentIconWrap, { backgroundColor: active ? colors.primaryLight : "transparent", borderRadius: 10 }]}>
                      <Feather name={icon} size={18} color={active ? colors.primary : colors.mutedForeground} />
                    </View>
                    <Text style={[styles.segmentLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {label}
                    </Text>
                    {active && (
                      <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── SECONDARY CHIPS: Esnaf / Yönetici ── */}
            <View style={styles.chipRow}>
              {(["merchant", "admin"] as UserRole[]).map((r) => {
                const active = role === r;
                const label = r === "merchant" ? "Esnaf" : "Yönetici";
                const icon: keyof typeof Feather.glyphMap = r === "merchant" ? "shopping-bag" : "settings";
                return (
                  <Pressable
                    key={r}
                    onPress={() => { setRole(r); setError(""); }}
                    style={[
                      styles.chip,
                      {
                        borderRadius: 22,
                        backgroundColor: active ? colors.primaryLight : colors.muted,
                        borderColor: active ? colors.primary : "transparent",
                        borderWidth: active ? 1.5 : 0,
                      },
                    ]}
                  >
                    <Feather name={icon} size={14} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.chipLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.chipHint, { color: colors.mutedForeground }]}>İş hesabı</Text>
            </View>

            {/* ── ROLE INDICATOR ── */}
            <View style={[styles.roleIndicator, { backgroundColor: colors.primaryLight, borderRadius: 10, borderColor: colors.primary + "30" }]}>
              <Feather
                name={role === "resident" ? "home" : role === "security" ? "shield" : role === "merchant" ? "shopping-bag" : "settings"}
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.roleIndicatorText, { color: colors.primary }]}>
                {{
                  resident: "Sakin olarak giriş yapıyorsunuz",
                  security: "Güvenlik görevlisi olarak giriş yapıyorsunuz",
                  merchant: "Esnaf olarak giriş yapıyorsunuz",
                  admin: "Yönetici olarak giriş yapıyorsunuz",
                }[role]}
              </Text>
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

            {/* ── ERROR ── */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderRadius: 10, borderColor: "#fca5a5" }]}>
                <Feather name="alert-circle" size={15} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            {/* ── SUBMIT ── */}
            <Button title="Giriş Yap" onPress={handleLogin} loading={loading} fullWidth size="lg" />

            {/* ── REGISTER ── */}
            <Pressable onPress={() => router.push("/(auth)/register")} style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.mutedForeground }]}>Hesabınız yok mu?</Text>
              <View style={[styles.registerBtn, { backgroundColor: colors.primaryLight, borderRadius: 20 }]}>
                <Text style={[styles.registerBtnText, { color: colors.primary }]}>Kayıt Ol</Text>
                <Feather name="arrow-right" size={13} color={colors.primary} />
              </View>
            </Pressable>
          </View>

          {/* ── FOOTER ── */}
          <View style={styles.footer}>
            <View style={[styles.footerBadge, { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20 }]}>
              <Feather name="shield" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.footerText}>KVKK Uyumlu · Güvenli Bağlantı</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },

  /* hero */
  hero: { alignItems: "center", gap: 10, paddingBottom: 4 },
  logoBg: { padding: 18, marginBottom: 2 },
  appName: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },

  /* card */
  card: {
    padding: 24,
    gap: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -10 },

  /* segmented control */
  segmentWrapper: { flexDirection: "row", padding: 4, gap: 4, height: 76 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, position: "relative", margin: 0 },
  segmentIconWrap: { padding: 8 },
  segmentLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activeDot: { position: "absolute", bottom: 8, width: 4, height: 4, borderRadius: 2 },

  /* chips */
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  chipDivider: { width: 1, height: 20, marginHorizontal: 4 },
  chipHint: { fontSize: 12, fontFamily: "Inter_400Regular" },

  /* indicator */
  roleIndicator: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  roleIndicatorText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  /* fields */
  fields: { gap: 14 },

  /* error */
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },

  /* register */
  registerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  registerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7 },
  registerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* footer */
  footer: { alignItems: "center", paddingBottom: 8 },
  footerBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
});
