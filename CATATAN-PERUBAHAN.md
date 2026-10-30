# Perubahan: Kasir Kafe Kopi Senja (sesuai PDF "4 aplikasi dan dasbor Pusat")

Cara memasang
1. Salin isi zip ini ke proyek Anda (timpa file yang sama). File `.env` sudah berisi URL dan kunci Supabase.
2. `npm install` (atau `npx expo install` bila diminta), lalu `npx expo start -c`.
3. Supabase > SQL Editor, jalankan berurutan (yang sudah pernah jalan boleh dilewati):
   `supabase/qris.sql` lalu `supabase/kopi-senja.sql` (kolom keterangan menu + metode Kartu debit).

Supabase
- URL: https://yzuzqyfptelkuahrxeta.supabase.co, kunci publishable sudah dipasang di `.env`, di
  `src/lib/supabase.js` (cadangan bila .env kosong), dan di `eas.json` (build APK preview).
- Jangan pernah menaruh secret key (sb_secret_...) di aplikasi.

Tampilan baru
- app/(tabs)/kasir.js: judul nama kafe + ringkasan antrean, pil kategori, kartu menu (nama serif, keterangan, harga),
  slip "Pesanan N" dengan cap BARU, tombol Nama / Meja / Catatan, total, tombol merah "Bayar dan cetak struk".
- Layar "Bayar" baru: Tunai (uang pas, kembalian), QRIS (kode nominal, hitung mundur 05:00, status langkah,
  "Buat ulang kode"), Kartu debit, "Ganti metode", "Batalkan". QRIS mati bila koneksi putus.
- Menu: kolom "Keterangan singkat" di form ubah menu (tampil di kartu).

Yang belum
- Chip "+ Oat milk 5rb" (tambahan berharga) butuh data add-on baru di database.
- QRIS masih dikonfirmasi kasir; otomatis perlu Midtrans/Xendit (fungsi server sudah ada di supabase/functions).
- Belum dijalankan di perangkat, hanya cek sintaks (26 file OK).
