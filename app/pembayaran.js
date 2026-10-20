import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Screen, Field, Btn, Banner, Muted, Pills, Card, T, H } from "../src/ui";
import { supabase, errMsg, SUPABASE_URL } from "../src/lib/supabase";
import { useApp } from "../src/state/store";

export default function Pembayaran() {
  const { shop, isOwner } = useApp();
  const [env, setEnv] = useState("sandbox");
  const [server, setServer] = useState("");
  const [client, setClient] = useState("");
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const hook = SUPABASE_URL + "/functions/v1/midtrans-webhook";

  useFocusEffect(
    useCallback(() => {
      supabase.rpc("midtrans_configured", { p_shop: shop.id }).then(({ data }) => setOk(!!data));
    }, [shop.id]),
  );
  if (!isOwner) return <Screen><Muted>Hanya pemilik.</Muted></Screen>;

  async function save() {
    const sb = env === "sandbox";
    if (!server.trim() || !client.trim()) return setMsg({ bad: 1, t: "Isi kedua kunci." });
    if (sb !== (server.startsWith("SB-") && client.startsWith("SB-")))
      return setMsg({ bad: 1, t: sb ? "Mode uji wajib memakai kunci berawalan SB-." : "Mode production tidak boleh memakai kunci SB-." });
    setBusy(true);
    const { error } = await supabase.rpc("set_midtrans", {
      p_shop: shop.id,
      p_server: server.trim(),
      p_client: client.trim(),
      p_env: env,
    });
    setBusy(false);
    if (error) return setMsg({ bad: 1, t: errMsg(error) });
    setServer("");
    setClient("");
    setOk(true);
    setMsg({ t: "Kunci tersimpan aman di server." });
  }

  return (
    <Screen>
      <Muted>
        Dipakai untuk pesanan dari website (QRIS, GoPay, ShopeePay lewat Midtrans). Kasir di aplikasi tidak memerlukan ini.
        Tiap toko memakai akun Midtrans sendiri, uang langsung masuk ke pemilik toko.
      </Muted>
      <Banner text={ok ? "Kunci Midtrans sudah tersimpan." : ""} />
      <Pills value={env} onChange={setEnv} items={[["sandbox", "Uji (sandbox)"], ["production", "Production"]]} />
      <Field label="Server key" value={server} onChangeText={setServer} secureTextEntry placeholder={ok ? "Sudah tersimpan, isi untuk mengganti" : "SB-Mid-server-..."} />
      <Field label="Client key" value={client} onChangeText={setClient} placeholder={ok ? "Sudah tersimpan, isi untuk mengganti" : "SB-Mid-client-..."} />
      {msg && <Banner bad={msg.bad} text={msg.t} />}
      <Btn title="Simpan kunci" onPress={save} loading={busy} />
      <H>Notification URL</H>
      <Muted>Tempel di Midtrans Dashboard, Settings, Payment, Notification URL:</Muted>
      <Card>
        <T selectable style={{ fontSize: 13 }}>{hook}</T>
      </Card>
      <Btn title="Salin URL" variant="ghost" onPress={() => Clipboard.setStringAsync(hook)} />
    </Screen>
  );
}
