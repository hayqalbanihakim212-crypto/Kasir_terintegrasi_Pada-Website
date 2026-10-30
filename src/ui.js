import React, { createContext, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const C = {
  bg: "#E9E2D2", // kertas kraft
  surface: "#FBF8F1", // gading
  sunk: "#F1EADB",
  text: "#231B14", // tinta kopi
  muted: "#6A5C4B",
  line: "#D8CDB4",
  ok: "#1F6B4A",
  bad: "#A8362B",
  warn: "#8A5E00",
};
// Judul memakai Young Serif, isi memakai Figtree (dimuat di app/_layout.js)
export const F = { head: "YoungSerif_400Regular", body: "Figtree_500Medium", bold: "Figtree_700Bold" };
export const ACCENTS = ["#A8362B", "#1F5E3E", "#2E4A86", "#B98512", "#6B4426", "#14746F", "#7A3E8E"];

const AccentCtx = createContext("#A8362B");
export const AccentProvider = AccentCtx.Provider;
export const useAccent = () => useContext(AccentCtx);

// teks gelap/terang di atas warna aksen, supaya selalu terbaca
export const onColor = (hex) => {
  const h = String(hex || "#A8362B").replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16) || 0;
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? "#111" : "#fff";
};

export const Screen = ({ children, scroll = true, pad = true, style }) => {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[pad && { padding: 16, paddingBottom: 48 }, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad && { padding: 16 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {body}
    </SafeAreaView>
  );
};

export const H = ({ children, style }) => (
  <Text style={[{ color: C.text, fontSize: 22, fontFamily: F.head, marginTop: 20, marginBottom: 8 }, style]}>
    {children}
  </Text>
);
export const T = ({ children, style, ...p }) => (
  <Text style={[{ color: C.text, fontSize: 15, fontFamily: F.body }, style]} {...p}>
    {children}
  </Text>
);
export const Muted = ({ children, style, ...p }) => (
  <Text style={[{ color: C.muted, fontSize: 13, fontFamily: F.body }, style]} {...p}>
    {children}
  </Text>
);

export const Card = ({ children, style, accent }) => {
  const a = useAccent();
  return (
    <View
      style={[
        {
          backgroundColor: C.surface,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: accent ? a : C.line,
          padding: 14,
          marginVertical: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Row = ({ children, style }) => (
  <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, style]}>
    {children}
  </View>
);

export function Btn({ title, onPress, variant = "solid", small, disabled, loading, style }) {
  const a = useAccent();
  const solid = variant === "solid";
  const danger = variant === "danger";
  const bg = solid ? a : "transparent";
  const fg = solid ? onColor(a) : danger ? C.bad : a;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : 48,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: solid ? 0 : 1,
          borderColor: danger ? C.bad : a,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          marginVertical: small ? 0 : 6,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontFamily: F.bold, fontSize: small ? 13 : 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export const Field = ({ label, style, ...p }) => (
  <View style={[{ marginVertical: 6 }, style]}>
    {label ? <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 13, marginBottom: 4 }}>{label}</Text> : null}
    <TextInput
      placeholderTextColor="#9A8E7A"
      autoCapitalize="none"
      style={{
        minHeight: 46,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#B9AC93",
        fontFamily: F.body,
        backgroundColor: C.sunk,
        color: C.text,
        paddingHorizontal: 12,
        fontSize: 15,
      }}
      {...p}
    />
  </View>
);

export function Pills({ items, value, onChange, style }) {
  const a = useAccent();
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }, style]}>
      {items.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable
            key={String(k)}
            onPress={() => onChange(k)}
            style={{
              minHeight: 36,
              paddingHorizontal: 14,
              borderRadius: 99,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: a,
              backgroundColor: on ? a : "transparent",
            }}
          >
            <Text style={{ color: on ? onColor(a) : C.text, fontFamily: F.bold, fontSize: 13 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ text, color }) {
  const a = useAccent();
  const bg = color || a;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2 }}>
      <Text style={{ color: onColor(bg), fontSize: 12, fontFamily: F.bold }}>{text}</Text>
    </View>
  );
}

export const Banner = ({ text, bad }) =>
  text ? (
    <View
      style={{
        borderWidth: 1,
        borderColor: bad ? C.bad : C.ok,
        borderRadius: 12,
        padding: 12,
        marginVertical: 8,
      }}
    >
      <Text style={{ color: bad ? C.bad : C.ok, fontWeight: "600" }}>{text}</Text>
    </View>
  ) : null;

export const Toggle = ({ label, value, onValueChange, hint }) => {
  const a = useAccent();
  return (
    <View style={{ marginVertical: 8 }}>
      <Row>
        <Text style={{ color: C.text, fontWeight: "600", flex: 1 }}>{label}</Text>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: a, false: "#C9BFA8" }} />
      </Row>
      {hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
};

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(35,27,20,.5)", justifyContent: "flex-end" }}>
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            maxHeight: "92%",
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <Row style={{ padding: 16, paddingBottom: 0 }}>
            <Text style={{ color: C.text, fontSize: 20, fontFamily: F.head, flex: 1 }}>{title}</Text>
            <Btn title="Tutup" variant="ghost" small onPress={onClose} />
          </Row>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const Center = ({ children }) => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: C.bg }}>
    {children}
  </View>
);

export const Divider = () => <View style={{ height: 1, backgroundColor: C.line, marginVertical: 6 }} />;
export const s = StyleSheet;
