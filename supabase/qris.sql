-- Jalankan sekali di Supabase > SQL Editor.
-- Menyimpan teks QRIS statis toko. Hanya anggota toko yang bisa membacanya (policy shops_read),
-- dan hanya pemilik yang bisa mengubahnya (policy shops_update). Tidak ikut ke API publik website.
alter table shops add column if not exists qris_payload text;
