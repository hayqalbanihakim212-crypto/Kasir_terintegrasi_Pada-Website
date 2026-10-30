import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../src/state/store";
import { C, F, useAccent } from "../../src/ui";

const icon = (name) => ({ color, size }) => <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  const { isOwner, orders } = useApp();
  const a = useAccent();
  const waiting = orders.filter((o) => ["pending", "paid", "making", "ready"].includes(o.status)).length;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontFamily: F.head, fontWeight: "400" },
        tabBarLabelStyle: { fontFamily: F.bold },
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
        tabBarActiveTintColor: a,
        tabBarInactiveTintColor: C.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Antrean",
          tabBarIcon: icon("receipt-outline"),
          tabBarBadge: waiting || undefined,
          tabBarBadgeStyle: { backgroundColor: a },
        }}
      />
      <Tabs.Screen name="kasir" options={{ title: "Kasir", tabBarIcon: icon("cart-outline") }} />
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: icon("restaurant-outline") }} />
      <Tabs.Screen
        name="laporan"
        options={{ title: "Laporan", tabBarIcon: icon("stats-chart-outline"), href: isOwner ? undefined : null }}
      />
      <Tabs.Screen name="lainnya" options={{ title: "Lainnya", tabBarIcon: icon("ellipsis-horizontal") }} />
    </Tabs>
  );
}
