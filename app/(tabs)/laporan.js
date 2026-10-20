// Laporan penjualan (khusus pemilik): pendapatan, grafik, menu terlaris, meja, metode bayar, sumber pesanan, ekspor PDF.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useFocusEffect } from "expo-router";
import { useApp } from "../../src/state/store";
import { fetchOrders } from "../../src/lib/data";
import { rp, dm, startOf, sum, units, num, tl, PAID, PAY, ts, dt } from "../../src/lib/format";
import { Screen, Card, Row, Btn, Pills, Muted, H, Banner, C, useAccent } from "../../src/ui";

const RNG = [["today", "Hari ini"], ["7", "7 hari"], ["30", "30 hari"], ["all", "Semua"]];
const DAYS = { today: 0, 7: 6, 30: 29 };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

function Stat({ l, v, s }) {
  return (
    <Card style={{ width: "48%" }}>
      <Muted>{l}</Muted>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 17 }}>{v}</Text>
      {s ? <Muted>{s}</Muted> : null}
    </Card>
  );
}
function Rank({ rows, fmt }) {
  const a = useAccent();
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <Muted>Belum ada data.</Muted>;
  return rows.map((r) => (
    <View key={r[0]} style={{ marginVertical: 5 }}>
      <Row>
        <Text style={{ color: C.text, flex: 1 }}>{r[0]}</Text>
        <Text style={{ color: C.text, fontWeight: "700" }}>{fmt(r[1])}</Text>
      </Row>
      <View style={{ height: 4, backgroundColor: "#2a2a2a", borderRadius: 2, marginTop: 3 }}>
        <View style={{ height: 4, width: `${(r[1] / mx) * 100}%`, backgroundColor: a, borderRadius: 2 }} />
      </View>
    </View>
  ));
}

