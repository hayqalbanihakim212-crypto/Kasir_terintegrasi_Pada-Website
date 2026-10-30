-- Seed menu Qahwa (sesuai gambar menu terbaru).
-- Ganti 'qahwa' dengan slug tokomu, lalu jalankan di Supabase > SQL Editor.
-- PERHATIAN: skrip ini MENGHAPUS semua kategori + item menu toko itu lalu mengisi ulang,
-- jadi aman dijalankan berulang (tidak dobel). Riwayat pesanan tidak terhapus.

create or replace function pg_temp.seed_cat(sid uuid, cname text, food boolean, srt int, items jsonb)
returns void language plpgsql as $$
declare cid uuid; e jsonb; i int := 0; v jsonb;
begin
  insert into categories (shop_id, name, is_food, sort) values (sid, cname, food, srt) returning id into cid;
  for e in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(e->1) = 'array' then
      -- varian: [["Panas",17000],["Dingin",20000]]; harga dasar = varian pertama
      select jsonb_agg(jsonb_build_object('k', x->>0, 'p', (x->>1)::int) order by ord)
        into v from jsonb_array_elements(e->1) with ordinality as t(x, ord);
      insert into menu_items (shop_id, category_id, name, price, variants, sort)
      values (sid, cid, e->>0, (e->1->0->>1)::int, v, i);
    else
      insert into menu_items (shop_id, category_id, name, price, variants, sort)
      values (sid, cid, e->>0, (e->>1)::int, null, i);
    end if;
    i := i + 1;
  end loop;
end $$;

