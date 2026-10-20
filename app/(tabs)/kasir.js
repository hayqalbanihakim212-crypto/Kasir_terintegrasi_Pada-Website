// Kasir: pilih menu, bayar (tunai/QRIS/transfer) atau simpan sebagai belum dibayar, lalu cetak struk.
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp, useMenu } from "../../src/state/store";
import { supabase, errMsg } from "../../src/lib/supabase";
import { printOrder } from "../../src/lib/printer";
import { rp, tl, num, TAKE } from "../../src/lib/format";
import { Btn, Card, Chip, Field, Muted, Pills, Row, Sheet, T, C, onColor, useAccent } from "../../src/ui";

const PAYS = [
  ["cash", "Tunai"],
  ["qris", "QRIS"],
  ["transfer", "Transfer"],
  ["unpaid", "Belum bayar"],
];

export default function Kasir() {
  const { shop, tables, reload, loaded } = useApp();
  const menu = useMenu();
  const a = useAccent();
  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [table, setTable] = useState(TAKE);
  const [pay, setPay] = useState("cash");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => [...new Set(menu.map((m) => m.c))], [menu]);
  const curCat = cats.includes(cat) ? cat : cats[0];
  const dead = (m) => m.off || m.closed;
  const lines = Object.entries(cart)
    .map(([key, q]) => {
      const [id, k] = key.split("|");
      const m = menu.find((x) => x.id === id);
      const vr = k && m ? (m.v || []).find((z) => z.k === k) : null;
      if (!m || dead(m) || (k && (!vr || vr.off))) return null;
      return { key, m, k, q, p: vr ? vr.p : m.p };
    })
    .filter(Boolean);
  const total = lines.reduce((s, l) => s + l.q * l.p, 0);
  const count = lines.reduce((s, l) => s + l.q, 0);
  const change = num(cash) - total;

  const add = (key, d) =>
    setCart((c) => {
      const n = (c[key] || 0) + d;
      const x = { ...c };
      if (n <= 0) delete x[key];
      else x[key] = Math.min(99, n);
      return x;
    });

  const ctl = (key) =>
    cart[key] ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Round t="−" onPress={() => add(key, -1)} />
        <Text style={{ color: C.text, minWidth: 20, textAlign: "center", fontWeight: "700" }}>{cart[key]}</Text>
        <Round t="+" onPress={() => add(key, 1)} />
      </View>
    ) : (
      <Btn title="Tambah" variant="ghost" small onPress={() => add(key, 1)} />
    );

  const row = ({ item: m }) => (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Row>
        <Text style={{ color: C.text, fontWeight: "600", flex: 1, opacity: dead(m) ? 0.45 : 1 }}>{m.n}</Text>
        {dead(m) || !(m.p > 0 || m.v) ? (
          <Muted>{m.closed ? "Ditutup" : m.off ? "Habis" : "Segera"}</Muted>
        ) : !m.v ? (
          <>
            <Text style={{ color: a, fontWeight: "700" }}>{rp(m.p)}</Text>
            {ctl(m.id + "|")}
          </>
        ) : null}
      </Row>
      {m.v && !dead(m)
        ? m.v.map((z) => (
            <Row key={z.k} style={{ marginTop: 8, paddingLeft: 12 }}>
              <Muted style={{ flex: 1, textDecorationLine: z.off ? "line-through" : "none" }}>{z.k}</Muted>
              {z.off ? (
                <Muted>Habis</Muted>
              ) : (
                <>
                  <Text style={{ color: a, fontWeight: "700" }}>{rp(z.p)}</Text>
                  {ctl(m.id + "|" + z.k)}
                </>
              )}
            </Row>
          ))
        : null}
    </View>
  );

  async function checkout() {
    if (!lines.length) return;
    if (pay === "cash" && cash !== "" && change < 0) return Alert.alert("Uang kurang", "Uang diterima kurang dari total.");
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_shop: shop.id,
      p_items: lines.map((l) => ({ id: l.m.id, v: l.k || null, q: l.q })),
      p_name: name.trim(),
      p_note: note.trim(),
      p_table: table,
      p_pay: pay,
    });
    if (error) {
      setBusy(false);
      Alert.alert("Gagal", errMsg(error));
      if (/habis|ditutup/.test(errMsg(error))) reload();
      return;
    }
    const k = pay === "cash" && cash !== "" && change > 0 ? `\nKembalian ${rp(change)}` : "";
    setCart({});
    setName("");
    setNote("");
    setCash("");
    setOpen(false);
    setBusy(false);
    reload();
    let printMsg = "";
    try {
      if (pay !== "unpaid") await printOrder(shop, data, "customer");
    } catch (e) {
      printMsg = "\n(Struk tidak tercetak: " + String(e.message || e) + ")";
    }
    Alert.alert("Pesanan " + data.no, `${tl(data.table_label)} · ${rp(data.total)}${k}${printMsg}`);
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {!cats.length ? (
        <View style={{ padding: 16 }}>
          <Muted>{loaded ? "Menu masih kosong. Tambahkan di tab Menu." : "Memuat..."}</Muted>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {cats.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={{
                    minHeight: 38,
                    paddingHorizontal: 16,
                    borderRadius: 99,
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: a,
                    backgroundColor: c === curCat ? a : "transparent",
                  }}
                >
                  <Text style={{ color: c === curCat ? onColor(a) : C.text, fontWeight: "600" }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={menu.filter((m) => m.c === curCat)}
            keyExtractor={(m) => m.id}
            renderItem={row}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          />
        </>
      )}
      {count > 0 && (
        <Pressable
          onPress={() => setOpen(true)}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            backgroundColor: a,
            borderRadius: 16,
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: onColor(a), fontWeight: "800" }}>
            {count} item · {rp(total)}
          </Text>
          <Text style={{ color: onColor(a), fontWeight: "800" }}>Bayar ›</Text>
        </Pressable>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pesanan">
        {lines.map((l) => (
          <Row key={l.key} style={{ paddingVertical: 6 }}>
            <T style={{ flex: 1 }}>
              {l.q}× {l.m.n}
              {l.k ? ` (${l.k})` : ""}
            </T>
            <T style={{ fontWeight: "700" }}>{rp(l.q * l.p)}</T>
          </Row>
        ))}
        <Row style={{ paddingVertical: 8 }}>
          <T style={{ fontWeight: "800", fontSize: 17 }}>Total</T>
          <T style={{ fontWeight: "800", fontSize: 17 }}>{rp(total)}</T>
        </Row>
        <Muted style={{ marginTop: 8 }}>Meja</Muted>
        <Pills
          value={table}
          onChange={setTable}
          items={(tables.length ? tables : [{ label: TAKE }]).map((t) => [t.label, tl(t.label)])}
        />
        <Field label="Nama pemesan (opsional)" value={name} onChangeText={setName} maxLength={30} autoCapitalize="words" />
        <Field label="Catatan (opsional)" value={note} onChangeText={setNote} maxLength={60} />
        <Muted style={{ marginTop: 8 }}>Pembayaran</Muted>
        <Pills value={pay} onChange={setPay} items={PAYS} />
        {pay === "cash" && (
          <>
            <Field label="Uang diterima (opsional)" value={cash} onChangeText={(v) => setCash(v.replace(/\D/g, ""))} keyboardType="number-pad" />
            {cash !== "" && (
              <Text style={{ color: change < 0 ? C.bad : C.ok, fontWeight: "700" }}>
                {change < 0 ? "Kurang " + rp(-change) : "Kembalian " + rp(change)}
              </Text>
            )}
          </>
        )}
        <Btn
          title={pay === "unpaid" ? "Simpan pesanan" : "Bayar & cetak struk"}
          onPress={checkout}
          loading={busy}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const Round = ({ t, onPress }) => {
  const a = useAccent();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: a,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: a, fontSize: 18, fontWeight: "700" }}>{t}</Text>
    </Pressable>
  );
};
