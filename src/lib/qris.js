// QRIS statis -> QRIS dengan nominal (dinamis), dihitung di perangkat sehingga tidak butuh internet.
// Format EMV QR: deretan [tag 2 digit][panjang 2 digit][isi]. Tag 54 = nominal, tag 63 = CRC16.
function crc16(s) {
  let c = 0xffff;
  for (let i = 0; i < s.length; i++) {
    c ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}

function parse(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (!/^\d{2}$/.test(tag) || !Number.isFinite(len) || i + 4 + len > s.length) return null;
    out.push([tag, s.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

/** Mengembalikan teks QRIS dengan nominal, atau null kalau kode statis tidak valid. */
export function qrisWithAmount(payload, amount) {
  const p = String(payload || "").trim();
  const n = Math.round(Number(amount));
  if (!/^000201/.test(p) || !(n > 0)) return null;
  const tags = parse(p);
  if (!tags) return null;
  const list = tags.filter(([t]) => t !== "54" && t !== "63").map(([t, v]) => (t === "01" ? [t, "12"] : [t, v]));
  const amt = String(n);
  const at = list.findIndex(([t]) => t > "54");
  list.splice(at < 0 ? list.length : at, 0, ["54", amt]);
  const body = list.map(([t, v]) => t + String(v.length).padStart(2, "0") + v).join("") + "6304";
  return body + crc16(body);
}
