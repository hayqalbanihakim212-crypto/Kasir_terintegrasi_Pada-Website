-- Jalankan sekali di Supabase > SQL Editor (setelah schema.sql dan qris.sql).
-- 1) Keterangan singkat menu (tampil di kartu menu kasir)
alter table menu_items add column if not exists descr text check (descr is null or char_length(descr) <= 80);

-- 2) Metode bayar "Kartu debit" (sebelumnya hanya cash, qris, transfer)
create or replace function place_order(
  p_shop uuid, p_items jsonb, p_name text, p_note text, p_table text, p_pay text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b record; o orders; paid boolean := p_pay in ('cash','qris','transfer','debit');
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
