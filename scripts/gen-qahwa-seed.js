// Mengubah _menu.js lama menjadi supabase/seed-qahwa.sql (menu Qahwa untuk dimasukkan ke toko baru).
// Pakai: node scripts/gen-qahwa-seed.js path/ke/_menu.js
const items = require(require("path").resolve(process.argv[2] || "./_menu.js"));
const FOOD = ["Nasi Goreng","Nasi Goreng Kampung","Nasi Goreng Ijo","Nasi Goreng Pataya","Snack","Chicken Katsu","Martabak","Kue/Mie Tiaw","Toom Yum","Roti Canai","Roti Bakar","Burgers"];
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const cats = [...new Set(items.map((m) => m.c))];
let sql = `-- Seed menu Qahwa. Ganti 'qahwa' di bawah dengan slug tokomu lalu jalankan di SQL Editor.\ndo $$\ndeclare sid uuid; cid uuid;\nbegin\n  select id into sid from shops where slug = 'qahwa';\n  if sid is null then raise exception 'toko dengan slug itu belum ada'; end if;\n`;
cats.forEach((c, i) => {
  sql += `  insert into categories (shop_id, name, is_food, sort) values (sid, ${q(c)}, ${FOOD.includes(c)}, ${i}) on conflict (shop_id, name) do nothing;\n`;
  sql += `  select id into cid from categories where shop_id = sid and name = ${q(c)};\n`;
  items.filter((m) => m.c === c).forEach((m, j) => {
    const v = m.v ? q(JSON.stringify(m.v)) + "::jsonb" : "null";
    sql += `  insert into menu_items (shop_id, category_id, name, price, variants, sort) values (sid, cid, ${q(m.n)}, ${m.p}, ${v}, ${j});\n`;
  });
});
sql += "end $$;\n";
require("fs").writeFileSync(__dirname + "/../supabase/seed-qahwa.sql", sql);
console.log(items.length + " menu, " + cats.length + " kategori -> supabase/seed-qahwa.sql");