export default function Laporan() {
  const { shop, isOwner } = useApp();
  const a = useAccent();
  const [rng, setRng] = useState("today");
  const [all, setAll] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const since = rng === "all" ? 0 : startOf(Date.now()) - DAYS[rng] * 864e5;
  const load = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setErr("");
    try {
      setAll(await fetchOrders(shop.id, since));
    } catch (e) {
      setErr("Laporan tidak bisa dimuat. Periksa koneksi.");
    }
    setLoading(false);
  }, [shop && shop.id, since]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const R = useMemo(() => {
    const l = all.filter((o) => PAID.includes(o.status));
    const items = {}, tbs = {}, vc = {}, pm = {}, src = { pos: 0, web: 0 };
    l.forEach((o) => {
      tbs[tl(o.table_label)] = (tbs[tl(o.table_label)] || 0) + 1;
      pm[PAY[o.pay_method] || o.pay_method] = (pm[PAY[o.pay_method] || o.pay_method] || 0) + num(o.total);
      src[o.source === "web" ? "web" : "pos"] += 1;
      (o.items || []).forEach((i) => {
        if (i.v) vc[i.v] = (vc[i.v] || 0) + num(i.q);
        const k = String(i.n).replace(i.v ? new RegExp("\\s*\\(" + i.v + "\\)$") : /$^/, "");
        items[k] = (items[k] || 0) + num(i.q);
      });
    });
    let bars, lab;
    if (rng === "today") {
      bars = Array(24).fill(0);
      l.forEach((o) => (bars[new Date(o.created_at).getHours()] += num(o.total)));
      lab = ["00", "12", "23"];
    } else {
      const d = rng === "7" ? 7 : rng === "30" ? 30 : Math.max(1, Math.min(60, Math.ceil((Date.now() - (l.length ? Math.min(...l.map(ts)) : Date.now())) / 864e5) + 1));
      const s0 = startOf(Date.now()) - (d - 1) * 864e5;
      bars = Array(d).fill(0);
      l.forEach((o) => {
        const k = Math.floor((startOf(ts(o)) - s0) / 864e5);
        if (k >= 0 && k < d) bars[k] += num(o.total);
      });
      lab = [dm(s0), dm(s0 + (((d - 1) / 2) | 0) * 864e5), dm(s0 + (d - 1) * 864e5)];
    }
    const sorted = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]);
    return { l, rev: sum(l), bars, lab, top: sorted(items).slice(0, 8), tb: sorted(tbs).slice(0, 6), vc: sorted(vc), pm: sorted(pm), src };
  }, [all, rng]);

  async function pdf() {
    try {
      const rows = R.l
        .map(
          (o) =>
            `<tr><td>${esc(dt(o.created_at))}</td><td>${esc(o.no)}</td><td>${esc(tl(o.table_label))}</td><td>${esc(PAY[o.pay_method] || "")}</td><td>${esc((o.items || []).map((i) => i.q + "x " + i.n).join(", "))}</td><td style="text-align:right">${esc(rp(o.total))}</td></tr>`,
        )
        .join("");
      const html = `<html><head><meta charset="utf-8"><style>body{font-family:Helvetica;font-size:10px}h1{font-size:16px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px;text-align:left;vertical-align:top}th{background:#eee}</style></head><body><h1>Laporan ${esc(shop.name)}</h1><p>${esc(RNG.find((r) => r[0] === rng)[1])} · ${R.l.length} transaksi · ${units(R.l)} item · <b>${esc(rp(R.rev))}</b></p><table><tr><th>Waktu</th><th>No</th><th>Meja</th><th>Bayar</th><th>Item</th><th>Total</th></tr>${rows}</table></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch (e) {
      Alert.alert("Gagal membuat PDF", String(e.message || e));
    }
  }

  if (!isOwner) return <Screen><Muted>Laporan hanya untuk pemilik toko.</Muted></Screen>;
  const mx = Math.max(1, ...R.bars);
  const peak = R.bars.indexOf(Math.max(...R.bars));

  return (
    <Screen>
      <Pills value={rng} onChange={setRng} items={RNG} />
      <Banner bad text={err} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Stat l="Pendapatan" v={rp(R.rev)} />
        <Stat l="Item terjual" v={units(R.l)} s={R.l.length + " transaksi"} />
        <Stat l="Rata-rata pesanan" v={rp(R.l.length ? R.rev / R.l.length : 0)} />
        <Stat l="Kasir / Website" v={`${R.src.pos} / ${R.src.web}`} />
      </View>
      <Card>
        <Text style={{ color: C.text, fontWeight: "700" }}>Pendapatan {rng === "today" ? "per jam" : "per hari"}</Text>
        {R.rev > 0 && <Muted>{rng === "today" ? `Jam tersibuk: ${String(peak).padStart(2, "0")}:00` : `Hari terbaik: ${rp(mx)}`}</Muted>}
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 2, marginTop: 10 }}>
          {R.bars.map((v, i) => (
            <View key={i} style={{ flex: 1, minHeight: 2, height: `${(v / mx) * 100}%`, backgroundColor: v ? a : "#3a3a3a", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          ))}
        </View>
        <Row style={{ marginTop: 4 }}>{R.lab.map((x) => <Muted key={x}>{x}</Muted>)}</Row>
      </Card>
      <Card><Text style={{ color: C.text, fontWeight: "700" }}>Menu terlaris</Text><Rank rows={R.top} fmt={(v) => v + "×"} /></Card>
      {R.vc.length > 0 && <Card><Text style={{ color: C.text, fontWeight: "700" }}>Varian</Text><Rank rows={R.vc} fmt={(v) => v + "×"} /></Card>}
      <Card><Text style={{ color: C.text, fontWeight: "700" }}>Metode pembayaran</Text><Rank rows={R.pm} fmt={rp} /></Card>
      <Card><Text style={{ color: C.text, fontWeight: "700" }}>Meja paling aktif</Text><Rank rows={R.tb} fmt={(v) => v + " pesanan"} /></Card>
      <Btn title="Ekspor PDF" variant="ghost" onPress={pdf} loading={loading} disabled={!R.l.length} />
      {all.length >= 5000 && <Muted>Menampilkan 5000 pesanan terbaru.</Muted>}
    </Screen>
  );
}
