import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Screen,
  Field,
  Btn,
  Banner,
  Muted,
  Pills,
  Toggle,
  H,
  ACCENTS,
} from "../src/ui";
import { supabase, errMsg } from "../src/lib/supabase";
import { useApp } from "../src/state/store";

export default function Toko() {
  const { shop, isOwner } = useApp();

  if (!shop)
    return (
      <Screen>
        <Muted>Memuat data toko...</Muted>
      </Screen>
    );
  if (!isOwner)
    return (
      <Screen>
        <Muted>Hanya pemilik yang bisa mengubah profil toko.</Muted>
      </Screen>
    );

  return <TokoForm />;
}

function TokoForm() {
  const { shop, reloadShops } = useApp();
  const [f, setF] = useState({
    name: shop.name || "",
    address: shop.address || "",
    phone: shop.phone || "",
    receipt_footer: shop.receipt_footer || "",
    website_url: shop.website_url || "",
    accent: shop.accent,
    online_ordering: shop.online_ordering,
    web_pay: shop.web_pay,
    qris_payload: shop.qris_payload || "",
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    let url = f.website_url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    if (f.name.trim().length < 2)
      return setMsg({ bad: 1, t: "Nama toko minimal 2 huruf." });
    const qp = f.qris_payload.trim();
    if (qp && !/^000201/.test(qp))
      return setMsg({ bad: 1, t: "Kode QRIS harus berawalan 000201. Salin teks hasil scan QRIS toko." });
    setBusy(true);
    const { error } = await supabase
      .from("shops")
      .update({
        name: f.name.trim(),
        address: f.address.trim() || null,
        phone: f.phone.trim() || null,
        receipt_footer: f.receipt_footer.trim() || "Terima kasih",
        website_url: url || null,
        accent: f.accent,
        online_ordering: f.online_ordering,
        web_pay: f.web_pay,
        qris_payload: qp || null,
      })
      .eq("id", shop.id);
    setBusy(false);
    if (error) return setMsg({ bad: 1, t: errMsg(error) });
    await reloadShops();
    setMsg({ t: "Tersimpan." });
  }

  return (
    <Screen>
      <Field
        label="Nama toko"
        value={f.name}
        onChangeText={set("name")}
        autoCapitalize="words"
        maxLength={60}
      />
      <Field
        label="Alamat (tampil di struk)"
        value={f.address}
        onChangeText={set("address")}
        autoCapitalize="sentences"
      />
      <Field
        label="Telepon / WhatsApp"
        value={f.phone}
        onChangeText={set("phone")}
        keyboardType="phone-pad"
      />
      <Field
        label="Teks bawah struk"
        value={f.receipt_footer}
        onChangeText={set("receipt_footer")}
        autoCapitalize="sentences"
        maxLength={60}
      />
      <H>Warna toko</H>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        {ACCENTS.map((c) => (
          <Pressable
            key={c}
            onPress={() => set("accent")(c)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c,
              borderWidth: f.accent === c ? 3 : 0,
              borderColor: "#fff",
            }}
          />
        ))}
      </View>
      <H>QRIS toko</H>
      <Field
        label="Teks kode QRIS (opsional)"
        value={f.qris_payload}
        onChangeText={set("qris_payload")}
        multiline
        placeholder="000201010211..."
      />
      <Muted>
        Scan QRIS toko dengan aplikasi pembaca QR, lalu tempel teks hasilnya di sini. Di kasir, nominal otomatis
        dimasukkan ke kode sehingga pelanggan tidak perlu mengetik. Pembayaran tetap dikonfirmasi kasir.
      </Muted>
      <H>Website resmi</H>
      <Field
        label="Alamat website toko"
        value={f.website_url}
        onChangeText={set("website_url")}
        keyboardType="url"
        placeholder="https://tokomu.com/pesan"
      />
      <Muted>
        Dipakai sebagai alamat di dalam QR meja. Halaman itu harus memasang kode
        dari menu Website.
      </Muted>
      <Toggle
        label="Terima pesanan dari website"
        value={f.online_ordering}
        onValueChange={set("online_ordering")}
        hint="Pelanggan scan QR meja, pesan lewat website, pesanan masuk Antrian."
      />
      <Muted style={{ marginTop: 6 }}>Pembayaran pesanan website</Muted>
      <Pills
        value={f.web_pay}
        onChange={set("web_pay")}
        items={[
          ["counter", "Bayar di kasir"],
          ["midtrans", "Online (Midtrans)"],
        ]}
      />
      {f.web_pay === "midtrans" && (
        <Muted>
          Isi kunci Midtrans di menu Pembayaran online, kalau belum pesanan
          website akan gagal dibayar.
        </Muted>
      )}
      {msg && <Banner bad={msg.bad} text={msg.t} />}
      <Btn title="Simpan" onPress={save} loading={busy} />
      <Muted style={{ marginTop: 12 }}>Alamat toko (slug): {shop.slug}</Muted>
    </Screen>
  );
}
