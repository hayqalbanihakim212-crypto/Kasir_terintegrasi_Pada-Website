# Kasir Terintegrasi Website

Aplikasi kasir untuk kafe dan restoran kecil. Satu kode berjalan di Android, iPhone, tablet, dan web.
Pesanan dari kasir dan dari website toko masuk ke satu antrean secara realtime.

> Hak cipta dilindungi. Kode ini tidak boleh dipakai, disalin, atau disebarkan tanpa izin tertulis. Lihat [LICENSE](LICENSE).

## Fitur

- **Kasir**: pilih menu dan varian, bayar tunai (hitung kembalian), QRIS, transfer, atau simpan sebagai belum dibayar, lalu cetak struk.
- **QRIS dengan nominal otomatis**: pemilik menyimpan teks QRIS statis toko. Aplikasi mengisi nominal di perangkat, tanpa internet. Kasir tetap yang mengonfirmasi uang masuk.
- **Antrean pesanan**: status menunggu bayar, dibayar, dibuat, siap, selesai. Pesanan baru membuat perangkat bergetar. Diperbarui realtime.
- **Menu dan stok**: kategori, varian harga (misalnya panas dan dingin), tandai habis, tutup kategori.
- **Meja dan QR**: cetak QR per meja. Pelanggan memindai lalu memesan lewat website toko.
- **Laporan** (pemilik): omzet, jumlah item, grafik, ekspor PDF.
- **Staf dan peran**: pemilik dan staf, satu akun bisa punya banyak toko.
- **Printer struk**: thermal Bluetooth LE (ESC/POS), lebar 58 mm.
- **Widget website**: `web/kasir-embed.js` menampilkan menu dan form pesan di website toko, tanpa dependensi.
- **Pembayaran online untuk website**: Midtrans (QRIS, GoPay, ShopeePay), tiap toko memakai akun Midtrans sendiri.

## Teknologi

| Bagian | Yang dipakai |
|---|---|
| Aplikasi | Expo SDK 58, React Native 0.88, React 19, Expo Router |
| Platform | Android, iOS, web (react-native-web) |
| Data dan login | Supabase: Auth, Postgres dengan Row Level Security, Realtime, fungsi RPC |
| Server | Supabase Edge Functions (Deno): `create-payment`, `midtrans-webhook`, `sync-order` |
| Pembayaran | Midtrans Snap (pesanan website), QRIS statis (kasir) |
| Printer | react-native-ble-plx, perintah ESC/POS |
| Lain-lain | expo-print dan expo-sharing (PDF), react-native-qrcode-svg, AsyncStorage, expo-haptics |
| Tampilan | StyleSheet React Native dengan komponen sendiri di `src/ui.js`. Font Young Serif dan Figtree |

## Struktur folder

```
app/            layar dan rute (Expo Router)
  (tabs)/       Antrean, Kasir, Menu, Laporan, Lainnya
src/
  ui.js         warna, font, komponen dasar
  state/        sesi, toko aktif, data realtime
  lib/          supabase, format, qris, struk ESC/POS, printer
supabase/
  schema.sql    tabel, aturan akses, fungsi
  qris.sql      kolom teks QRIS toko
  functions/    Edge Functions
web/            widget untuk website toko
scripts/        pengecekan sintaks dan skrip seed menu
```

## Menjalankan

Syarat: Node.js 20 atau lebih baru dan akun Supabase.

```bash
npm install
npx expo install expo-font @expo-google-fonts/figtree @expo-google-fonts/young-serif
cp .env.example .env     # lalu isi URL dan kunci publishable dari Supabase
npx expo start --web     # atau: npx expo start
```

Printer Bluetooth butuh development build, bukan Expo Go: `npx expo run:android` atau `eas build --profile development`.

## Menyiapkan Supabase

1. Buat proyek di Supabase.
2. Di SQL Editor, jalankan `supabase/schema.sql`, lalu `supabase/qris.sql`.
3. Isi `.env` dengan URL proyek dan kunci publishable (Project Settings, API).
4. Untuk pembayaran online website, deploy fungsi di `supabase/functions/` dan isi kunci Midtrans dari menu Lainnya, Pembayaran online.

## Membuat APK

Isi variabel lingkungan di EAS, jangan di `eas.json`:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://PROJECT-REF.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_... --visibility plaintext
npm run apk
```

## Keamanan

- Aplikasi hanya memakai kunci publishable. Kunci `service_role` dan kunci server Midtrans tidak pernah masuk ke aplikasi atau repositori.
- Akses data diatur Row Level Security: anggota toko hanya melihat toko mereka, dan perubahan pesanan lewat fungsi server.
- File `.env` tidak boleh di-commit.

## Belum ada

Mode offline penuh, konfirmasi QRIS otomatis, stok bahan baku, dan tata letak khusus HP untuk beberapa layar.

## Lisensi

Seluruh hak dilindungi. Lihat [LICENSE](LICENSE).
