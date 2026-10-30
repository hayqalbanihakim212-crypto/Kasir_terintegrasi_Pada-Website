// Menu & stok. Semua anggota toko bisa menandai habis/tersedia; hanya pemilik yang menambah, mengubah, menghapus.
import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useApp, useMenu } from "../../src/state/store";
import { supabase, errMsg } from "../../src/lib/supabase";
import { SAMPLE_MENU } from "../../src/lib/data";
import { rp } from "../../src/lib/format";
import {
  Screen,
  Card,
  Row,
  Btn,
  Chip,
  Field,
  Pills,
  Muted,
  H,
  Sheet,
  Banner,
  Toggle,
  C,
  useAccent,
} from "../../src/ui";

const VT = [
  ["one", "Satu harga"],
  ["hd", "Panas & Dingin"],
  ["hdf", "Panas, Dingin & Float"],
];
const EMPTY = {
  id: null,
  n: "",
  c: "",
  t: "one",
  p: "",
  h: "",
  d: "",
  f: "",
  food: false,
};

export default function MenuTab() {
  const { shop, isOwner, categories, items, reload, loaded } = useApp();
  const menu = useMenu();
  const a = useAccent();
  const [q, setQ] = useState("");
  const [sf, setSf] = useState("all");
  const [form, setForm] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const anyOff = (m) => m.off || (m.v || []).some((z) => z.off);
  const shown = (m) =>
    (sf === "all" || (sf === "off") === !!anyOff(m)) &&
    (!q || m.n.toLowerCase().includes(q.toLowerCase()));

  const fail = (e) => Alert.alert("Gagal", errMsg(e));
  async function stock(id, variant, off) {
    const { error } = await supabase.rpc("set_stock", {
      p_item: id,
      p_variant: variant || null,
      p_off: off,
    });
    if (error) fail(error);
    reload();
  }
  async function closeCats(ids, closed) {
    if (!ids.length) return;
    const { error } = await supabase.rpc("set_category_closed", {
      p_cats: ids,
      p_closed: closed,
    });
    if (error) fail(error);
    reload();
  }

  const openEdit = (m) => {
    const g = (k) => ((m.v || []).find((z) => z.k === k) || {}).p;
    setErr("");
    setForm({
      id: m.id,
      n: m.n,
      c: m.c,
      t: m.v ? (g("Float") ? "hdf" : "hd") : "one",
      p: String(m.v ? "" : m.p),
      h: g("Panas") != null ? String(g("Panas")) : "",
      d: g("Dingin") != null ? String(g("Dingin")) : "",
      f: g("Float") != null ? String(g("Float")) : "",
      food: false,
    });
  };

  async function save() {
    const f = form;
    const n = f.n.trim().replace(/\s+/g, " "),
      c = f.c.trim().replace(/\s+/g, " ");
    if (!n || !c) return setErr("Nama menu dan kategori wajib diisi.");
    const old = f.id ? items.find((x) => x.id === f.id) : null;
    const oldOff = new Map(
      ((old && old.variants) || []).map((z) => [z.k, !!z.off]),
    );
    let variants = null,
      price = Math.round(Number(f.p === "" ? NaN : f.p));
    if (f.t !== "one") {
      variants = [
        { k: "Panas", p: Math.round(Number(f.h)) },
        { k: "Dingin", p: Math.round(Number(f.d)) },
        ...(f.t === "hdf" ? [{ k: "Float", p: Math.round(Number(f.f)) }] : []),
      ].map((z) => (oldOff.get(z.k) ? { ...z, off: true } : z));
      if (!variants.every((z) => z.p >= 1 && z.p <= 1e6))
        return setErr("Harga tiap varian harus 1 sampai 1.000.000.");
      price = Math.min(...variants.map((z) => z.p));
    } else if (!(price >= 0 && price <= 1e6))
      return setErr("Harga harus 0 sampai 1.000.000 (0 = Segera).");
    if (
      menu.some(
        (m) =>
          m.id !== f.id &&
          m.c.toLowerCase() === c.toLowerCase() &&
          m.n.toLowerCase() === n.toLowerCase(),
      )
    )
      return setErr("Menu dengan nama itu sudah ada di kategori tersebut.");
    setBusy(true);
    try {
      let cat = categories.find(
        (x) => x.name.toLowerCase() === c.toLowerCase(),
      );
      if (!cat) {
        const r = await supabase
          .from("categories")
          .insert({
            shop_id: shop.id,
            name: c,
            is_food: f.food,
            sort: categories.length,
          })
          .select()
          .single();
        if (r.error) throw r.error;
        cat = r.data;
      }
      const row = {
        name: n,
        category_id: cat.id,
        price,
        variants,
        off: variants ? variants.every((z) => z.off) : old ? old.off : false,
      };
      const r = f.id
        ? await supabase.from("menu_items").update(row).eq("id", f.id)
        : await supabase
            .from("menu_items")
            .insert({ ...row, shop_id: shop.id });
      if (r.error) throw r.error;
      setForm(null);
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  function del(m) {
    Alert.alert(
      "Hapus menu?",
      `"${m.n}" dihapus permanen. Riwayat pesanan lama tetap tersimpan.`,
      [
        { text: "Batal" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("menu_items")
              .delete()
              .eq("id", m.id);
            if (error) fail(error);
            reload();
          },
        },
      ],
    );
  }

  async function saveCat() {
    const name = catForm.name.trim().replace(/\s+/g, " ");
    if (!name) return;
    const { error } = await supabase
      .from("categories")
      .insert({
        shop_id: shop.id,
        name,
        is_food: catForm.food,
        sort: categories.length,
      });
    if (error)
      return Alert.alert(
        "Gagal",
        /duplicate|unique/.test(error.message)
          ? "Kategori itu sudah ada."
          : errMsg(error),
      );
    setCatForm(null);
    reload();
  }
  function delCat(c) {
    Alert.alert(
      "Hapus kategori?",
      `"${c.name}" beserta semua menu di dalamnya akan dihapus.`,
      [
        { text: "Batal" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("categories")
              .delete()
              .eq("id", c.id);
            if (error) fail(error);
            reload();
          },
        },
      ],
    );
  }

  async function seed() {
    setBusy(true);
    try {
      let sort = categories.length;
      for (const [name, def] of Object.entries(SAMPLE_MENU)) {
        const r = await supabase
          .from("categories")
          .upsert(
            { shop_id: shop.id, name, is_food: def.food, sort: sort++ },
            { onConflict: "shop_id,name" },
          )
          .select()
          .single();
        if (r.error) throw r.error;
        const rows = def.items.map((i, k) => ({
          shop_id: shop.id,
          category_id: r.data.id,
          name: i.n,
          price: i.variants ? Math.min(...i.variants.map((z) => z.p)) : i.p,
          variants: i.variants || null,
          sort: k,
        }));
        const ins = await supabase.from("menu_items").insert(rows);
        if (ins.error) throw ins.error;
      }
      reload();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  }

  const price = (m) =>
    m.v
      ? m.v.map((z) => `${z.k} ${rp(z.p)}`).join(" · ")
      : m.p > 0
        ? rp(m.p)
        : "Segera";
  const catClosed = (id) =>
    !!(categories.find((c) => c.id === id) || {}).closed;
  const groupIds = (food) =>
    categories.filter((c) => !!c.is_food === food).map((c) => c.id);
  const groupClosed = (food) => {
    const g = categories.filter((c) => !!c.is_food === food);
    return g.length > 0 && g.every((c) => c.closed);
  };
  const off = menu.filter(anyOff).length;

  const Tg = ({ on, onPress, label }) => (
    <Btn
      small
      variant={on ? "solid" : "danger"}
      title={label}
      onPress={onPress}
      style={{ minWidth: 92 }}
    />
  );

  return (
    <Screen>
      {loaded && !categories.length && isOwner && (
        <Card accent>
          <Text style={{ color: C.text, fontWeight: "700" }}>
            Menu masih kosong
          </Text>
          <Muted>
            Tambahkan menu sendiri, atau isi contoh dulu lalu ubah sesuai
            tokomu.
          </Muted>
          <Btn
            title="Isi menu contoh"
            variant="ghost"
            onPress={seed}
            loading={busy}
          />
        </Card>
      )}
      <Row style={{ gap: 8 }}>
        <Card style={{ flex: 1 }}>
          <Muted>Tersedia</Muted>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>
            {menu.length - off}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Habis</Muted>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>
            {off}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>Ditutup</Muted>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>
            {categories.filter((c) => c.closed).length}
          </Text>
        </Card>
      </Row>
      <Muted>
        Menu habis atau kategori ditutup langsung hilang dari kasir dan website.
      </Muted>

      {[
        ["Makanan", true],
        ["Minuman", false],
      ].map(([nm, food]) => (
        <Card key={nm}>
          <Row>
            <Text style={{ color: C.text, fontWeight: "700" }}>{nm}</Text>
            <Chip
              text={groupClosed(food) ? "Ditutup" : "Buka"}
              color={groupClosed(food) ? undefined : C.ok}
            />
          </Row>
          <Btn
            small
            variant="ghost"
            style={{ marginTop: 8 }}
            disabled={!groupIds(food).length}
            title={
              groupClosed(food)
                ? `Buka semua ${nm.toLowerCase()}`
                : `Tutup semua ${nm.toLowerCase()}`
            }
            onPress={() => closeCats(groupIds(food), !groupClosed(food))}
          />
        </Card>
      ))}

      {isOwner && (
        <Row style={{ marginTop: 8, gap: 8 }}>
          <Btn
            title="+ Menu baru"
            style={{ flex: 1 }}
            onPress={() => {
              setErr("");
              setForm({ ...EMPTY });
            }}
          />
          <Btn
            title="+ Kategori"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => setCatForm({ name: "", food: false })}
          />
        </Row>
      )}

      <H>Daftar menu</H>
      <Field
        label="Cari menu"
        value={q}
        onChangeText={setQ}
        placeholder="Nama menu"
      />
      <Pills
        value={sf}
        onChange={setSf}
        items={[
          ["all", "Semua"],
          ["ok", "Tersedia"],
          ["off", "Habis"],
        ]}
      />

      {categories.map((c) => {
        const list = menu.filter((m) => m.cid === c.id && shown(m));
        if (!list.length && (q || sf !== "all")) return null;
        return (
          <View key={c.id}>
            <Row style={{ marginTop: 14 }}>
              <Text
                style={{ color: a, fontWeight: "800", fontSize: 17, flex: 1 }}
              >
                {c.name} {c.closed ? "(ditutup)" : ""}
              </Text>
              <Btn
                small
                variant="ghost"
                title={c.closed ? "Buka" : "Tutup"}
                onPress={() => closeCats([c.id], !c.closed)}
              />
              {isOwner && (
                <Btn
                  small
                  variant="danger"
                  title="Hapus"
                  onPress={() => delCat(c)}
                />
              )}
            </Row>
            <Card>
              {!list.length && <Muted>Tidak ada menu.</Muted>}
              {list.map((m, i) => (
                <View
                  key={m.id}
                  style={{
                    paddingVertical: 10,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: C.line,
                    opacity: c.closed ? 0.55 : 1,
                  }}
                >
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "600" }}>
                        {m.n}
                      </Text>
                      <Muted>{price(m)}</Muted>
                    </View>
                    {!m.v && (
                      <Tg
                        on={!m.off}
                        label={m.off ? "Habis" : "Tersedia"}
                        onPress={() => stock(m.id, null, !m.off)}
                      />
                    )}
                  </Row>
                  {m.v &&
                    m.v.map((z) => (
                      <Row key={z.k} style={{ marginTop: 6, paddingLeft: 10 }}>
                        <Muted>
                          {z.k} · {rp(z.p)}
                        </Muted>
                        <Tg
                          on={!z.off}
                          label={z.off ? "Habis" : "Tersedia"}
                          onPress={() => stock(m.id, z.k, !z.off)}
                        />
                      </Row>
                    ))}
                  {isOwner && (
                    <Row style={{ marginTop: 8, justifyContent: "flex-end" }}>
                      <Btn
                        small
                        variant="ghost"
                        title="Ubah"
                        onPress={() => openEdit(m)}
                      />
                      <Btn
                        small
                        variant="danger"
                        title="Hapus"
                        onPress={() => del(m)}
                      />
                    </Row>
                  )}
                </View>
              ))}
            </Card>
          </View>
        );
      })}

      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        title={form && form.id ? "Ubah menu" : "Menu baru"}
      >
        {form && (
          <>
            <Field
              label="Nama menu"
              value={form.n}
              onChangeText={(v) => setForm({ ...form, n: v })}
              maxLength={60}
              autoCapitalize="words"
            />
            <Field
              label="Kategori"
              value={form.c}
              onChangeText={(v) => setForm({ ...form, c: v })}
              maxLength={40}
              autoCapitalize="words"
            />
            {categories.length > 0 && (
              <Pills
                value={form.c}
                onChange={(v) => setForm({ ...form, c: v })}
                items={categories.map((c) => [c.name, c.name])}
              />
            )}
            {!categories.some(
              (c) => c.name.toLowerCase() === form.c.trim().toLowerCase(),
            ) &&
              form.c.trim() !== "" && (
                <Toggle
                  label="Kategori baru ini makanan"
                  value={form.food}
                  onValueChange={(v) => setForm({ ...form, food: v })}
                />
              )}
            <Muted>Jenis harga</Muted>
            <Pills
              value={form.t}
              onChange={(v) => setForm({ ...form, t: v })}
              items={VT}
            />
            {form.t === "one" ? (
              <Field
                label="Harga (Rp, isi 0 untuk Segera)"
                value={form.p}
                onChangeText={(v) =>
                  setForm({ ...form, p: v.replace(/\D/g, "") })
                }
                keyboardType="number-pad"
              />
            ) : (
              <>
                <Field
                  label="Panas (Rp)"
                  value={form.h}
                  onChangeText={(v) =>
                    setForm({ ...form, h: v.replace(/\D/g, "") })
                  }
                  keyboardType="number-pad"
                />
                <Field
                  label="Dingin (Rp)"
                  value={form.d}
                  onChangeText={(v) =>
                    setForm({ ...form, d: v.replace(/\D/g, "") })
                  }
                  keyboardType="number-pad"
                />
                {form.t === "hdf" && (
                  <Field
                    label="Float (Rp)"
                    value={form.f}
                    onChangeText={(v) =>
                      setForm({ ...form, f: v.replace(/\D/g, "") })
                    }
                    keyboardType="number-pad"
                  />
                )}
              </>
            )}
            <Banner bad text={err} />
            <Btn title="Simpan" onPress={save} loading={busy} />
          </>
        )}
      </Sheet>

      <Sheet
        visible={!!catForm}
        onClose={() => setCatForm(null)}
        title="Kategori baru"
      >
        {catForm && (
          <>
            <Field
              label="Nama kategori"
              value={catForm.name}
              onChangeText={(v) => setCatForm({ ...catForm, name: v })}
              maxLength={40}
              autoCapitalize="words"
            />
            <Toggle
              label="Kategori makanan"
              value={catForm.food}
              onValueChange={(v) => setCatForm({ ...catForm, food: v })}
              hint="Dipakai untuk tombol Tutup semua makanan/minuman."
            />
            <Btn title="Simpan" onPress={saveCat} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
