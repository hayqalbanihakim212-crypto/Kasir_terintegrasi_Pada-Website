-- =====================================================================
-- Skema Kasir multi-owner (Supabase / Postgres)
-- Jalankan sekali di Supabase > SQL Editor. Aman dijalankan ulang.
-- Prinsip: setiap data punya shop_id; RLS memastikan owner hanya melihat tokonya.
-- Harga SELALU dihitung server dari tabel menu_items, tidak percaya angka dari klien.
-- =====================================================================

-- ---------- Tabel ----------
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  address text,
  phone text,
  accent text not null default '#e9a63b',
  receipt_footer text not null default 'Terima kasih',
  website_url text,
  online_ordering boolean not null default false,
  web_pay text not null default 'counter' check (web_pay in ('counter','midtrans')),
  order_seq int not null default 0,
  created_at timestamptz not null default now()
);

alter table shops add column if not exists order_url text
  check (order_url is null or order_url ~ '^https?://');

alter table shops add column if not exists website_url text;

create table if not exists shop_members (
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user on shop_members(user_id);

create table if not exists shop_secrets (
  shop_id uuid primary key references shops(id) on delete cascade,
  midtrans_server_key text,
  midtrans_client_key text,
  midtrans_env text not null default 'sandbox' check (midtrans_env in ('sandbox','production'))
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  is_food boolean not null default false,
  closed boolean not null default false,
  sort int not null default 0,
  unique (shop_id, name)
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price int not null default 0 check (price between 0 and 1000000),
  -- varian opsional: [{"k":"Panas","p":17000,"off":false}, ...]; null = satu harga
  variants jsonb check (variants is null or jsonb_typeof(variants) = 'array'),
  off boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists menu_items_shop on menu_items(shop_id);

create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  label text not null,
  is_takeaway boolean not null default false,
  code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  unique (shop_id, label)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  no text not null,
  table_label text not null default '',
  name text not null default '',
  note text not null default '',
  items jsonb not null default '[]',
  total int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','paid','making','ready','done','failed')),
  source text not null default 'pos' check (source in ('pos','web')),
  pay_method text not null default 'cash',
  secret text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (shop_id, no)
);
create index if not exists orders_shop_time on orders(shop_id, created_at desc);

-- ---------- Fungsi bantu ----------
create or replace function is_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid())
$$;
create or replace function is_owner(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = p_shop and user_id = auth.uid() and role = 'owner')
$$;

-- ---------- RLS ----------
alter table shops enable row level security;
alter table shop_members enable row level security;
alter table shop_secrets enable row level security;   -- tanpa policy: hanya service role
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table tables enable row level security;
alter table orders enable row level security;

drop policy if exists shops_read on shops;
create policy shops_read on shops for select using (is_member(id));
drop policy if exists shops_update on shops;
create policy shops_update on shops for update using (is_owner(id)) with check (is_owner(id));

drop policy if exists members_read on shop_members;
create policy members_read on shop_members for select using (user_id = auth.uid() or is_owner(shop_id));

drop policy if exists cat_read on categories;
create policy cat_read on categories for select using (is_member(shop_id));
drop policy if exists cat_write on categories;
create policy cat_write on categories for all using (is_owner(shop_id)) with check (is_owner(shop_id));

drop policy if exists item_read on menu_items;
create policy item_read on menu_items for select using (is_member(shop_id));
drop policy if exists item_write on menu_items;
create policy item_write on menu_items for all using (is_owner(shop_id)) with check (is_owner(shop_id));

drop policy if exists tab_read on tables;
create policy tab_read on tables for select using (is_member(shop_id));
drop policy if exists tab_write on tables;
create policy tab_write on tables for all using (is_owner(shop_id)) with check (is_owner(shop_id));

drop policy if exists ord_read on orders;
create policy ord_read on orders for select using (is_member(shop_id));
-- orders hanya ditulis lewat fungsi di bawah (tidak ada policy insert/update)

-- ---------- Internal: hitung item dan total dari harga server ----------
create or replace function _build_items(p_shop uuid, p_items jsonb, out o_items jsonb, out o_total int)
language plpgsql security definer set search_path = public as $$
declare
  r record; m record; vv jsonb; price int; nm text; tot int := 0; arr jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 60 then
    raise exception 'empty';
  end if;
  for r in select * from jsonb_to_recordset(p_items) as x(id uuid, v text, q int) loop
    if r.q is null or r.q < 1 or r.q > 99 then raise exception 'empty'; end if;
    select mi.name, mi.price, mi.variants, mi.off, c.closed as cclosed, mi.id
      into m
      from menu_items mi join categories c on c.id = mi.category_id
     where mi.id = r.id and mi.shop_id = p_shop;
    if not found or m.off or m.cclosed then raise exception 'unavailable'; end if;
    if m.variants is not null then
      select value into vv from jsonb_array_elements(m.variants) where value->>'k' = r.v limit 1;
      if vv is null or coalesce((vv->>'off')::boolean, false) then raise exception 'unavailable'; end if;
      price := (vv->>'p')::int;
      nm := m.name || ' (' || r.v || ')';
    else
      if m.price <= 0 then raise exception 'unavailable'; end if;
      price := m.price; nm := m.name;
    end if;
    tot := tot + price * r.q;
    arr := arr || jsonb_build_object('id', m.id, 'n', nm, 'v', r.v, 'q', r.q, 'p', price);
  end loop;
  o_items := arr; o_total := tot;
