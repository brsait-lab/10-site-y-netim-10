import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RootIndex() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  switch (user.role) {
    case "admin": return <Redirect href="/(admin)" />;
    case "resident": return <Redirect href="/(resident)" />;
    case "security": return <Redirect href="/(security)" />;
    case "merchant": return <Redirect href="/(merchant)" />;
    default: return <Redirect href="/(auth)/login" />;
  }
}
