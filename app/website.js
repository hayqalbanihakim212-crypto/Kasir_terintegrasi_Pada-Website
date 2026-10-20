import React from "react";
import * as Clipboard from "expo-clipboard";
import { Alert } from "react-native";
import { Screen, Card, Btn, Muted, T, H, Banner } from "../src/ui";
import { SUPABASE_URL } from "../src/lib/supabase";
import { useApp } from "../src/state/store";

const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export default function Website() {
  const { shop, isOwner } = useApp();
  if (!isOwner) return <Screen><Muted>Hanya pemilik.</Muted></Screen>;

  const snippet = `<div id="kasir-menu"
     data-url="${SUPABASE_URL}"
     data-key="${ANON}"
     data-shop="${shop.slug}"></div>
<script src="https://DOMAIN-KAMU/kasir-embed.js"></script>`;

  return (
    <Screen>
      <Muted>
        Tempel kode ini di halaman website tokomu (misalnya halaman "Pesan"). Menu, harga, stok, dan kategori yang
        ditutup di aplikasi otomatis tampil di sana, dan pesanan pelanggan langsung masuk Antrian.
      </Muted>
      <Banner bad={!shop.online_ordering} text={shop.online_ordering ? "" : "Pesan dari website belum diaktifkan: aktifkan di Profil toko. Sebelum itu website hanya menampilkan menu."} />
      <H>Kode pasang</H>
      <Card>
        <T selectable style={{ fontSize: 12 }}>{snippet}</T>
      </Card>
      <Btn
        title="Salin kode"
        onPress={async () => {
          await Clipboard.setStringAsync(snippet);
          Alert.alert("Disalin", "Ganti DOMAIN-KAMU dengan alamat tempat kamu menaruh file kasir-embed.js.");
        }}
      />
      <Muted style={{ marginTop: 8 }}>
        File kasir-embed.js ada di folder web/ proyek ini. Unggah ke hosting websitemu (atau Supabase Storage publik).
        Anon key memang publik; datamu aman karena dibatasi aturan RLS di database.
      </Muted>
      <H>Alamat QR meja</H>
      <Muted>
        QR meja membawa ?meja=KODE ke alamat website di Profil toko ({shop.website_url || "belum diisi"}). Halaman itu harus
        memasang kode di atas.
      </Muted>
    </Screen>
  );
}
