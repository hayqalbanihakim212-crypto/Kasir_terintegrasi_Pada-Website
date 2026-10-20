// Notifikasi pembayaran Midtrans. Atur URL ini di Midtrans > Settings > Payment > Notification URL:
//   https://<project-ref>.supabase.co/functions/v1/midtrans-webhook
// Tanda tangan diverifikasi memakai kunci server milik toko yang bersangkutan.
import { createClient } from "npm:@supabase/supabase-js@2";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha512 = async (s: string) => hex(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(s)));
const ok = (o: unknown = { ok: true }, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  let n: Record<string, string>;
  try { n = await req.json(); } catch { return ok({ error: "bad_json" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: o } = await db.from("orders").select("id, shop_id, total, status").eq("id", n.order_id ?? "").maybeSingle();
  if (!o) return ok({ ok: true }); // order tidak dikenal: balas 200 supaya Midtrans tidak mengulang terus
  const { data: k } = await db.from("shop_secrets").select("midtrans_server_key").eq("shop_id", o.shop_id).maybeSingle();
  if (!k?.midtrans_server_key) return ok({ error: "not_configured" }, 400);

  const sig = await sha512(n.order_id + n.status_code + n.gross_amount + k.midtrans_server_key);
  if (sig !== n.signature_key) return ok({ error: "bad_signature" }, 403);
  if (Math.round(parseFloat(n.gross_amount)) !== o.total) return ok({ error: "amount_mismatch" }, 400);

  // sama seperti backend lama: capture hanya sah jika fraud_status == accept
  const paid = n.transaction_status === "settlement" ||
    (n.transaction_status === "capture" && n.fraud_status === "accept");
  const failed = ["deny", "cancel", "expire", "failure"].includes(n.transaction_status);

  if (paid) {
    await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", o.id).eq("status", "pending");
  } else if (failed) {
    await db.from("orders").update({ status: "failed" }).eq("id", o.id).eq("status", "pending");
  }
  return ok();
});
