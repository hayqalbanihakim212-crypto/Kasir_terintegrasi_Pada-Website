import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../src/state/store";
import { Screen, Card, Row, Btn, Muted, H, Chip, C, useAccent } from "../../src/ui";

export default function Lainnya() {
  const { shop, role, isOwner, memberships, setShopId, signOut, session } = useApp();
  const router = useRouter();
  const a = useAccent();

  const Link = ({ icon, title, hint, to, owner }) =>
    owner && !isOwner ? null : (
      <Pressable onPress={() => router.push(to)}>
        <Card>
          <Row>
            <Ionicons name={icon} size={22} color={a} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700" }}>{title}</Text>
              <Muted>{hint}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Row>
        </Card>
      </Pressable>
    );

  return (
    <Screen>
      <Card accent>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>{shop && shop.name}</Text>
            <Muted>{session && session.user.email}</Muted>
          </View>
          <Chip text={isOwner ? "PEMILIK" : "STAF"} />
        </Row>
      </Card>

      {memberships.length > 1 && (
        <>
          <H>Ganti toko</H>
          {memberships.map((m) => (
            <Pressable key={m.shop.id} onPress={() => setShopId(m.shop.id)}>
              <Card accent={m.shop.id === shop.id}>
                <Row>
                  <Text style={{ color: C.text, fontWeight: "700" }}>{m.shop.name}</Text>
                  <Muted>{m.role === "owner" ? "Pemilik" : "Staf"}</Muted>
                </Row>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      <H>Operasional</H>
      <Link icon="time-outline" title="Riwayat pesanan" hint="Cari, lihat detail, cetak ulang struk" to="/riwayat" />
      <Link icon="print-outline" title="Printer struk" hint="Hubungkan printer thermal Bluetooth" to="/printer" />

      <H>Pengaturan toko</H>
      <Link owner icon="storefront-outline" title="Profil toko" hint="Nama, alamat, struk, warna, pesan online" to="/toko" />
      <Link owner icon="qr-code-outline" title="Meja & QR" hint="Jumlah meja dan QR untuk dicetak" to="/meja" />
      <Link owner icon="people-outline" title="Staf" hint="Tambah atau hapus kasir" to="/staf" />
      <Link owner icon="card-outline" title="Pembayaran online" hint="Midtrans untuk pesanan dari website" to="/pembayaran" />
      <Link owner icon="globe-outline" title="Website" hint="Kode untuk dipasang di website toko" to="/website" />

      <H>Akun</H>
      <Btn title="Buat toko lain" variant="ghost" onPress={() => router.push("/buat-toko")} />
      <Btn title="Keluar" variant="danger" onPress={signOut} />
    </Screen>
  );
}
