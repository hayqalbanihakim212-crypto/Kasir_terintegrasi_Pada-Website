import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApp } from "../src/state/store";
import { fetchOrders } from "../src/lib/data";
import { printOrder } from "../src/lib/printer";
import { rp, hm, dt, dayName, startOf, sum, units, tl, STATUS, PAID, PAY, num, ts } from "../src/lib/format";
import { Screen, Card, Row, Btn, Chip, Field, Pills, Muted, T, C } from "../src/ui";

export default function Riwayat() {
  const { shop } = useApp();
  const [all, setAll] = useState([]);
  const [q, setQ] = useState("");
  const [st, setSt] = useState("paidall");
  const [open, setOpen] = useState(null);
  const [days, setDays] = useState(7);
  const [err, setErr] = useState("");

  const since = days === 0 ? 0 : startOf(Date.now()) - (days - 1) * 864e5;
  const load = useCallback(async () => {
    try {
      setErr("");
      setAll(await fetchOrders(shop.id, since));
    } catch (e) {
      setErr("Riwayat tidak bisa dimuat.");
    }
  }, [shop.id, since]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = useMemo(
    () =>
      all
        .filter((o) => st === "all" || (st === "paidall" ? PAID.includes(o.status) : o.status === st))
        .filter((o) => !q || [o.no, o.name, tl(o.table_label)].some((x) => String(x || "").toLowerCase().includes(q.toLowerCase()))),
    [all, q, st],
  );
  const list = rows.slice(0, 150);
  let day = "";

  return (
    <Screen>
      <Pills value={days} onChange={setDays} items={[[1, "Hari ini"], [7, "7 hari"], [30, "30 hari"], [0, "Semua"]]} />
      <Field label="Cari" value={q} onChangeText={setQ} placeholder="Nama, nomor pesanan, atau meja" />
      <Pills
        value={st}
        onChange={setSt}
        items={[["paidall", "Dibayar"], ["all", "Semua"], ["pending", "Menunggu"], ["failed", "Gagal"]]}
      />
      {!!err && <Muted style={{ color: C.bad }}>{err}</Muted>}
      <Muted>{rows.length} pesanan · {units(rows)} item · {rp(sum(rows.filter((o) => PAID.includes(o.status))))} dibayar</Muted>
      {list.map((o) => {
        const d = startOf(ts(o));
        let head = null;
        if (d !== day) {
          day = d;
          const g = rows.filter((x) => startOf(ts(x)) === d);
          head = (
            <Text style={{ color: C.muted, fontWeight: "700", marginTop: 14 }}>
              {dayName(d)} · {g.length} pesanan · {rp(sum(g.filter((x) => PAID.includes(x.status))))}
            </Text>
          );
        }
        const isOpen = open === o.id;
        return (
          <View key={o.id}>
            {head}
            <Pressable onPress={() => setOpen(isOpen ? null : o.id)}>
              <Card>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "700" }}>{tl(o.table_label)}</Text>
                    <Muted>{o.name ? o.name + ", " : ""}{hm(o.created_at)} · {units([o])} item</Muted>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Chip text={STATUS[o.status] || o.status} />
                    <Text style={{ color: C.text, fontWeight: "700" }}>{rp(o.total)}</Text>
                  </View>
                </Row>
                {isOpen && (
                  <View style={{ marginTop: 10 }}>
                    <Muted>{o.no} · {dt(o.created_at)} · {PAY[o.pay_method] || o.pay_method}{o.source === "web" ? " · website" : ""}</Muted>
                    {(o.items || []).map((i, k) => (
                      <Row key={k} style={{ paddingVertical: 3 }}>
                        <T style={{ flex: 1 }}>{num(i.q)}× {i.n}</T>
                        <T>{rp(num(i.q) * num(i.p))}</T>
                      </Row>
                    ))}
                    {!!o.note && <Muted>Catatan: {o.note}</Muted>}
                    <Btn
                      small
                      variant="ghost"
                      title="Cetak struk"
                      style={{ marginTop: 8, alignSelf: "flex-start" }}
                      onPress={() => printOrder(shop, o).catch((e) => Alert.alert("Tidak bisa mencetak", String(e.message || e)))}
                    />
                  </View>
                )}
              </Card>
            </Pressable>
          </View>
        );
      })}
      {rows.length > 150 && <Muted>Menampilkan 150 terbaru. Persempit pencarian.</Muted>}
    </Screen>
  );
}