do $$
declare sid uuid;
begin
  select id into sid from shops where slug = 'qahwa';
  if sid is null then raise exception 'toko dengan slug itu belum ada'; end if;

  delete from categories where shop_id = sid;  -- menu_items ikut terhapus (cascade)

  -- ===== Minuman =====
  perform pg_temp.seed_cat(sid, 'Best Seller', false, 0, '[
    ["Sanger Aren Qahwa", 23000],
    ["Sanger Creamy Qahwa", 20000],
    ["Sanger Panas", 17000],
    ["Sanger Dingin", 20000]]');

  perform pg_temp.seed_cat(sid, 'Espresso', false, 1, '[
    ["Americano", [["Panas",17000],["Dingin",20000]]],
    ["Single Espresso", 15000],
    ["Double Espresso", 17000],
    ["Mocha Espresso", [["Panas",20000],["Dingin",22000]]],
    ["Longblack", [["Panas",17000],["Dingin",20000]]],
    ["Coffee Lemon", [["Panas",17000],["Dingin",20000]]],
    ["Coffee Latte", [["Panas",20000],["Dingin",22000]]],
    ["Ice Coffee", 20000]]');

  perform pg_temp.seed_cat(sid, 'Juice', false, 2, '[
    ["Pokat", 18000], ["Terong Belanda", 18000], ["Markisa", 18000],
    ["Martabe", 22000], ["Sister", 22000], ["Jeruk", 18000],
    ["Sirsak", 18000], ["Kuini", 18000], ["Avocado Cheese", 22000]]');

  perform pg_temp.seed_cat(sid, 'Soft Drink Based', false, 3, '[
    ["Teh", [["Panas",6000],["Dingin",8000]]],
    ["Teh Tarik", [["Panas",15000],["Dingin",17000]]],
    ["Teh Susu", [["Panas",15000],["Dingin",17000]]],
    ["Teh Susu Telur", [["Panas",16000],["Dingin",18000]]],
    ["Lemontea", [["Panas",15000],["Dingin",18000]]],
    ["Lemontea Jahe", [["Panas",17000],["Dingin",20000]]],
    ["Greentea", [["Panas",12000],["Dingin",15000]]],
    ["Greentea Lemon", [["Panas",14000],["Dingin",17000]]],
    ["Greentea Susu", [["Panas",18000],["Dingin",15000]]],
    ["Susu", [["Panas",10000],["Dingin",13000]]],
    ["Milo", [["Panas",13000],["Dingin",15000]]],
    ["Milo Cincau", 16000],
    ["Cappucino Cincau", 16000],
    ["Cappucino", [["Panas",13000],["Dingin",16000]]],
    ["Coklat", [["Panas",13000],["Dingin",16000]]],
    ["Cincau Ice", 13000],
    ["Puding", 15000]]');

  perform pg_temp.seed_cat(sid, 'Latte or Float', false, 4, '[
    ["Cappucino", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Mocha", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Red Velvet", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Taro", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Vanilla", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Hazelnut", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Tiramisu", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Mango", [["Panas",20000],["Dingin",23000],["Float",26000]]],
    ["Matcha", [["Panas",20000],["Dingin",23000],["Float",26000]]]]');

  perform pg_temp.seed_cat(sid, 'Other Menu', false, 5, '[
    ["Teh Ginger", [["Panas",13000],["Dingin",15000]]],
    ["Ginger Qahwa", [["Panas",15000],["Dingin",16000]]],
    ["Affogato Qahwa", 25000],
    ["Avocado Float Espresso", 30000],
    ["Avocado Espresso", 22000],
    ["Infused Water", [["Panas",12000],["Dingin",14000]]],
    ["Ice Calamansi", 14000],
    ["Ice Cream Vanilla", 12000]]');

  perform pg_temp.seed_cat(sid, 'Based Soda', false, 6, '[
    ["Ocean Blue", 20000], ["Blue Mojito", 20000], ["Red Mojito", 20000],
    ["Red Blue", 20000], ["Red Squash", 20000], ["Mojito Squash", 20000],
    ["Melon Squash", 20000], ["Lychee Squash", 20000], ["Lime Squash", 20000],
    ["Manggo Squash", 20000], ["Ice Smoothies Manggo", 20000]]');

  -- ===== Makanan =====
  perform pg_temp.seed_cat(sid, 'Nasi Goreng', true, 7, '[
    ["Nasi Goreng Telur", 16000], ["Nasi Goreng Cumi", 25000], ["Nasi Goreng Udang", 25000],
    ["Nasi Goreng Daging", 25000], ["Nasi Goreng Ayam", 25000],
    ["Nasi Goreng SeaFood", 30000], ["Nasi Goreng Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Nasi Goreng Kampung', true, 8, '[
    ["Nasi Goreng Kampung Telur", 18000], ["Nasi Goreng Kampung Cumi", 27000],
    ["Nasi Goreng Kampung Udang", 27000], ["Nasi Goreng Kampung Daging", 25000],
    ["Nasi Goreng Kampung Ayam", 25000], ["Nasi Goreng Kampung SeaFood", 30000],
    ["Nasi Goreng Kampung Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Nasi Goreng Ijo', true, 9, '[
    ["Nasi Goreng Ijo Telur", 18000], ["Nasi Goreng Ijo Cumi", 27000],
    ["Nasi Goreng Ijo Udang", 27000], ["Nasi Goreng Ijo Daging", 25000],
    ["Nasi Goreng Ijo SeaFood", 30000], ["Nasi Goreng Ijo Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Nasi Goreng Pataya', true, 10, '[
    ["Nasi Goreng Pataya Biasa", 23000], ["Nasi Goreng Pataya Cumi", 28000],
    ["Nasi Goreng Pataya Daging", 28000], ["Nasi Goreng Pataya Seafood", 35000],
    ["Nasi Goreng Pataya Special", 40000]]');

  perform pg_temp.seed_cat(sid, 'Indomie Biasa', true, 11, '[
    ["Indomie Biasa", 15000], ["Indomie Cumi", 22000], ["Indomie Udang", 22000],
    ["Indomie Daging", 28000], ["Indomie SeaFood", 27000], ["Indomie Special", 30000]]');

  perform pg_temp.seed_cat(sid, 'Indomie Banglades', true, 12, '[
    ["Indomie Banglades Biasa", 15000], ["Indomie Banglades Dobel", 20000],
    ["Indomie Banglades Puding", 26000]]');

  perform pg_temp.seed_cat(sid, 'Ifuu Mie', true, 13, '[
    ["Ifuu Mie Biasa", 15000], ["Ifuu Mie Cumi", 22000], ["Ifuu Mie Udang", 22000],
    ["Ifuu Mie Daging", 28000], ["Ifuu Mie SeaFood", 27000], ["Ifuu Mie Special", 30000]]');

  perform pg_temp.seed_cat(sid, 'Bihuun', true, 14, '[
    ["Bihuun Biasa", 15000], ["Bihuun Cumi", 22000], ["Bihuun Udang", 22000],
    ["Bihuun Daging", 28000], ["Bihuun SeaFood", 27000], ["Bihuun Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Mie Aceh', true, 15, '[
    ["Mie Aceh Biasa", 17000], ["Mie Aceh Cumi", 25000], ["Mie Aceh Udang", 25000],
    ["Mie Aceh Daging", 28000], ["Mie Aceh SeaFood", 27000], ["Mie Aceh Special", 30000]]');

  perform pg_temp.seed_cat(sid, 'Kue/Mie Tiaw', true, 16, '[
    ["Kue/Mie Tiaw Biasa", 15000], ["Kue/Mie Tiaw Cumi", 22000], ["Kue/Mie Tiaw Udang", 22000],
    ["Kue/Mie Tiaw Daging", 28000], ["Kue/Mie Tiaw SeaFood", 27000], ["Kue/Mie Tiaw Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Snack', true, 17, '[
    ["Nugget", 18000], ["Sosis", 18000],
    ["Mix Platter (Nugget, Sosis, Kentang)", 20000],
    ["Jamur Crispy", 20000], ["Kentang", 18000], ["Nasi", 6000]]');

  perform pg_temp.seed_cat(sid, 'Chicken Katsu', true, 18, '[
    ["Chicken Katsu Biasa", 20000], ["Chicken Katsu Kari Ayam", 28000],
    ["Chicken Katsu Special", 35000]]');

  perform pg_temp.seed_cat(sid, 'Martabak', true, 19, '[
    ["Martabak Biasa", 15000], ["Martabak Kari Ayam", 20000], ["Martabak Udang", 23000],
    ["Martabak Daging", 23000], ["Martabak Special", 28000]]');

  perform pg_temp.seed_cat(sid, 'Roti Canai', true, 20, '[
    ["Roti Canai Gula", 10000], ["Roti Canai Kari Ayam", 15000], ["Roti Canai Cokelat", 15000],
    ["Roti Canai Keju", 15000], ["Roti Canai Cokelat Keju", 15000]]');

  perform pg_temp.seed_cat(sid, 'Roti Bakar', true, 21, '[
    ["Roti Bakar Coklat", 15000], ["Roti Bakar Keju", 15000], ["Roti Bakar Srikaya", 18000],
    ["Roti Bakar Kacang", 18000], ["Roti Bakar Nanas", 18000], ["Roti Bakar Abon", 15000],
    ["Roti Bakar Dua Rasa", 20000], ["Roti Bakar Tiga Rasa", 25000]]');

  perform pg_temp.seed_cat(sid, 'Burger', true, 22, '[
    ["Burger Biasa", 15000], ["Burger Daging", 18000], ["Burger Sosis", 18000],
    ["Burger Ayam Krispy", 25000], ["Burger Special", 32000]]');

  perform pg_temp.seed_cat(sid, 'Omelet', true, 23, '[
    ["Omelet Biasa", 13000], ["Omelet Keju", 15000], ["Omelet Sosis", 15000],
    ["Omelet Daging", 20000], ["Omelet Abon", 15000],
    ["Omelet Dua Farian", 22000], ["Omelet Tiga Farian", 25000]]');

  perform pg_temp.seed_cat(sid, 'Tom Yum', true, 24, '[
    ["Tom Yum Biasa", 20000], ["Tom Yum Daging", 25000], ["Tom Yum Cumi", 25000],
    ["Tom Yum Udang", 25000], ["Tom Yum Seafood", 30000], ["Tom Yum Special", 35000]]');
end $$;