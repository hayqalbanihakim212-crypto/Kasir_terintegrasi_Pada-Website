import React, { useEffect, useRef, useState } from "react";
import { Alert, Text } from "react-native";
import { Screen, Card, Row, Btn, Banner, Muted, Pills, H, C } from "../src/ui";
import { scan, connect, printTest, forget, loadPrinterPref, savePrinterPref } from "../src/lib/printer";

export default function Printer() {
  const [pref, setPref] = useState({ width: 32 });
  const [found, setFound] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const stop = useRef(null);

  useEffect(() => {
    loadPrinterPref().then(setPref);
    return () => stop.current && stop.current();
  }, []);

  async function start() {
    setFound([]);
    setMsg(null);
    try {
      setScanning(true);
      stop.current = await scan(
        (d) => setFound((l) => [...l, d]),
        (e) => setMsg({ bad: 1, t: String(e.message || e) }),
      );
      setTimeout(() => {
        stop.current && stop.current();
        setScanning(false);
      }, 12000);
    } catch (e) {
      setScanning(false);
      setMsg({ bad: 1, t: String(e.message || e) });
    }
  }
  async function pick(d) {
    setBusy(d.id);
    try {
      stop.current && stop.current();
      setScanning(false);
      await connect(d.id, d.name);
      setPref(await loadPrinterPref());
      setMsg({ t: `Terhubung ke ${d.name}.` });
    } catch (e) {
      setMsg({ bad: 1, t: String(e.message || e) });
    }
    setBusy(null);
  }
  async function test() {
    try {
      await printTest();
      setMsg({ t: "Tes cetak dikirim." });
    } catch (e) {
      setMsg({ bad: 1, t: String(e.message || e) });
    }
  }
  async function setWidth(w) {
    const p = { ...pref, width: w };
    setPref(p);
    await savePrinterPref(p);
  }

  return (
    <Screen>
      <Muted>
        Mendukung printer thermal Bluetooth LE (BLE) 58mm/80mm berbahasa ESC/POS. Printer Bluetooth "klasik" tidak
        bisa dipakai di iPhone. Fitur ini butuh aplikasi hasil build (bukan Expo Go).
      </Muted>
      <Banner bad={msg && msg.bad} text={msg && msg.t} />
      <Card accent={!!pref.id}>
        <Text style={{ color: C.text, fontWeight: "700" }}>{pref.id ? pref.name || "Printer tersimpan" : "Belum ada printer"}</Text>
        {pref.id && (
          <Row style={{ marginTop: 8 }}>
            <Btn small title="Tes cetak" onPress={test} />
            <Btn small variant="danger" title="Lupakan" onPress={async () => { await forget(); setPref(await loadPrinterPref()); }} />
          </Row>
        )}
      </Card>
      <H>Lebar kertas</H>
      <Pills value={pref.width || 32} onChange={setWidth} items={[[32, "58 mm"], [48, "80 mm"]]} />
      <Btn title={scanning ? "Mencari printer..." : "Cari printer"} onPress={start} loading={scanning} />
      {found.map((d) => (
        <Card key={d.id}>
          <Row>
            <Text style={{ color: C.text, flex: 1 }}>{d.name}</Text>
            <Btn small title="Pilih" loading={busy === d.id} onPress={() => pick(d)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
