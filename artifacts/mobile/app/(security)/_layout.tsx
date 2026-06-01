import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";

function NativeSecurityTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index"><Icon sf={{ default: "shield", selected: "shield.fill" }} /><Label>Panel</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="packages"><Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} /><Label>Kargolar</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="merchants"><Icon sf={{ default: "storefront", selected: "storefront.fill" }} /><Label>Esnaflar</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications"><Icon sf={{ default: "bell", selected: "bell.fill" }} /><Label>Bildirimler</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats"><Icon sf={{ default: "message.circle", selected: "message.circle.fill" }} /><Label>Sohbetler</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile"><Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} /><Label>Profil</Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicSecurityTabs() {
  const colors = useColors();
  const { unreadCount } = useData();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.mutedForeground,
      tabBarStyle: { position: "absolute", backgroundColor: isIOS ? "transparent" : colors.tabBar, borderTopWidth: 1, borderTopColor: colors.tabBarBorder, elevation: 0, height: isWeb ? 84 : 60 },
      tabBarBackground: () => isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} /> : null,
      tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: isWeb ? 0 : 4 },
    }}>
      <Tabs.Screen name="index" options={{ title: "Panel", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="shield.fill" tintColor={color} size={22} /> : <Feather name="shield" size={22} color={color} /> }} />
      <Tabs.Screen name="packages" options={{ title: "Kargolar", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="shippingbox.fill" tintColor={color} size={22} /> : <Feather name="package" size={22} color={color} /> }} />
      <Tabs.Screen name="merchants" options={{ title: "Esnaflar", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="storefront.fill" tintColor={color} size={22} /> : <Feather name="shopping-bag" size={22} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler", tabBarBadge: unreadCount > 0 ? unreadCount : undefined, tabBarIcon: ({ color }) => isIOS ? <SymbolView name="bell.fill" tintColor={color} size={22} /> : <Feather name="bell" size={22} color={color} /> }} />
      <Tabs.Screen name="chats" options={{ title: "Sohbetler", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="message.circle.fill" tintColor={color} size={22} /> : <Feather name="message-circle" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="person.crop.circle.fill" tintColor={color} size={22} /> : <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}

export default function SecurityLayout() {
  if (isLiquidGlassAvailable()) return <NativeSecurityTabs />;
  return <ClassicSecurityTabs />;
}
