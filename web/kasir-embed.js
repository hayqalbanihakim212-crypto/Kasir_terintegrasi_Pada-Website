/* Kasir: widget menu + pesan untuk website toko. Tanpa dependensi.
   Pasang:
     <div id="kasir-menu" data-url="https://xxx.supabase.co" data-key="ANON_KEY" data-shop="slug-toko"></div>
     <script src="/kasir-embed.js"></script>
   Meja ditentukan dari QR (?meja=KODE). Tanpa kode, pelanggan hanya bisa melihat menu.
   Harga dan total SELALU dihitung server; browser hanya mengirim id menu, varian, dan jumlah. */
(function () {
  var root = document.getElementById("kasir-menu");
  if (!root) return;
  var URL_ = (root.dataset.url || "").replace(/\/+$/, ""),
    KEY = root.dataset.key || "",
    SLUG = root.dataset.shop || "",
    CODE = (new URLSearchParams(location.search).get("meja") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
    LS = "kasir_order_" + SLUG;

  var S = { shop: null, menu: [], cat: "", cart: {}, view: "menu", table: "", order: null, name: "", note: "", err: "", busy: false, sig: "" };
  try { S.order = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
  var FIN = function (s) { return s === "done" || s === "failed"; };

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var rp = function (n) { return "Rp " + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
  var tl = function (t) { return /^\d+$/.test(t) ? "Meja " + t : t; };

  function rpc(name, body) {
    return fetch(URL_ + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.message) || "error");
        return j;
      });
    });
  }

  var css = ".kq{--a:#e9a63b;font-family:system-ui,sans-serif;color:#f6f1e7;background:#0b0b0b;border-radius:16px;padding:16px;max-width:560px;margin:0 auto}" +
    ".kq *{box-sizing:border-box}.kq h3{margin:18px 0 6px;color:var(--a);text-transform:uppercase;letter-spacing:.05em;text-align:center}" +
    ".kq .m{color:#a99f8d;font-size:.85rem}.kq .c{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px}" +
    ".kq button{font:inherit;cursor:pointer}.kq .c button{flex:none;min-height:38px;padding:0 14px;border-radius:99px;border:1px solid var(--a);background:none;color:inherit;font-weight:600}" +
    ".kq .c .on{background:var(--a);color:#111}.kq .l{border:1px solid var(--a);border-radius:14px;padding:2px 14px}" +
    ".kq .i{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.1)}.kq .i:last-child{border:0}" +
    ".kq .n{flex:1;font-weight:600}.kq .p{color:var(--a);font-weight:700;white-space:nowrap}.kq .off{opacity:.45}" +
    ".kq .v{padding-left:12px}.kq .q{display:flex;align-items:center;gap:8px}.kq .q button,.kq .add{min-height:34px;min-width:34px;border-radius:10px;border:1px solid var(--a);background:none;color:var(--a);font-weight:700}" +
    ".kq .bar{position:sticky;bottom:8px;margin-top:14px;background:var(--a);color:#111;border-radius:14px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:800}" +
    ".kq .bar button,.kq .btn{background:#111;color:var(--a);border:0;border-radius:10px;min-height:42px;padding:0 18px;font-weight:700}" +
    ".kq .btn{display:block;width:100%;background:var(--a);color:#111;margin-top:10px}.kq .btn.g{background:none;color:var(--a);border:1px solid var(--a)}" +
    ".kq input{width:100%;min-height:44px;margin:4px 0 8px;padding:0 12px;border-radius:10px;border:1px solid #3a3a3a;background:#1a1a1a;color:inherit;font:inherit}" +
    ".kq .box{border:1px solid var(--a);border-radius:12px;padding:12px;margin:10px 0}.kq .bad{color:#ff8a80;margin:8px 0;font-weight:600}" +
    ".kq .st{display:flex;gap:6px;margin:14px 0;padding:0;list-style:none}.kq .st li{flex:1;text-align:center;font-size:.78rem;color:#a99f8d;border-top:4px solid #333;padding-top:5px}.kq .st .on{border-color:var(--a);color:#f6f1e7;font-weight:700}.kq .r{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted rgba(255,255,255,.2)}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var closed = function (m) { return !!m.closed; };
  var dead = function (m) { return m.off || closed(m); };
  function lines() {
    return Object.keys(S.cart).map(function (key) {
      var p = key.split("|"), m = S.menu.filter(function (x) { return x.id === p[0]; })[0];
      var vr = p[1] && m ? (m.v || []).filter(function (z) { return z.k === p[1]; })[0] : null;
      if (!m || dead(m) || (p[1] && (!vr || vr.off))) return null;
      return { key: key, m: m, k: p[1] || null, q: S.cart[key], p: vr ? vr.p : m.p };
    }).filter(Boolean);
  }
  var total = function () { return lines().reduce(function (s, l) { return s + l.q * l.p; }, 0); };
  var ORDERABLE = function () { return S.shop && S.shop.online && S.table; };

  function ctl(key) {
    return S.cart[key]
      ? '<div class="q"><button data-a="m:' + key + '">−</button><b>' + S.cart[key] + '</b><button data-a="p:' + key + '">+</button></div>'
      : '<button class="add" data-a="p:' + key + '">+</button>';
  }
  function item(m) {
    var d = dead(m), h = '<div class="i' + (d ? " off" : "") + '" style="' + (m.v ? "flex-direction:column;align-items:stretch" : "") + '"><div style="display:flex;gap:10px;align-items:center"><span class="n">' + esc(m.n) + "</span>";
    if (m.v && !d) {
      h += "</div>" + m.v.map(function (z) {
        return '<div class="i v' + (z.off ? " off" : "") + '" style="border:0;padding:4px 0 4px 12px"><span class="n m">' + esc(z.k) + "</span>" +
          (z.off ? '<span class="m">Habis</span>' : '<span class="p">' + rp(z.p) + "</span>" + (ORDERABLE() ? ctl(m.id + "|" + z.k) : "")) + "</div>";
      }).join("") + "</div>";
      return h;
    }
    if (d || !(m.p > 0)) h += '<span class="m">' + (closed(m) ? "Ditutup" : m.off ? "Habis" : "Segera") + "</span>";
    else h += '<span class="p">' + rp(m.p) + "</span>" + (ORDERABLE() ? ctl(m.id + "|") : "");
    return h + "</div></div>";
  }
  function menuV() {
    var cats = []; S.menu.forEach(function (m) { if (cats.indexOf(m.c) < 0) cats.push(m.c); });
    if (!S.cat || cats.indexOf(S.cat) < 0) S.cat = cats[0] || "";
    var hi = S.table
      ? '<p class="m">Pesananmu untuk <b>' + esc(tl(S.table)) + "</b>.</p>"
      : '<p class="m">' + (CODE ? "QR meja tidak dikenali." : "Scan QR di mejamu untuk memesan.") + " Kamu masih bisa melihat menu.</p>";
    var act = S.order && !FIN(S.order.status) ? '<button class="btn g" data-a="v:track">Pesanan aktif ' + esc(S.order.no) + ": lihat status</button>" : "";
    var n = lines().reduce(function (s, l) { return s + l.q; }, 0);
    return hi + act + '<div class="c">' + cats.map(function (c) { return '<button data-a="c:' + esc(c) + '" class="' + (c === S.cat ? "on" : "") + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      cats.filter(function (c) { return c === S.cat; }).map(function (c) {
        return "<h3>" + esc(c) + "</h3>" + '<div class="l">' + S.menu.filter(function (m) { return m.c === c; }).map(item).join("") + "</div>";
      }).join("") +
      (n ? '<div class="bar"><span>' + n + " item · " + rp(total()) + '</span><button data-a="v:co">Lanjut</button></div>' : "");
  }
  function coV() {
    return "<h3>Pesananmu</h3>" + lines().map(function (l) {
      return '<div class="r"><span>' + l.q + "× " + esc(l.m.n) + (l.k ? " (" + esc(l.k) + ")" : "") + "</span><b>" + rp(l.q * l.p) + "</b></div>";
    }).join("") + '<div class="r"><b>Total</b><b>' + rp(total()) + "</b></div>" +
      '<label class="m">Nama</label><input id="kq-n" maxlength="30" value="' + esc(S.name) + '" placeholder="Nama pemesan">' +
      '<label class="m">Catatan</label><input id="kq-t" maxlength="60" value="' + esc(S.note) + '" placeholder="Contoh: less sugar">' +
      '<p class="m">' + (S.shop.web_pay === "midtrans" ? "Pembayaran online (QRIS/e-wallet) setelah menekan tombol." : "Bayar di kasir setelah memesan.") + "</p>" +
      (S.err ? '<div class="bad">' + esc(S.err) + "</div>" : "") +
      '<button class="btn" data-a="pay"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Memproses..." : "Pesan sekarang") + '</button><button class="btn g" data-a="v:menu">Kembali ke menu</button>';
  }
  var MSG = { pending: S_pending, paid: "Pembayaran diterima, pesananmu masuk antrian", making: "Pesananmu sedang dibuat", ready: "Pesananmu siap", done: "Selesai, terima kasih", failed: "Pembayaran gagal atau pesanan dibatalkan" };
  function S_pending() { return S.order && S.order.pay === "online" ? "Menunggu pembayaran" : "Menunggu pembayaran di kasir"; }
  function trackV() {
    var o = S.order, i = ["pending", "paid", "making", "ready", "done"].indexOf(o.status);
    var m = o.status === "pending" ? S_pending() : MSG[o.status];
    return "<h3>" + esc(o.no) + "</h3>" + '<p class="m" style="text-align:center">' + esc(tl(o.table || "")) + '</p><div class="box" style="text-align:center"><b>' + esc(m) + "</b></div>" +
      (o.status === "failed" ? "" : '<ol class="st">' + ["Dibayar", "Dibuat", "Siap", "Selesai"].map(function (t, k) { return '<li class="' + (i > k ? "on" : "") + '">' + t + "</li>"; }).join("") + "</ol>") +
      (o.items || []).map(function (l) { return '<div class="r"><span>' + l.q + "× " + esc(l.n) + "</span><b>" + rp(l.q * l.p) + "</b></div>"; }).join("") +
      (o.status === "pending" && o.pay === "online" ? '<button class="btn" data-a="snap">Lanjut bayar</button>' : "") +
      (FIN(o.status) ? '<button class="btn" data-a="new">Pesan lagi</button>' : '<button class="btn g" data-a="v:menu">Tambah pesanan baru</button>');
  }
  function paint() {
    if (!S.shop) return;
    root.style.setProperty("--a", S.shop.accent || "#e9a63b");
    var sy = window.scrollY;
    root.innerHTML = '<div class="kq"><div style="text-align:center"><b style="font-size:1.3rem">' + esc(S.shop.name) + "</b>" +
      (S.shop.address ? '<div class="m">' + esc(S.shop.address) + "</div>" : "") + "</div>" +
      (S.view === "co" ? coV() : S.view === "track" && S.order ? trackV() : menuV()) + "</div>";
    window.scrollTo(0, sy);
  }
  function save() { try { S.order ? localStorage.setItem(LS, JSON.stringify(S.order)) : localStorage.removeItem(LS); } catch (e) {} }

  function loadSnap(url, key) {
    return new Promise(function (ok, no) {
      if (window.snap) return ok();
      var s = document.createElement("script");
      s.src = url; s.setAttribute("data-client-key", key); s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
  }
  function snapPay() {
    var o = S.order;
    fetch(URL_ + "/functions/v1/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify({ order_id: o.id, secret: o.secret }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.token) throw new Error(j.error || "pay");
      return loadSnap(j.snap_url, j.client_key).then(function () {
        window.snap.pay(j.token, { onSuccess: poll, onPending: poll, onClose: poll, onError: poll });
      });
    }).catch(function () { alert("Pembayaran online belum tersedia. Silakan bayar di kasir."); });
  }
  function poll() {
    if (!S.order) return;
    rpc("public_order", { p_id: S.order.id, p_secret: S.order.secret }).then(function (j) {
      if (!j) { S.order = null; save(); S.view = "menu"; return paint(); }
      S.order = Object.assign({}, S.order, j); save();
      if (S.view === "track") paint();
    }).catch(function () {});
  }
  function pay() {
    var ls = lines();
    if (!ls.length || S.busy) return;
    S.busy = true; S.err = ""; paint();
    rpc("public_place_order", {
      p_slug: SLUG, p_code: CODE,
      p_items: ls.map(function (l) { return { id: l.m.id, v: l.k, q: l.q }; }),
      p_name: S.name, p_note: S.note,
    }).then(function (j) {
      S.order = { id: j.id, secret: j.secret, no: j.no, status: "pending", table: S.table, items: [], pay: j.web_pay === "midtrans" ? "online" : "counter" };
      S.cart = {}; S.view = "track"; S.busy = false; save(); paint(); poll();
      if (j.web_pay === "midtrans") snapPay();
    }).catch(function (e) {
      var m = String(e.message || "");
      S.busy = false;
      S.err = /unavailable/.test(m) ? "Ada menu yang habis atau ditutup. Menu sudah diperbarui."
        : /table/.test(m) ? "QR meja tidak dikenali. Scan ulang QR di mejamu."
        : /too_many/.test(m) ? "Terlalu banyak pesanan. Tunggu sebentar."
        : /closed/.test(m) ? "Toko sedang tidak menerima pesanan online."
        : "Gagal membuat pesanan. Coba lagi.";
      if (/unavailable/.test(m)) refresh(true);
      paint();
    });
  }
  function refresh(force) {
    return rpc("public_menu", { p_slug: SLUG }).then(function (j) {
      var sig = JSON.stringify(j);
      if (sig === S.sig && !force) return;
      S.sig = sig; S.shop = j.shop;
      var cl = {}; j.categories.forEach(function (c) { cl[c.name] = c.closed; });
      S.menu = j.menu.map(function (m) { m.closed = !!cl[m.c]; return m; });
      Object.keys(S.cart).forEach(function (key) {
        var p = key.split("|"), m = S.menu.filter(function (x) { return x.id === p[0]; })[0];
        if (!m || dead(m) || (p[1] && !(m.v || []).some(function (z) { return z.k === p[1] && !z.off; }))) delete S.cart[key];
      });
      if (S.view !== "track") paint();
    });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var s = b.dataset.a, i = s.indexOf(":"), a = i < 0 ? s : s.slice(0, i), v = i < 0 ? "" : s.slice(i + 1);
    if (a === "c") S.cat = v;
    else if (a === "p") S.cart[v] = Math.min(20, (S.cart[v] || 0) + 1);
    else if (a === "m") { S.cart[v] > 1 ? S.cart[v]-- : delete S.cart[v]; }
    else if (a === "v") { S.view = v; S.err = ""; }
    else if (a === "pay") return pay();
    else if (a === "snap") return snapPay();
    else if (a === "new") { S.order = null; save(); S.view = "menu"; }
    paint();
  });
  root.addEventListener("input", function (e) {
    if (e.target.id === "kq-n") S.name = e.target.value;
    if (e.target.id === "kq-t") S.note = e.target.value;
  });

  root.innerHTML = '<div class="kq">Memuat menu...</div>';
  var tf = CODE ? rpc("public_table", { p_slug: SLUG, p_code: CODE }).catch(function () { return null; }) : Promise.resolve(null);
  Promise.all([refresh(true), tf]).then(function (r) {
    S.table = r[1] || "";
    if (S.order && !FIN(S.order.status)) { S.view = "track"; poll(); }
    paint();
  }).catch(function () { root.innerHTML = '<div class="kq">Menu tidak bisa dimuat. Coba muat ulang halaman.</div>'; });
  setInterval(function () { refresh(false).catch(function () {}); }, 30000);
  setInterval(function () { if (S.view === "track" && S.order && !FIN(S.order.status)) poll(); }, 4000);
})();
