// Membuat transaksi Midtrans Snap untuk pesanan website. Dipanggil dari website toko / kasir-embed.js.
// Kunci server Midtrans milik tiap toko diambil dari tabel shop_secrets (tidak pernah keluar dari server).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { order_id?: string; secret?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: o } = await db.from("orders")
    .select("id, shop_id, total, status, secret, items, name")
    .eq("id", body.order_id ?? "").maybeSingle();
  if (!o || o.secret !== body.secret || o.status !== "pending") return json({ error: "invalid" }, 400);

  const { data: k } = await db.from("shop_secrets").select("*").eq("shop_id", o.shop_id).maybeSingle();
  if (!k?.midtrans_server_key) return json({ error: "not_configured" }, 400);

  const base = k.midtrans_env === "production" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const r = await fetch(base + "/snap/v1/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(k.midtrans_server_key + ":") },
    body: JSON.stringify({
      transaction_details: { order_id: o.id, gross_amount: o.total },
      item_details: (o.items as Array<{ id: string; n: string; p: number; q: number }>).map((i) => ({
        id: String(i.id).slice(0, 50), name: String(i.n).slice(0, 50), price: i.p, quantity: i.q,
      })),
      customer_details: { first_name: (o.name || "Pelanggan").slice(0, 30) },
      expiry: { unit: "minutes", duration: 15 },
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.token) return json({ error: "midtrans", detail: j.error_messages ?? null }, 502);
  return json({
    token: j.token,
    redirect_url: j.redirect_url,
    client_key: k.midtrans_client_key,
    snap_url: base + "/snap/snap.js",
  });
});
