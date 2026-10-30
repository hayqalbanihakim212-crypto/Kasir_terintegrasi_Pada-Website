// Antrian dapur: pesanan dari kasir dan dari website masuk di sini secara realtime.
import React, { useEffect, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../src/state/store";
import { supabase, errMsg } from "../../src/lib/supabase";
import { printOrder } from "../../src/lib/printer";
import { rp, hm, tl, STATUS, startOf, sum, units, PAID, ts } from "../../src/lib/format";
import { Card, Row, Btn, Chip, Pills, Muted, T, Banner, C, H } from "../../src/ui";

const NEXT = {
  pending: ["paid", "Terima pembayaran"],
  paid: ["making", "Mulai buat"],
  making: ["ready", "Pesanan siap"],
  ready: ["done", "Selesaikan"],
};

export default function Antrian() {
  const { shop, orders, reload, online, loaded } = useApp();
  const [f, setF] = useState("all");
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seen = useRef(null);
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const act = orders.filter((o) => NEXT[o.status]).sort((a, b) => ts(a) - ts(b));

  // getar saat ada pesanan baru (dibayar, atau pesanan website menunggu)
  useEffect(() => {
    const ids = new Set(act.filter((o) => o.status === "paid" || o.source === "web").map((o) => o.id));
    if (seen.current && [...ids].some((i) => !seen.current.has(i)))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    seen.current = ids;
  }, [orders]);

  const today = orders.filter((o) => PAID.includes(o.status) && ts(o) >= startOf(now));
  const show = act.filter((o) => f === "all" || o.status === f);
  const cnt = (s) => act.filter((o) => o.status === s).length;

  async function move(o, status) {
    setBusy(o.id);
    const { error } = await supabase.rpc("set_order_status", { p_id: o.id, p_status: status });
    setBusy(null);
    if (error) Alert.alert("Gagal", errMsg(error));
    reload();
  }
  async function cancel(o) {
    Alert.alert("Batalkan pesanan?", `${o.no} akan ditandai gagal.`, [
      { text: "Tidak" },
      { text: "Batalkan", style: "destructive", onPress: () => move(o, "failed") },
    ]);
  }
  async function print(o, kind) {
    try {
      await printOrder(shop, o, kind);
    } catch (e) {
      Alert.alert("Tidak bisa mencetak", String(e.message || e));
    }
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#999"
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
      >
        {!online && <Banner bad text="Koneksi terputus. Data mungkin tidak terbaru, mencoba lagi..." />}
        <Row style={{ gap: 8 }}>
          <Card style={{ flex: 1 }}>
            <Muted>Pendapatan hari ini</Muted>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>{rp(sum(today))}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Muted>Transaksi / item</Muted>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>
              {today.length} / {units(today)}
            </Text>
          </Card>
        </Row>
        <H>Antrean pesanan</H>
        <Pills
          value={f}
          onChange={setF}
          items={[
            ["all", `Semua ${act.length}`],
            ["pending", `Menunggu ${cnt("pending")}`],
            ["paid", `Dibayar ${cnt("paid")}`],
            ["making", `Dibuat ${cnt("making")}`],
            ["ready", `Siap ${cnt("ready")}`],
          ]}
        />
        {!loaded && <Muted>Memuat...</Muted>}
        {loaded && !show.length && <Muted>Tidak ada pesanan di antrian ini.</Muted>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12 }}>
        {show.map((o) => {
          const mins = Math.max(0, Math.floor((now - ts(o)) / 60000));
          const late = o.status === "paid" && mins >= 10;
          const [next, label] = NEXT[o.status];
          return (
            <Card key={o.id} style={[{ width: cols === 1 ? "100%" : `${100 / cols - 2}%` }, late ? { borderColor: C.bad } : null]}>
              <Row>
                <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>{tl(o.table_label)}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {o.source === "web" && <Chip text="WEBSITE" color="#3b82f6" />}
                  <Chip text={STATUS[o.status]} color={o.status === "ready" ? C.ok : undefined} />
                </View>
              </Row>
              <Muted>
                {o.no}
                {o.name ? `, ${o.name}` : ""}, {hm(o.created_at)}{" "}
                <Text style={late ? { color: C.bad, fontWeight: "700" } : null}>({mins} mnt)</Text>
              </Muted>
              <View style={{ marginVertical: 8 }}>
                {(o.items || []).map((i, k) => (
                  <T key={k}>
                    {i.q}× {i.n}
                  </T>
                ))}
              </View>
              {!!o.note && <Muted>Catatan: {o.note}</Muted>}
              <Row style={{ marginTop: 8 }}>
                <Text style={{ color: C.text, fontWeight: "800" }}>{rp(o.total)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn title="Struk" variant="ghost" small onPress={() => print(o, "customer")} />
                  <Btn title="Dapur" variant="ghost" small onPress={() => print(o, "kitchen")} />
                </View>
              </Row>
              <Row style={{ marginTop: 10, gap: 8 }}>
                {o.status === "pending" && (
                  <Btn title="Batalkan" variant="danger" small onPress={() => cancel(o)} />
                )}
                <Btn
                  title={label}
                  small
                  style={{ flex: 1 }}
                  loading={busy === o.id}
                  onPress={() => move(o, next)}
                />
              </Row>
            </Card>
          );
        })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
