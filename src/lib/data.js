import { supabase } from "./supabase";

export const ORDER_COLS =
  "id,no,table_label,name,note,items,total,status,source,pay_method,created_at,paid_at";

/** Pesanan sejak waktu tertentu (ms), terbaru dulu, maksimal 5000 baris. */
export async function fetchOrders(shopId, sinceMs = 0) {
  const out = [];
  const iso = new Date(Math.max(0, sinceMs)).toISOString();
  for (let off = 0; off < 5000; off += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_COLS)
      .eq("shop_id", shopId)
      .gte("created_at", iso)
      .order("created_at", { ascending: false })
      .range(off, off + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Menu contoh generik untuk toko baru (bisa diubah/dihapus pemilik)
export const SAMPLE_MENU = {
  Minuman: {
    food: false,
    items: [
      { n: "Kopi Susu", variants: [{ k: "Panas", p: 18000 }, { k: "Dingin", p: 20000 }] },
      { n: "Teh Manis", variants: [{ k: "Panas", p: 6000 }, { k: "Dingin", p: 8000 }] },
      { n: "Air Mineral", p: 5000 },
    ],
  },
  Makanan: {
    food: true,
    items: [
      { n: "Nasi Goreng", p: 25000 },
      { n: "Mie Goreng", p: 22000 },
      { n: "Kentang Goreng", p: 15000 },
    ],
  },
};
