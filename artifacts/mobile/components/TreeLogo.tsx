import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";

interface TreeLogoProps {
  size?: number;
  color?: string;
}

export function TreeLogo({ size = 40, color = "#ffffff" }: TreeLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path
        d="M50 10 L30 40 H40 L22 65 H40 L30 85 H70 L60 65 H78 L60 40 H70 Z"
        fill={color}
      />
      <Rect x="44" y="82" width="12" height="10" rx="3" fill={color} />
    </Svg>
  );
}

interface LogoBadgeProps {
  size?: number;
  bgColor?: string;
  iconColor?: string;
}

export function LogoBadge({ size = 48, bgColor = "#16a34a", iconColor = "#ffffff" }: LogoBadgeProps) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: bgColor }]}>
      <TreeLogo size={size * 0.65} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
});
