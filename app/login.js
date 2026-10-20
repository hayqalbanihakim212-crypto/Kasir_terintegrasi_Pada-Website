import React, { useState } from "react";
import { Text, View } from "react-native";
import { Screen, Btn, Field, Banner, Muted, Pills, C } from "../src/ui";
import { supabase, errMsg } from "../src/lib/supabase";
import { useApp } from "../src/state/store";

export default function Login() {
  const { configured } = useApp();
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit() {
    const e = email.trim();
    if (!e || pw.length < 8) return setMsg({ bad: 1, t: "Isi email dan password (minimal 8 karakter)." });
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password: pw });
        if (error) throw error;
        if (!data.session) setMsg({ t: "Akun dibuat. Cek email untuk konfirmasi, lalu masuk." }), setMode("in");
      }
    } catch (x) {
      setMsg({ bad: 1, t: errMsg(x) });
    }
    setBusy(false);
  }

  async function reset() {
    if (!email.trim()) return setMsg({ bad: 1, t: "Isi email dulu." });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setMsg(error ? { bad: 1, t: errMsg(error) } : { t: "Tautan reset dikirim ke email kamu." });
  }

  return (
    <Screen>
      <View style={{ marginTop: 72, marginBottom: 12 }}>
        <Text style={{ color: C.text, fontSize: 34, fontWeight: "800" }}>Kasir</Text>
        <Muted>Satu aplikasi untuk banyak toko. Masuk atau daftar sebagai pemilik.</Muted>
      </View>
      {!configured && (
        <Banner
          bad
          text="Supabase belum diatur. Salin .env.example menjadi .env, isi URL dan anon key, lalu jalankan ulang."
        />
      )}
      <Pills items={[["in", "Masuk"], ["up", "Daftar"]]} value={mode} onChange={setMode} />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" />
      {msg && <Banner bad={msg.bad} text={msg.t} />}
      <Btn title={mode === "in" ? "Masuk" : "Buat akun"} onPress={submit} loading={busy} disabled={!configured} />
      {mode === "in" && <Btn title="Lupa password" variant="ghost" onPress={reset} disabled={!configured} />}
      <Muted style={{ marginTop: 16 }}>
        Staf: daftar dulu di sini, lalu minta pemilik menambahkan email kamu di menu Staf.
      </Muted>
    </Screen>
  );
}
