import React, { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen, Card, Row, Field, Btn, Banner, Muted, Chip, H, C } from "../src/ui";
import { supabase, errMsg } from "../src/lib/supabase";
import { useApp } from "../src/state/store";

export default function Staf() {
  const { shop, isOwner, session } = useApp();
  const [list, setList] = useState([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("list_members", { p_shop: shop.id });
    setList(data || []);
  }, [shop.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isOwner) return <Screen><Muted>Hanya pemilik yang bisa mengelola staf.</Muted></Screen>;

  async function add() {
    setBusy(true);
    const { error } = await supabase.rpc("add_staff", { p_shop: shop.id, p_email: email });
    setBusy(false);
    if (error) return setMsg({ bad: 1, t: errMsg(error) });
    setEmail("");
    setMsg({ t: "Staf ditambahkan." });
    load();
  }
  function remove(m) {
    Alert.alert("Hapus staf?", `${m.email} tidak bisa lagi mengakses toko ini.`, [
      { text: "Batal" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("remove_staff", { p_shop: shop.id, p_user: m.user_id });
          if (error) Alert.alert("Gagal", errMsg(error));
          load();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Muted>Staf bisa memakai Kasir, Antrian, dan mengatur stok. Staf tidak bisa melihat laporan atau mengubah pengaturan.</Muted>
      <Field label="Email staf (sudah terdaftar di aplikasi)" value={email} onChangeText={setEmail} keyboardType="email-address" />
      {msg && <Banner bad={msg.bad} text={msg.t} />}
      <Btn title="Tambah staf" onPress={add} loading={busy} disabled={!email.includes("@")} />
      <H>Anggota</H>
      {list.map((m) => (
        <Card key={m.user_id}>
          <Row>
            <Text style={{ color: C.text, flex: 1 }}>{m.email}</Text>
            <Chip text={m.role === "owner" ? "PEMILIK" : "STAF"} />
          </Row>
          {m.role !== "owner" && m.user_id !== session.user.id && (
            <Btn small variant="danger" title="Hapus" style={{ marginTop: 8, alignSelf: "flex-end" }} onPress={() => remove(m)} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
