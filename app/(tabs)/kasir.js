// Kasir kafe (Kopi Senja): menu di kiri, "slip pesanan" di kanan. Tombol "Bayar dan cetak struk"
// membuka layar Bayar (Tunai / QRIS / Kartu debit). Di HP: daftar menu + lembar bawah.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useApp, useMenu } from "../../src/state/store";
import { supabase, errMsg } from "../../src/lib/supabase";
import { printOrder } from "../../src/lib/printer";
import { qrisWithAmount } from "../../src/lib/qris";
import { rp, tl, num, TAKE } from "../../src/lib/format";
import { Field, Muted, Row, Sheet, C, F, onColor, useAccent } from "../../src/ui";

const PAYS = [
  ["cash", "Tunai"],
  ["qris", "QRIS"],
  ["debit", "Kartu debit"],
];
const QRIS_TTL = 5 * 60; // detik, sama dengan "Masa berlaku kode" di dasbor
const PAPER = "#F5EEE1";
const EDGE = "#D3C8AE";

export default function Kasir() {
  const { shop, tables, orders, reload, reloadShops, loaded, online } = useApp();
  const menu = useMenu();
  const a = useAccent();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const cols = wide ? (width >= 1100 ? 3 : 2) : width >= 560 ? 2 : 1;

  const [cat, setCat] = useState("");
  const [cart, setCart] = useState({});
  const [sheet, setSheet] = useState(false); // lembar pesanan di HP
  const [paying, setPaying] = useState(false); // layar Bayar
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [table, setTable] = useState(TAKE);
  const [extra, setExtra] = useState(null); // "nama" | "meja" | "catatan"
  const [pay, setPay] = useState("cash");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(QRIS_TTL);
  const [codeNo, setCodeNo] = useState(1);

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

  // nomor pesanan berikutnya (sama dengan yang dibuat server) dan ringkasan antrean di judul
  const nextNo = (shop && Number(shop.order_seq) + 1) || 1;
  const making = orders.filter((o) => o.status === "making").length;
  const ready = orders.filter((o) => o.status === "ready").sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
  const short = (no) => String(no || "").replace(/^\D+/, "").replace(/^0+/, "") || no;
  const sub = [
    making ? `${making} pesanan sedang dibuat` : "Belum ada pesanan dibuat",
    ready ? `pesanan #${short(ready.no)} siap diantar` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const qrisOk = !!(shop && shop.qris_payload);
  const qrisText = useMemo(
    () => (paying && pay === "qris" && total > 0 && qrisOk ? qrisWithAmount(shop.qris_payload, total) : null),
    [paying, pay, total, shop, qrisOk, codeNo],
  );

  // hitung mundur masa berlaku kode QRIS
  useEffect(() => {
    if (!paying || pay !== "qris") return;
    setLeft(QRIS_TTL);
    const t0 = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, QRIS_TTL - Math.floor((Date.now() - t0) / 1000))), 1000);
    return () => clearInterval(t);
  }, [paying, pay, codeNo]);

  const add = (key, d) =>
    setCart((c) => {
      const n = (c[key] || 0) + d;
      const x = { ...c };
      if (n <= 0) delete x[key];
      else x[key] = Math.min(99, n);
      return x;
    });
  const qtyOf = (m) => Object.entries(cart).reduce((s, [k, q]) => (k.split("|")[0] === m.id ? s + q : s), 0);

  /* ---------- kartu menu ---------- */
  const card = (m) => {
    const off = dead(m) || !(m.p > 0 || m.v);
    const q = qtyOf(m);
    const single = !m.v && !off;
    const body = (
      <View
        style={{
          flex: 1,
          minHeight: wide ? 200 : 128,
          backgroundColor: "#F9F5EC",
          borderWidth: q ? 2 : 1,
          borderColor: q ? a : "#DDD3BC",
          borderRadius: 4,
          padding: 16,
          opacity: off ? 0.5 : 1,
        }}
      >
        <Row style={{ alignItems: "flex-start" }}>
          <Text style={{ color: C.text, fontFamily: F.head, fontSize: wide ? 24 : 20, lineHeight: wide ? 30 : 26, flex: 1 }}>{m.n}</Text>
          {q > 0 && (
            <View style={{ backgroundColor: a, borderRadius: 99, minWidth: 26, height: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <Text style={{ color: onColor(a), fontFamily: F.bold, fontSize: 13 }}>{q}</Text>
            </View>
          )}
        </Row>
        {!!m.d && <Text style={{ color: C.muted, fontFamily: F.body, fontSize: 13, marginTop: 6 }}>{m.d}</Text>}
        {off ? (
          <Muted style={{ marginTop: "auto", paddingTop: 12 }}>{m.closed ? "Kategori ditutup" : m.off ? "Habis" : "Segera"}</Muted>
        ) : single ? (
          <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 18, marginTop: "auto", paddingTop: 16 }}>{rp(m.p).replace("Rp ", "")}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: "auto", paddingTop: 14 }}>
            {(m.v || []).map((z) => {
              const key = m.id + "|" + z.k;
              return z.off ? (
                <Muted key={z.k} style={{ textDecorationLine: "line-through" }}>{z.k} habis</Muted>
              ) : (
                <Pressable
                  key={z.k}
                  onPress={() => add(key, 1)}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: cart[key] ? a : "#B9AC93",
                    backgroundColor: cart[key] ? a : "transparent",
                  }}
                >
                  <Text style={{ color: cart[key] ? onColor(a) : C.text, fontFamily: F.bold, fontSize: 13 }}>
                    {z.k} · {rp(z.p).replace("Rp ", "")}
                    {cart[key] ? `  ×${cart[key]}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
    return (
      <View key={m.id} style={{ width: `${100 / cols}%`, padding: 7 }}>
        {single ? (
          <Pressable accessibilityRole="button" onPress={() => add(m.id + "|", 1)} style={{ flex: 1 }}>
            {body}
          </Pressable>
        ) : (
          body
        )}
      </View>
    );
  };

  /* ---------- slip pesanan ---------- */
  const who = [name.trim() ? `atas nama ${name.trim()}` : null, tl(table).toLowerCase() === "bawa pulang" ? "dibawa pulang" : tl(table)]
    .filter(Boolean)
    .join(" · ");

  const Chipbtn = ({ id, label, on }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => setExtra(extra === id ? null : id)}
      style={{
        minHeight: 38,
        paddingHorizontal: 16,
        borderRadius: 20,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: extra === id || on ? C.text : "#B9AC93",
        backgroundColor: extra === id ? "#EADFC9" : "transparent",
      }}
    >
      <Text style={{ color: C.text, fontFamily: F.body, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  const slipHead = (
    <View style={{ marginBottom: 12 }}>
      <Row style={{ alignItems: "flex-start" }}>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 30 }}>Pesanan {nextNo}</Text>
        <View style={{ borderWidth: 2, borderColor: a, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 2, transform: [{ rotate: "-3deg" }], marginTop: 4 }}>
          <Text style={{ color: a, fontFamily: F.bold, fontSize: 13, letterSpacing: 0.5 }}>BARU</Text>
        </View>
      </Row>
      <Text style={{ color: C.muted, fontFamily: F.body, fontSize: 14, marginTop: 4 }}>{who}</Text>
    </View>
  );

  const slipBody = (
    <>
      {!lines.length && <Muted style={{ marginVertical: 12 }}>Ketuk menu untuk menambah pesanan.</Muted>}
      {lines.map((l) => (
        <View key={l.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#C9BDA2", borderStyle: "dashed" }}>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontFamily: F.body, fontSize: 17 }}>{l.m.n}</Text>
              {l.k ? <Muted>{l.k}</Muted> : null}
            </View>
            <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 17 }}>{rp(l.q * l.p).replace("Rp ", "")}</Text>
          </Row>
          <Row style={{ justifyContent: "flex-start", marginTop: 8 }}>
            <Round t="−" onPress={() => add(l.key, -1)} />
            <Text style={{ color: C.text, minWidth: 24, textAlign: "center", fontFamily: F.bold }}>{l.q}</Text>
            <Round t="+" onPress={() => add(l.key, 1)} />
          </Row>
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        <Chipbtn id="nama" label={name.trim() ? "Nama: " + name.trim() : "Nama"} on={!!name.trim()} />
        <Chipbtn id="meja" label={tl(table)} on={table !== TAKE} />
        <Chipbtn id="catatan" label={note.trim() ? "Catatan ✓" : "Catatan"} on={!!note.trim()} />
      </View>
      {extra === "nama" && <Field label="Nama pemesan" value={name} onChangeText={setName} maxLength={30} autoCapitalize="words" />}
      {extra === "catatan" && <Field label="Catatan pesanan" value={note} onChangeText={setNote} maxLength={60} placeholder="Besar, gula sedikit, es normal" />}
      {extra === "meja" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {(tables.length ? tables : [{ label: TAKE }]).map((t) => (
            <Pressable
              key={t.label}
              onPress={() => {
                setTable(t.label);
                setExtra(null);
              }}
              style={{
                minHeight: 38,
                paddingHorizontal: 14,
                borderRadius: 20,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: C.text,
                backgroundColor: table === t.label ? C.text : "transparent",
              }}
            >
              <Text style={{ color: table === t.label ? PAPER : C.text, fontFamily: F.bold, fontSize: 13 }}>{tl(t.label)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  const slipFoot = (
    <View style={{ paddingTop: 14 }}>
      <Row>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 30 }}>Total</Text>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 30 }}>{rp(total).replace("Rp ", "")}</Text>
      </Row>
      <BigBtn
        title="Bayar dan cetak struk"
        disabled={!lines.length}
        onPress={() => {
          setSheet(false);
          setCash("");
          setPay("cash");
          setPaying(true);
        }}
      />
    </View>
  );

  /* ---------- simpan pesanan ---------- */
  async function checkout(method) {
    if (!lines.length) return;
    if (method === "cash" && cash !== "" && change < 0) return Alert.alert("Uang kurang", "Uang diterima kurang dari total.");
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_shop: shop.id,
      p_items: lines.map((l) => ({ id: l.m.id, v: l.k || null, q: l.q })),
      p_name: name.trim(),
      p_note: note.trim(),
      p_table: table,
      p_pay: method,
    });
    if (error) {
      setBusy(false);
      Alert.alert("Gagal", errMsg(error));
      if (/habis|ditutup/.test(errMsg(error))) reload();
      return;
    }
    const k = method === "cash" && cash !== "" && change > 0 ? `\nKembalian ${rp(change)}` : "";
    setCart({});
    setName("");
    setNote("");
    setCash("");
    setExtra(null);
    setTable(TAKE);
    setPaying(false);
    setSheet(false);
    setBusy(false);
    reload();
    reloadShops(); // nomor pesanan berikutnya
    let printMsg = "";
    try {
      if (method !== "unpaid") await printOrder(shop, data, "customer");
    } catch (e) {
      printMsg = "\n(Struk tidak tercetak: " + String(e.message || e) + ")";
    }
    Alert.alert("Pesanan " + data.no, `${tl(data.table_label)} · ${rp(data.total)}${k}${printMsg}`);
  }

  /* ---------- layar Bayar ---------- */
  const mmss = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
  const expired = pay === "qris" && left === 0;
  const qrisBlocked = !online; // QRIS butuh internet
  const steps = [
    ["Kode dibuat", "done"],
    ["Menunggu pembayaran", expired ? "off" : "now"],
    ["Pembayaran masuk, struk tercetak", "next"],
  ];

  const payView = (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column", padding: wide ? 38 : 16, gap: wide ? 34 : 14 }}>
      <View style={{ width: wide ? 406 : "100%", backgroundColor: PAPER, borderWidth: 1, borderColor: EDGE, borderRadius: 4, padding: 24, maxHeight: wide ? undefined : 260 }}>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 30 }}>Pesanan {nextNo}</Text>
        {!!name.trim() && <Text style={{ color: C.muted, fontFamily: F.body, fontSize: 14, marginTop: 4 }}>atas nama {name.trim()}</Text>}
        <ScrollView style={{ flex: 1, marginTop: 10 }}>
          {lines.map((l) => (
            <Row key={l.key} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#C9BDA2", borderStyle: "dashed" }}>
              <Text style={{ color: C.text, fontFamily: F.body, fontSize: 16, flex: 1 }}>
                {l.q > 1 ? `${l.q}× ` : ""}
                {l.m.n}
                {l.k ? ` (${l.k})` : ""}
              </Text>
              <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 16 }}>{rp(l.q * l.p).replace("Rp ", "")}</Text>
            </Row>
          ))}
        </ScrollView>
        <Muted style={{ marginTop: 12 }}>Total tagihan</Muted>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 38 }}>{rp(total)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontFamily: F.head, fontSize: 36 }}>Bayar</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {PAYS.map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setPay(k)}
              style={{
                minHeight: 44,
                paddingHorizontal: 20,
                borderRadius: 22,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: pay === k ? C.text : "#B9AC93",
                backgroundColor: pay === k ? C.text : "transparent",
              }}
            >
              <Text style={{ color: pay === k ? PAPER : C.text, fontFamily: F.body, fontSize: 15 }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={{ flex: 1, marginTop: 16 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: "#F9F5EC", borderWidth: 1, borderColor: EDGE, borderRadius: 6, padding: 24 }}>
            {pay === "cash" && (
              <>
                <Field label="Uang diterima (opsional)" value={cash} onChangeText={(v) => setCash(v.replace(/\D/g, ""))} keyboardType="number-pad" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
                  {[...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000].filter((v) => v >= total && v > 0))].map((v) => (
                    <Pressable key={v} onPress={() => setCash(String(v))} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: "#B9AC93", justifyContent: "center" }}>
                      <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 13 }}>{v === total ? "Uang pas" : rp(v).replace("Rp ", "")}</Text>
                    </Pressable>
                  ))}
                </View>
                {cash !== "" && (
                  <Text style={{ color: change < 0 ? C.bad : C.ok, fontFamily: F.head, fontSize: 28, marginTop: 6 }}>
                    {change < 0 ? "Kurang " + rp(-change) : "Kembalian " + rp(change)}
                  </Text>
                )}
              </>
            )}
            {pay === "debit" && (
              <>
                <Text style={{ color: C.text, fontFamily: F.head, fontSize: 24 }}>Gesek atau tempel kartu</Text>
                <Muted style={{ marginTop: 6 }}>Proses {rp(total)} di mesin EDC, lalu tekan tombol di bawah setelah transaksi berhasil.</Muted>
              </>
            )}
            {pay === "qris" &&
              (qrisText && !expired ? (
                <View style={{ flexDirection: wide ? "row" : "column", gap: 28, alignItems: wide ? "center" : "stretch" }}>
                  <View style={{ backgroundColor: "#fff", padding: 12, borderRadius: 6, alignSelf: "center" }}>
                    <QRCode value={qrisText} size={wide ? 270 : 220} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Muted style={{ fontSize: 15 }}>Pelanggan memindai dengan aplikasi bank atau e-wallet apa saja</Muted>
                    <Text style={{ color: C.text, fontFamily: F.head, fontSize: 48, marginTop: 14 }}>{mmss}</Text>
                    <Muted>sisa waktu kode berlaku</Muted>
                    <View style={{ marginTop: 18, gap: 10 }}>
                      {steps.map(([t, st]) => (
                        <Row key={t} style={{ justifyContent: "flex-start" }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: st === "done" ? C.ok : st === "now" ? "#B98512" : "#C9BDA2" }} />
                          <Text style={{ color: st === "next" ? C.muted : C.text, fontFamily: st === "now" ? F.bold : F.body, fontSize: 15 }}>{t}</Text>
                        </Row>
                      ))}
                    </View>
                  </View>
                </View>
              ) : expired ? (
                <>
                  <Text style={{ color: C.bad, fontFamily: F.head, fontSize: 24 }}>Kode kedaluwarsa</Text>
                  <Muted style={{ marginTop: 6 }}>Tekan "Buat ulang kode" untuk membuat kode baru.</Muted>
                </>
              ) : (
                <Text style={{ color: C.bad, fontFamily: F.bold, fontSize: 15 }}>
                  {qrisOk ? "Kode QRIS toko tidak valid. Periksa di Lainnya, Profil toko." : "Kode QRIS toko belum diisi. Pemilik bisa mengisinya di Lainnya, Profil toko."}
                </Text>
              ))}
          </View>

          {pay === "qris" && (
            <View style={{ backgroundColor: "#F1E4C6", borderRadius: 4, padding: 14, marginTop: 14 }}>
              <Text style={{ color: C.text, fontFamily: F.body, fontSize: 13 }}>
                {qrisBlocked
                  ? "Koneksi internet terputus. QRIS tidak bisa dipakai, arahkan pelanggan ke tunai."
                  : "QRIS butuh internet. Kalau koneksi putus, tombol ini mati dan kasir diarahkan ke tunai."}
              </Text>
            </View>
          )}
        </ScrollView>

        <Row style={{ marginTop: 8, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <OutBtn title="Ganti metode" onPress={() => setPay(pay === "cash" ? "qris" : "cash")} />
            {pay === "qris" && <OutBtn title="Buat ulang kode" onPress={() => setCodeNo((n) => n + 1)} />}
          </View>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {pay !== "qris" || !expired ? (
              <BigBtn
                small
                title={pay === "qris" ? "Uang sudah masuk, cetak struk" : "Bayar dan cetak struk"}
                loading={busy}
                disabled={pay === "qris" && (!qrisText || qrisBlocked)}
                onPress={() => checkout(pay)}
              />
            ) : null}
            <BigBtn small title="Batalkan" onPress={() => setPaying(false)} />
          </View>
        </Row>
      </View>
    </View>
  );

  /* ---------- tata letak ---------- */
  const menuPane = !cats.length ? (
    <View style={{ padding: 16 }}>
      <Muted>{loaded ? "Menu masih kosong. Tambahkan di tab Menu." : "Memuat..."}</Muted>
    </View>
  ) : (
    <>
      <View style={{ paddingHorizontal: wide ? 31 : 12, paddingTop: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {cats.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCat(c)}
              style={{
                minHeight: 46,
                paddingHorizontal: 22,
                borderRadius: 23,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: c === curCat ? C.text : "#B9AC93",
                backgroundColor: c === curCat ? C.text : "transparent",
              }}
            >
              <Text style={{ color: c === curCat ? PAPER : C.text, fontFamily: F.body, fontSize: 16 }}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: wide ? 24 : 6, paddingTop: 14, paddingBottom: wide ? 24 : 110, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" }}
      >
        {menu.filter((m) => m.c === curCat).map(card)}
      </ScrollView>
    </>
  );

  const title = (
    <View style={{ paddingHorizontal: wide ? 31 : 16, paddingTop: wide ? 28 : 12, flexDirection: wide ? "row" : "column", alignItems: wide ? "baseline" : "flex-start", justifyContent: "space-between", gap: 4 }}>
      <Text style={{ color: C.text, fontFamily: F.head, fontSize: wide ? 44 : 30 }}>{(shop && shop.name) || "Kasir"}</Text>
      <Text style={{ color: C.muted, fontFamily: F.body, fontSize: 14, flexShrink: 1, textAlign: wide ? "right" : "left" }}>{sub}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {paying ? (
        payView
      ) : wide ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>
            {title}
            {menuPane}
          </View>
          <View
            style={{
              width: 426,
              margin: 38,
              marginLeft: 8,
              backgroundColor: PAPER,
              borderWidth: 1,
              borderColor: EDGE,
              borderRadius: 4,
              padding: 24,
              shadowColor: "#3a2a14",
              shadowOpacity: 0.12,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            {slipHead}
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {slipBody}
            </ScrollView>
            {slipFoot}
          </View>
        </View>
      ) : (
        <>
          {title}
          {menuPane}
          {count > 0 && (
            <Pressable
              onPress={() => setSheet(true)}
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                backgroundColor: a,
                borderRadius: 4,
                padding: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: onColor(a), fontFamily: F.bold }}>
                {count} item · {rp(total)}
              </Text>
              <Text style={{ color: onColor(a), fontFamily: F.bold }}>Lihat pesanan ›</Text>
            </Pressable>
          )}
          <Sheet visible={sheet} onClose={() => setSheet(false)} title={`Pesanan ${nextNo}`}>
            <Text style={{ color: C.muted, fontFamily: F.body, marginBottom: 6 }}>{who}</Text>
            {slipBody}
            {slipFoot}
          </Sheet>
        </>
      )}
    </SafeAreaView>
  );
}

const BigBtn = ({ title, onPress, disabled, loading, small }) => {
  const a = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: small ? 50 : 56,
        marginTop: small ? 0 : 12,
        paddingHorizontal: 24,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: a,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: onColor(a), fontFamily: F.bold, fontSize: 17 }}>{loading ? "Memproses..." : title}</Text>
    </Pressable>
  );
};

const OutBtn = ({ title, onPress }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{ minHeight: 50, paddingHorizontal: 22, borderRadius: 25, borderWidth: 1, borderColor: "#B9AC93", justifyContent: "center", backgroundColor: "#EFE7D5" }}
  >
    <Text style={{ color: C.text, fontFamily: F.body, fontSize: 16 }}>{title}</Text>
  </Pressable>
);

const Round = ({ t, onPress }) => {
  const a = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: a, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: a, fontSize: 20, fontFamily: F.bold }}>{t}</Text>
    </Pressable>
  );
};
