// Printer thermal Bluetooth LE. Catatan: iOS hanya mendukung BLE; printer Bluetooth "klasik" (SPP)
// tidak bisa dipakai di iOS. Di Android, pilih printer yang mendukung BLE juga.
// Modul native dimuat malas supaya aplikasi tidak crash di Expo Go (printer butuh development build).
import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { receiptBytes, testBytes } from "./escpos";

const KEY = "kasir_printer";
let mgr = null;
let dev = null; // { device, service, char, withResponse }

const manager = () => {
  if (mgr) return mgr;
  try {
    const { BleManager } = require("react-native-ble-plx");
    mgr = new BleManager();
    return mgr;
  } catch (e) {
    throw new Error("Printer butuh development build (bukan Expo Go).");
  }
};

export const loadPrinterPref = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || "null") || { width: 32 };
  } catch (e) {
    return { width: 32 };
  }
};
export const savePrinterPref = (p) => AsyncStorage.setItem(KEY, JSON.stringify(p));

async function ask() {
  if (Platform.OS !== "android") return;
  const P = PermissionsAndroid.PERMISSIONS;
  const need =
    Platform.Version >= 31
      ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT]
      : [P.ACCESS_FINE_LOCATION];
  const r = await PermissionsAndroid.requestMultiple(need);
  if (!need.every((p) => r[p] === PermissionsAndroid.RESULTS.GRANTED))
    throw new Error("Izin Bluetooth ditolak. Aktifkan di Pengaturan HP.");
}

/** Cari printer di sekitar. Kembalikan fungsi untuk berhenti. */
export async function scan(onDevice, onError) {
  await ask();
  const m = manager();
  const seen = new Set();
  m.startDeviceScan(null, { allowDuplicates: false }, (err, d) => {
    if (err) return onError && onError(err);
    if (d && d.name && !seen.has(d.id)) {
      seen.add(d.id);
      onDevice({ id: d.id, name: d.name });
    }
  });
  return () => m.stopDeviceScan();
}

async function open(id) {
  const m = manager();
  m.stopDeviceScan();
  let d = await m.connectToDevice(id, { timeout: 12000 });
  d = await d.discoverAllServicesAndCharacteristics();
  let pick = null;
  for (const s of await d.services()) {
    for (const c of await d.characteristicsForService(s.uuid)) {
      if (c.isWritableWithResponse || c.isWritableWithoutResponse) {
        pick = { service: s.uuid, char: c.uuid, withResponse: !!c.isWritableWithResponse };
        // lebih suka karakteristik yang umum dipakai printer thermal
        if (/ff02|2af1|bef8d6c9/i.test(c.uuid)) break;
      }
    }
    if (pick && /ff00|18f0|e7810a71|49535343/i.test(pick.service)) break;
  }
  if (!pick) throw new Error("Printer tidak punya jalur tulis yang dikenali.");
  dev = { device: d, ...pick };
  return dev;
}

export async function connect(id, name) {
  await ask();
  await open(id);
  const pref = await loadPrinterPref();
  await savePrinterPref({ ...pref, id, name });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function write(bytes) {
  const pref = await loadPrinterPref();
  if (!pref.id) throw new Error("Printer belum dipilih. Buka Lainnya > Printer.");
  await ask();
  try {
    if (!dev || !(await dev.device.isConnected())) await open(pref.id);
  } catch (e) {
    dev = null;
    throw new Error("Printer tidak terjangkau. Nyalakan printer dan dekatkan.");
  }
  const CH = 100;
  for (let i = 0; i < bytes.length; i += CH) {
    const b64 = Buffer.from(bytes.slice(i, i + CH)).toString("base64");
    if (dev.withResponse)
      await dev.device.writeCharacteristicWithResponseForService(dev.service, dev.char, b64);
    else await dev.device.writeCharacteristicWithoutResponseForService(dev.service, dev.char, b64);
    await sleep(25);
  }
}

export async function printOrder(shop, order, kind = "customer") {
  const { width } = await loadPrinterPref();
  return write(receiptBytes(shop, order, { width: width || 32, kind }));
}
export async function printTest() {
  const { width } = await loadPrinterPref();
  return write(testBytes(width || 32));
}
export async function forget() {
  try {
    if (dev) await dev.device.cancelConnection();
  } catch (e) {}
  dev = null;
  const pref = await loadPrinterPref();
  await savePrinterPref({ width: pref.width || 32 });
}
