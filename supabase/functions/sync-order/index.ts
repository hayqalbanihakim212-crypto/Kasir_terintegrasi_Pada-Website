// Cek status ke Midtrans (server ke server) kalau webhook telat. Dipanggil website saat pesanan masih "pending".
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
  let body: { order_id?: string; secret?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: o } = await db.from("orders").select("id, shop_id, total, status, secret, pay_method")
    .eq("id", body.order_id ?? "").maybeSingle();
  if (!o || o.secret !== body.secret) return json({ error: "not_found" }, 404);
  if (o.status !== "pending" || o.pay_method !== "online") return json({ status: o.status });

  const { data: k } = await db.from("shop_secrets").select("*").eq("shop_id", o.shop_id).maybeSingle();
  if (!k?.midtrans_server_key) return json({ status: o.status });

  const host = k.midtrans_env === "production" ? "api.midtrans.com" : "api.sandbox.midtrans.com";
  try {
    const r = await fetch(`https://${host}/v2/${o.id}/status`, {
      headers: { Authorization: "Basic " + btoa(k.midtrans_server_key + ":"), Accept: "application/json" },
    });
    const j = await r.json();
    const paid = j.transaction_status === "settlement" ||
      (j.transaction_status === "capture" && j.fraud_status === "accept");
    const failed = ["deny", "cancel", "expire", "failure"].includes(j.transaction_status);
    if (paid && Math.round(parseFloat(j.gross_amount)) === o.total) {
      await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", o.id).eq("status", "pending");
      return json({ status: "paid" });
    }
    if (failed) {
      await db.from("orders").update({ status: "failed" }).eq("id", o.id).eq("status", "pending");
      return json({ status: "failed" });
    }
  } catch { /* abaikan, status tetap */ }
  return json({ status: o.status });
});
