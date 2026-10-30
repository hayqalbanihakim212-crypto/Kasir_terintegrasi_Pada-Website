import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Kunci "publishable" memang aman ditaruh di aplikasi (akses dibatasi policy RLS di database).
// Nilai .env dipakai lebih dulu; kalau kosong, pakai proyek Supabase di bawah ini.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://yzuzqyfptelkuahrxeta.supabase.co";
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_gWLPn38x-EVvixRq-FMVpQ_yz2N4z0j";
export const configured = !!SUPABASE_URL && !!KEY;

export const supabase = createClient(
  SUPABASE_URL || "https://belum-diatur.invalid",
  KEY || "belum-diatur",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Token disegarkan hanya saat aplikasi terlihat (hemat baterai)
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Pesan galat RPC (raise exception 'kode') -> kalimat untuk pengguna
const MSG = {
  empty: "Keranjang kosong atau jumlah tidak valid.",
  unavailable: "Ada menu yang habis atau kategorinya ditutup.",
  forbidden: "Kamu tidak punya izin untuk ini.",
  slug_taken: "Alamat toko itu sudah dipakai. Coba yang lain.",
  too_many_shops: "Batas 5 toko per akun tercapai.",
  user_not_found: "Email itu belum terdaftar. Minta staf mendaftar dulu di aplikasi.",
  bad_transition: "Status pesanan sudah berubah. Data dimuat ulang.",
  "Invalid login credentials": "Email atau password salah.",
  "User already registered": "Email sudah terdaftar. Silakan masuk.",
};
export const errMsg = (e) => {
  const m = String((e && (e.message || e.error_description)) || e || "");
  for (const k of Object.keys(MSG)) if (m.includes(k)) return MSG[k];
  if (/network|fetch/i.test(m)) return "Tidak ada koneksi internet.";
  if (/shops_slug_check|slug/.test(m)) return "Alamat toko hanya huruf kecil, angka, dan tanda minus (3-40 karakter).";
  return m.slice(0, 140) || "Terjadi kesalahan.";
};
