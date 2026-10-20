import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Screen, Btn, Field, Banner, Muted, H } from "../src/ui";
import { supabase, errMsg } from "../src/lib/supabase";
import { slugify } from "../src/lib/format";
import { useApp } from "../src/state/store";

export default function BuatToko() {
  const router = useRouter();
  const { reloadShops, setShopId, memberships, signOut } = useApp();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onName = (v) => {
    setName(v);
    if (!touched) setSlug(slugify(v));
  };

  async function create() {
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc("create_shop", { p_name: name, p_slug: slug });
    if (error) {
      setBusy(false);
      return setErr(errMsg(error));
    }
    await reloadShops();
    setShopId(data.id);
    setBusy(false);
    router.replace("/");
  }

  return (
    <Screen>
      <H style={{ marginTop: 8 }}>Toko baru</H>
      <Muted>
        Setiap toko punya menu, meja, staf, dan laporan sendiri. Data toko lain tidak pernah terlihat.
      </Muted>
      <Field label="Nama toko" value={name} onChangeText={onName} autoCapitalize="words" maxLength={60} />
      <Field
        label="Alamat toko (dipakai website)"
        value={slug}
        onChangeText={(v) => {
          setTouched(true);
          setSlug(slugify(v));
        }}
        maxLength={40}
        placeholder="contoh: kopi-senja"
      />
      <Muted>Huruf kecil, angka, tanda minus. Tidak bisa diubah nanti tanpa memperbarui website.</Muted>
      <Banner bad text={err} />
      <Btn title="Buat toko" onPress={create} loading={busy} disabled={name.trim().length < 2 || slug.length < 3} />
      {!memberships.length && <Btn title="Keluar" variant="ghost" onPress={signOut} />}
    </Screen>
  );
}