end $$;

create or replace function _next_no(p_shop uuid) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update shops set order_seq = order_seq + 1 where id = p_shop returning order_seq into n;
  return 'T' || lpad(n::text, 4, '0');
end $$;

-- Buang karakter kontrol (termasuk perintah ESC/POS yang bisa menyusup lewat nama pelanggan) dan rapikan spasi
create or replace function _clean(t text, n int) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[\x01-\x1f\x7f]', ' ', 'g'), '\s+', ' ', 'g')), n)
$$;

revoke all on function _clean(text, int) from public, anon, authenticated;
revoke all on function _build_items(uuid, jsonb) from public, anon, authenticated;
revoke all on function _next_no(uuid) from public, anon, authenticated;

-- ---------- Toko ----------
create or replace function create_shop(p_name text, p_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s shops;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if (select count(*) from shop_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'too_many_shops';
  end if;
  insert into shops (name, slug) values (trim(p_name), lower(trim(p_slug))) returning * into s;
  insert into shop_members (shop_id, user_id, role) values (s.id, auth.uid(), 'owner');
  insert into shop_secrets (shop_id) values (s.id);
  insert into tables (shop_id, label, is_takeaway) values (s.id, 'Bawa pulang', true);
  return to_jsonb(s);
exception when unique_violation then raise exception 'slug_taken';
end $$;

create or replace function add_staff(p_shop uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not is_owner(p_shop) then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'user_not_found'; end if;
  insert into shop_members (shop_id, user_id, role) values (p_shop, uid, 'staff')
  on conflict do nothing;
end $$;

create or replace function remove_staff(p_shop uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_shop) then raise exception 'forbidden'; end if;
  delete from shop_members where shop_id = p_shop and user_id = p_user and role = 'staff';
end $$;

create or replace function list_members(p_shop uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_shop) then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'role', m.role, 'email', u.email) order by m.created_at)
                   from shop_members m join auth.users u on u.id = m.user_id where m.shop_id = p_shop), '[]');
end $$;

create or replace function set_midtrans(p_shop uuid, p_server text, p_client text, p_env text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_shop) then raise exception 'forbidden'; end if;
  insert into shop_secrets (shop_id, midtrans_server_key, midtrans_client_key, midtrans_env)
  values (p_shop, nullif(trim(p_server), ''), nullif(trim(p_client), ''), p_env)
  on conflict (shop_id) do update
    set midtrans_server_key = excluded.midtrans_server_key,
        midtrans_client_key = excluded.midtrans_client_key,
        midtrans_env = excluded.midtrans_env;
end $$;

