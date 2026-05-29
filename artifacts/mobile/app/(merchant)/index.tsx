import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function MerchantStoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [businessCategory, setBusinessCategory] = useState(user?.businessCategory || "");
  const [businessDescription, setBusinessDescription] = useState(user?.businessDescription || "");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await updateUser({ businessName, businessCategory, businessDescription });
    setLoading(false);
    setEditMode(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const services = [
    { icon: "clock" as const, label: "Çalışma Saati", value: "09:00 - 21:00" },
    { icon: "map-pin" as const, label: "Konum", value: "Site İçi" },
    { icon: "phone" as const, label: "İletişim", value: user?.phone || "Belirtilmedi" },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.storeName, { color: colors.foreground }]}>{user?.businessName || "Mağazam"}</Text>
            {user?.businessCategory && (
              <View style={[styles.categoryPill, { backgroundColor: colors.primaryLight, borderRadius: 10 }]}>
                <Text style={[styles.categoryText, { color: colors.primary }]}>{user.businessCategory}</Text>
              </View>
            )}
          </View>
          <Button
            title={editMode ? "Vazgeç" : "Düzenle"}
            onPress={() => setEditMode(!editMode)}
            variant={editMode ? "ghost" : "outline"}
            size="sm"
          />
        </View>

        {saved && (
          <View style={[styles.successBanner, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.successText, { color: colors.primary }]}>Mağaza bilgileri güncellendi!</Text>
          </View>
        )}

        {editMode ? (
          <View style={[styles.editCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>İŞLETME BİLGİLERİ</Text>
            <View style={styles.fields}>
              <Input label="İşletme Adı" value={businessName} onChangeText={setBusinessName} placeholder="İşletme adınız" leftIcon="briefcase" />
              <Input label="Kategori" value={businessCategory} onChangeText={setBusinessCategory} placeholder="örn. Market, Restoran..." leftIcon="tag" />
            </View>
            <Text style={[styles.descLabel, { color: colors.mutedForeground }]}>Açıklama</Text>
            <View style={[styles.descBox, { borderColor: colors.border, borderRadius: colors.radius - 2, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.descInput, { color: colors.foreground }]}
                placeholder="İşletmenizi tanıtın, ürün ve hizmetlerinizi belirtin..."
                placeholderTextColor={colors.mutedForeground}
                value={businessDescription}
                onChangeText={setBusinessDescription}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Button title="Kaydet" onPress={handleSave} loading={loading} fullWidth />
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MAĞAZA TANITIMI</Text>
              {user?.businessDescription ? (
                <Text style={[styles.description, { color: colors.foreground }]}>{user.businessDescription}</Text>
              ) : (
                <View style={styles.emptyDesc}>
                  <Feather name="edit-2" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.emptyDescText, { color: colors.mutedForeground }]}>
                    Henüz tanıtım yazısı eklenmedi. Düzenle butonuna tıklayarak işletmenizi tanıtın.
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>İLETİŞİM BİLGİLERİ</Text>
              {services.map((s, idx) => (
                <View key={s.label} style={[styles.serviceRow, idx < services.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={[styles.serviceIcon, { backgroundColor: colors.primaryLight, borderRadius: 8 }]}>
                    <Feather name={s.icon} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                    <Text style={[styles.serviceValue, { color: colors.foreground }]}>{s.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.statusCard, { backgroundColor: colors.primaryLight, borderRadius: colors.radius }]}>
              <Feather name="check-circle" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.primary }]}>Mağazanız Aktif</Text>
                <Text style={[styles.statusDesc, { color: colors.primary }]}>Site sakinleri mağazanızı görebilir ve sizinle iletişime geçebilir.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  storeName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  categoryPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  categoryText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  editCard: { padding: 16, gap: 14, borderWidth: 1 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  fields: { gap: 12 },
  descLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  descBox: { borderWidth: 1.5 },
  descInput: { padding: 12, minHeight: 100, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderWidth: 1, padding: 16, gap: 12 },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  emptyDesc: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emptyDescText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  serviceIcon: { padding: 8 },
  serviceLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  serviceValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
  statusTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
});
