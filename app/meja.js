import React, { useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import { Screen, Card, Field, Btn, Banner, Muted, Toggle, H, C } from "../src/ui";
import { supabase, errMsg } from "../src/lib/supabase";
import { tableUrl, tl, TAKE } from "../src/lib/format";
import { useApp } from "../src/state/store";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

export default function Meja() {
  const { shop, tables, reload, isOwner } = useApp();
  const numbered = tables.filter((t) => !t.is_takeaway);
  const [count, setCount] = useState(String(numbered.length || 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const refs = useRef({});

  if (!isOwner) return <Screen><Muted>Hanya pemilik yang bisa mengatur meja.</Muted></Screen>;
  const n = Math.floor(Number(count));
  const noUrl = !shop.website_url;

  async function save() {
    if (!(n >= 1 && n <= 60)) return setMsg({ bad: 1, t: "Jumlah meja harus 1 sampai 60." });
    const gone = numbered.filter((t) => Number(t.label) > n);
    const run = async () => {
      setBusy(true);
      try {
        const have = new Set(numbered.map((t) => Number(t.label)));
        const add = [];
        for (let i = 1; i <= n; i++) if (!have.has(i)) add.push({ shop_id: shop.id, label: String(i) });
        if (add.length) {
          const r = await supabase.from("tables").insert(add);
          if (r.error) throw r.error;
        }
        if (gone.length) {
          const r = await supabase.from("tables").delete().in("id", gone.map((t) => t.id));
          if (r.error) throw r.error;
        }
        await reload();
        setMsg({ t: `Tersimpan: ${n} meja.` });
      } catch (e) {
        setMsg({ bad: 1, t: errMsg(e) });
      }
      setBusy(false);
    };
    if (gone.length)
      Alert.alert("Hapus meja?", `${gone.length} QR akan dihapus dan tidak berlaku lagi.`, [
        { text: "Batal" },
        { text: "Lanjut", style: "destructive", onPress: run },
      ]);
    else run();
  }

  async function printAll() {
    try {
      const imgs = await Promise.all(
        tables.map(
          (t) =>
            new Promise((ok) => {
              const r = refs.current[t.id];
              r && r.toDataURL ? r.toDataURL((d) => ok([t, d])) : ok([t, null]);
            }),
        ),
      );
      const cards = imgs
        .filter(([, d]) => d)
        .map(
          ([t, d]) =>
            `<div class="c"><img src="data:image/png;base64,${d}" width="170" height="170"/><h2>${esc(tl(t.label))}</h2><small>${esc(shop.name)}: scan untuk pesan</small></div>`,
        )
        .join("");
      await Print.printAsync({
        html: `<html><head><meta charset="utf-8"><style>body{font-family:Helvetica}.g{display:flex;flex-wrap:wrap;gap:16px}.c{width:200px;text-align:center;border:1px solid #ccc;padding:12px;page-break-inside:avoid}h2{margin:6px 0}small{color:#555}</style></head><body><div class="g">${cards}</div></body></html>`,
      });
    } catch (e) {
      Alert.alert("Gagal mencetak", String(e.message || e));
    }
  }

  return (
    <Screen>
      <Muted>
        Setiap meja punya QR sendiri. Pelanggan yang scan langsung tahu mejanya, tanpa memilih meja.
      </Muted>
      {noUrl && <Banner bad text="Isi Alamat website di Profil toko dulu supaya QR bisa dibuat." />}
      <Field label="Jumlah meja (1 sampai 60)" value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ""))} keyboardType="number-pad" />
      {msg && <Banner bad={msg.bad} text={msg.t} />}
      <Btn title="Simpan jumlah meja" onPress={save} loading={busy} />
      <Btn title="Cetak semua QR" variant="ghost" onPress={printAll} disabled={noUrl || !tables.length} />
      <H>QR</H>
      {!noUrl &&
        tables.map((t) => (
          <Card key={t.id} style={{ alignItems: "center" }}>
            <View style={{ backgroundColor: "#fff", padding: 10, borderRadius: 12 }}>
              <QRCode
                value={tableUrl(shop.website_url, t.code)}
                size={160}
                getRef={(c) => (refs.current[t.id] = c)}
              />
            </View>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginTop: 8 }}>{tl(t.label)}</Text>
            <Muted selectable>{tableUrl(shop.website_url, t.code)}</Muted>
          </Card>
        ))}
    </Screen>
  );
}
