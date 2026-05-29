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
import { useAuth, UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { LogoBadge } from "@/components/TreeLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ROLES: { key: UserRole; label: string; icon: string }[] = [
  { key: "resident", label: "Sakin", icon: "🏠" },
  { key: "security", label: "Güvenlik", icon: "🛡️" },
  { key: "merchant", label: "Esnaf", icon: "🏪" },
  { key: "admin", label: "Yönetici", icon: "⚙️" },
];

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
      setError("Lütfen tüm alanları doldurun.");
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
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) + 20,
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <LogoBadge size={72} bgColor={colors.primary} iconColor="#fff" />
            <Text style={[styles.appName, { color: colors.foreground }]}>Site Yönetim</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Güvenli ve modern site yönetim sistemi
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 2, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Giriş Yap</Text>

            <View style={styles.roleGrid}>
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setRole(r.key)}
                    style={[
                      styles.roleBtn,
                      {
                        borderRadius: colors.radius,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primaryLight : colors.muted,
                      },
                    ]}
                  >
                    <Text style={styles.roleIcon}>{r.icon}</Text>
                    <Text
                      style={[
                        styles.roleLabel,
                        { color: active ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
              <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderRadius: colors.radius }]}>
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <Button
              title="Giriş Yap"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>

          <Pressable onPress={() => router.push("/(auth)/register")} style={styles.registerLink}>
            <Text style={[styles.registerText, { color: colors.mutedForeground }]}>
              Hesabınız yok mu?{" "}
              <Text style={[styles.registerHighlight, { color: colors.primary }]}>Kayıt Ol</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  header: { alignItems: "center", gap: 10 },
  appName: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: {
    padding: 24,
    gap: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    minWidth: "44%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    gap: 4,
  },
  roleIcon: { fontSize: 20 },
  roleLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fields: { gap: 14 },
  errorBox: { padding: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  registerLink: { alignItems: "center", paddingVertical: 4 },
  registerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  registerHighlight: { fontFamily: "Inter_600SemiBold" },
});
