export const TAKE = "Bawa pulang";
export const tl = (t) => (t === TAKE || !t ? TAKE : /^\d+$/.test(t) ? "Meja " + t : t);
export const num = (v) => Number(v) || 0;
export const rp = (n) =>
  "Rp " + Math.round(num(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const p2 = (n) => String(n).padStart(2, "0");
export const hm = (t) => {
  const d = new Date(t);
  return p2(d.getHours()) + ":" + p2(d.getMinutes());
};
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const dm = (t) => {
  const d = new Date(t);
  return p2(d.getDate()) + " " + BLN[d.getMonth()];
};
export const dmy = (t) => dm(t) + " " + new Date(t).getFullYear();
export const dayName = (t) => HARI[new Date(t).getDay()] + ", " + dm(t);
export const dt = (t) => dmy(t) + " " + hm(t);
export const startOf = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const units = (list) =>
  list.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + num(i.q), 0), 0);
export const sum = (list) => list.reduce((s, o) => s + num(o.total), 0);
export const ts = (o) => new Date(o.created_at).getTime();
export const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const STATUS = {
  pending: "Menunggu bayar",
  paid: "Dibayar",
  making: "Dibuat",
  ready: "Siap",
  done: "Selesai",
  failed: "Gagal",
};
export const PAID = ["paid", "making", "ready", "done"];
export const PAY = { cash: "Tunai", qris: "QRIS", transfer: "Transfer", debit: "Kartu debit", online: "Online", counter: "Di kasir" };

// URL di dalam QR meja: alamat website toko + ?meja=KODE
export const tableUrl = (base, code) => {
  const b = String(base || "").trim();
  if (!b) return "";
  return b + (b.includes("?") ? "&" : "?") + "meja=" + code;
};
