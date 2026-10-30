import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "../src/state/store";
import { useFonts, Figtree_500Medium, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif";
import { AccentProvider, C, F } from "../src/ui";
import "../src/lib/confirm";

function Gate() {
  const { session, ready, shop, memberships } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const [fontsOk] = useFonts({ Figtree_500Medium, Figtree_700Bold, YoungSerif_400Regular });

  useEffect(() => {
    if (!ready) return;
    const g = segments[0];
    if (!session) {
      if (g !== "login") router.replace("/login");
    } else if (!memberships.length) {
      if (g !== "buat-toko") router.replace("/buat-toko");
    } else if (g === "login" || (g === "buat-toko" && !router.canGoBack())) {
      router.replace("/");
    }
  }, [ready, session, memberships.length, segments]);

  return (
    <AccentProvider value={(shop && shop.accent) || "#A8362B"}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontFamily: F.head, fontWeight: "400" },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="buat-toko" options={{ title: "Buat toko" }} />
        <Stack.Screen name="toko" options={{ title: "Profil toko" }} />
        <Stack.Screen name="meja" options={{ title: "Meja & QR" }} />
        <Stack.Screen name="staf" options={{ title: "Staf" }} />
        <Stack.Screen
          name="pembayaran"
          options={{ title: "Pembayaran online" }}
        />
        <Stack.Screen name="printer" options={{ title: "Printer struk" }} />
        <Stack.Screen name="website" options={{ title: "Website" }} />
        <Stack.Screen name="riwayat" options={{ title: "Riwayat pesanan" }} />
      </Stack>
      {(!ready || !fontsOk) && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: C.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color="#A8362B" size="large" />
        </View>
      )}
    </AccentProvider>
  );
}

export default function Root() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}