create or replace function midtrans_configured(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_member(p_shop) and exists (
    select 1 from shop_secrets where shop_id = p_shop and midtrans_server_key is not null)
$$;

-- ---------- Stok ----------
create or replace function set_stock(p_item uuid, p_variant text, p_off boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m menu_items;
begin
  select * into m from menu_items where id = p_item;
  if not found or not is_member(m.shop_id) then raise exception 'forbidden'; end if;
  if m.variants is null then
    update menu_items set off = p_off where id = p_item;
  elsif p_variant is null then
    -- tombol di tingkat menu berlaku untuk semua varian (sama seperti backend lama)
    update menu_items set off = p_off,
      variants = (select jsonb_agg(e || jsonb_build_object('off', p_off)) from jsonb_array_elements(variants) e)
    where id = p_item;
  else
    update menu_items set
      variants = (select jsonb_agg(case when e->>'k' = p_variant then e || jsonb_build_object('off', p_off) else e end)
                  from jsonb_array_elements(variants) e)
    where id = p_item;
    update menu_items set off = not exists (
      select 1 from jsonb_array_elements(variants) e where not coalesce((e->>'off')::boolean, false))
    where id = p_item;
  end if;
end $$;

create or replace function set_category_closed(p_cats uuid[], p_closed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update categories set closed = p_closed
   where id = any(p_cats) and is_member(shop_id);
end $$;

-- ---------- Pesanan (kasir / staf) ----------
create or replace function place_order(
  p_shop uuid, p_items jsonb, p_name text, p_note text, p_table text, p_pay text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b record; o orders; paid boolean := p_pay in ('cash','qris','transfer');
begin
  if not is_member(p_shop) then raise exception 'forbidden'; end if;
  select * into b from _build_items(p_shop, p_items);
  insert into orders (shop_id, no, table_label, name, note, items, total, status, source, pay_method, paid_at)
  values (p_shop, _next_no(p_shop), coalesce(nullif(trim(p_table), ''), 'Bawa pulang'),
          _clean(p_name, 30), _clean(p_note, 60),
          b.o_items, b.o_total,
          case when paid then 'paid' else 'pending' end, 'pos', p_pay,
          case when paid then now() end)
  returning * into o;
  return to_jsonb(o) - 'secret';
end $$;

create or replace function set_order_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_id;
  if not found or not is_member(o.shop_id) then raise exception 'forbidden'; end if;
  if not (
    (o.status = 'pending' and p_status in ('paid','failed')) or
    (o.status = 'paid'    and p_status = 'making') or
    (o.status = 'making'  and p_status = 'ready') or
    (o.status = 'ready'   and p_status = 'done')
  ) then raise exception 'bad_transition'; end if;
  update orders set status = p_status,
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         pay_method = case when p_status = 'paid' and o.pay_method = 'online' then 'cash' else pay_method end
   where id = p_id;
end $$;

-- ---------- API publik untuk website toko (anon) ----------
create or replace function public_menu(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  select * into s from shops where slug = lower(p_slug);
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'shop', jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone,
            'accent', s.accent, 'online', s.online_ordering, 'web_pay', s.web_pay),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'closed', c.closed) order by c.sort, c.name)
                            from categories c where c.shop_id = s.id), '[]'),
    'menu', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'c', c.name, 'n', i.name, 'p', i.price,
                            'v', i.variants, 'off', i.off) order by c.sort, c.name, i.sort, i.name)
                      from menu_items i join categories c on c.id = i.category_id where i.shop_id = s.id), '[]'));
end $$;

create or replace function public_table(p_slug text, p_code text) returns text
language sql stable security definer set search_path = public as $$
  select t.label from tables t join shops s on s.id = t.shop_id
   where s.slug = lower(p_slug) and t.code = upper(p_code)
$$;

create or replace function public_place_order(
  p_slug text, p_code text, p_items jsonb, p_name text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s shops; lbl text; b record; o orders;
begin
  select * into s from shops where slug = lower(p_slug);
  if not found or not s.online_ordering then raise exception 'closed'; end if;
  select t.label into lbl from tables t where t.shop_id = s.id and t.code = upper(p_code);
  if lbl is null then raise exception 'table'; end if;
  if (select count(*) from orders where shop_id = s.id and source = 'web' and status = 'pending'
        and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'too_many';
  end if;
  select * into b from _build_items(s.id, p_items);
  insert into orders (shop_id, no, table_label, name, note, items, total, status, source, pay_method)
  values (s.id, _next_no(s.id), lbl, coalesce(nullif(_clean(p_name, 30), ''), 'Tamu'), _clean(p_note, 60),
          b.o_items, b.o_total, 'pending', 'web',
          case when s.web_pay = 'midtrans' then 'online' else 'counter' end)
  returning * into o;
  return jsonb_build_object('id', o.id, 'no', o.no, 'secret', o.secret, 'total', o.total,
                            'web_pay', s.web_pay);
end $$;

create or replace function public_order(p_id uuid, p_secret text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('no', o.no, 'status', o.status, 'table', o.table_label,
                            'name', o.name, 'items', o.items, 'total', o.total, 'pay', o.pay_method)
    from orders o where o.id = p_id and o.secret = p_secret
$$;

-- ---------- Hak akses fungsi ----------
revoke all on function create_shop(text, text), add_staff(uuid, text), remove_staff(uuid, uuid),
  list_members(uuid), set_midtrans(uuid, text, text, text), midtrans_configured(uuid),
  set_stock(uuid, text, boolean), set_category_closed(uuid[], boolean),
  place_order(uuid, jsonb, text, text, text, text), set_order_status(uuid, text),
  public_menu(text), public_table(text, text),
  public_place_order(text, text, jsonb, text, text), public_order(uuid, text)
  from public, anon, authenticated;

grant execute on function create_shop(text, text), add_staff(uuid, text), remove_staff(uuid, uuid),
  list_members(uuid), set_midtrans(uuid, text, text, text), midtrans_configured(uuid),
  set_stock(uuid, text, boolean), set_category_closed(uuid[], boolean),
  place_order(uuid, jsonb, text, text, text, text), set_order_status(uuid, text)
  to authenticated;

grant execute on function public_menu(text), public_table(text, text),
  public_place_order(text, text, jsonb, text, text), public_order(uuid, text)
  to anon, authenticated;

grant execute on function is_member(uuid), is_owner(uuid) to authenticated;

-- ---------- Realtime (antrian dan menu langsung berubah di semua perangkat) ----------
do $$ begin
  begin alter publication supabase_realtime add table orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table menu_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table categories; exception when duplicate_object then null; end;
end $$;
