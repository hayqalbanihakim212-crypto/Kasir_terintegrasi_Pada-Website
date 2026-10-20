// Pembuat byte ESC/POS untuk printer thermal 58mm (32 kolom) atau 80mm (48 kolom).
import { rp, num, dt, tl } from "./format";

const ESC = 0x1b;
const GS = 0x1d;
const ascii = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");

class B {
  constructor(width) {
    this.w = width;
    this.b = [];
  }
  raw(...x) {
    this.b.push(...x);
    return this;
  }
  text(s) {
    for (const c of ascii(s)) this.b.push(c.charCodeAt(0));
    return this;
  }
  nl(n = 1) {
    for (let i = 0; i < n; i++) this.b.push(0x0a);
    return this;
  }
  align(a) {
    return this.raw(ESC, 0x61, a === "c" ? 1 : a === "r" ? 2 : 0);
  }
  bold(on) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  size(big) {
    return this.raw(GS, 0x21, big ? 0x11 : 0x00);
  }
  line(ch = "-") {
    return this.text(ch.repeat(this.w)).nl();
  }
  // kiri .... kanan, kiri dipotong kalau terlalu panjang
  lr(l, r) {
    l = ascii(l);
    r = ascii(r);
    const room = this.w - r.length - 1;
    if (l.length > room) l = l.slice(0, Math.max(1, room));
    return this.text(l + " ".repeat(this.w - l.length - r.length) + r).nl();
  }
  wrap(s) {
    s = ascii(s);
    while (s.length > this.w) {
      this.text(s.slice(0, this.w)).nl();
      s = s.slice(this.w);
    }
    return this.text(s).nl();
  }
  done() {
    return Uint8Array.from(this.b);
  }
}

/** kind: "customer" (struk) atau "kitchen" (tiket dapur tanpa harga) */
export function receiptBytes(shop, o, { width = 32, kind = "customer" } = {}) {
  const b = new B(width);
  b.raw(ESC, 0x40); // reset
  b.align("c").bold(true).size(true).text(shop.name).nl().size(false).bold(false);
  if (kind === "customer") {
    if (shop.address) b.wrap(shop.address);
    if (shop.phone) b.text(shop.phone).nl();
  } else {
    b.bold(true).text("TIKET DAPUR").bold(false).nl();
  }
  b.align("l").line();
  b.align("c").bold(true).size(true).text(tl(o.table_label)).nl().size(false).bold(false);
  b.align("l");
  b.lr("No", o.no);
  if (o.name) b.lr("Nama", o.name);
  b.lr("Waktu", dt(o.created_at));
  b.line();
  for (const i of o.items || []) {
    if (kind === "kitchen") {
      b.bold(true).wrap(num(i.q) + "x " + i.n).bold(false);
    } else {
      b.lr(num(i.q) + "x " + i.n, rp(num(i.q) * num(i.p)));
    }
  }
  b.line();
  if (kind === "customer") {
    b.bold(true).lr("TOTAL", rp(o.total)).bold(false);
    const paid = ["paid", "making", "ready", "done"].includes(o.status);
    b.align("c").text(paid ? "LUNAS" : "BELUM DIBAYAR").nl();
  }
  if (o.note) {
    b.align("l").line().wrap("Catatan: " + o.note);
  }
  if (kind === "customer") {
    b.align("c").nl().text(shop.receipt_footer || "Terima kasih").nl();
  }
  b.nl(3).raw(GS, 0x56, 0x00); // potong kertas (diabaikan printer tanpa pemotong)
  return b.done();
}

export const testBytes = (width = 32) => {
  const b = new B(width);
  b.raw(ESC, 0x40).align("c").bold(true).text("TES PRINTER").bold(false).nl();
  b.line().text("Printer terhubung dengan baik.").nl().line().nl(3);
  return b.done();
};
