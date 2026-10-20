// Satu sumber data untuk seluruh aplikasi: sesi login, daftar toko milik/akses pengguna,
// toko yang sedang aktif, serta menu / meja / pesanan toko itu (diperbarui realtime).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, configured } from "../lib/supabase";
import { ORDER_COLS } from "../lib/data";
import { startOf } from "../lib/format";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
const SEL = "kasir_shop_id";

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = belum tahu
  const [memberships, setMemberships] = useState(null); // [{ role, shop }]
  const [shopId, setShopIdState] = useState(null);
  const [data, setData] = useState({ categories: [], items: [], tables: [], orders: [] });
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const alive = useRef(true);

  /* ---- sesi ---- */
  useEffect(() => {
    alive.current = true;
    if (!configured) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data: d }) => alive.current && setSession(d.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => {
      alive.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ---- daftar toko ---- */
  const loadShops = useCallback(async () => {
    if (!session) return;
    const { data: rows, error } = await supabase
      .from("shop_members")
      .select("role, shop:shops(*)")
      .eq("user_id", session.user.id);
    if (error) return setOnline(false);
    setOnline(true);
    const list = (rows || []).filter((r) => r.shop).map((r) => ({ role: r.role, shop: r.shop }));
    setMemberships(list);
    const saved = await AsyncStorage.getItem(SEL).catch(() => null);
    setShopIdState((cur) => {
      const want = cur || saved;
      return list.some((m) => m.shop.id === want) ? want : list[0] ? list[0].shop.id : null;
    });
  }, [session]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setMemberships(null);
      setShopIdState(null);
      setLoaded(false);
      return;
    }
    loadShops();
  }, [session, loadShops]);

  const setShopId = (id) => {
    setLoaded(false);
    setShopIdState(id);
    AsyncStorage.setItem(SEL, id).catch(() => {});
  };

  const current = useMemo(
    () => (memberships || []).find((m) => m.shop.id === shopId) || null,
    [memberships, shopId],
  );

  /* ---- data toko aktif ---- */
  const load = useCallback(async () => {
    if (!shopId) return;
    const since = new Date(startOf(Date.now())).toISOString();
    const [c, i, t, o] = await Promise.all([
      supabase.from("categories").select("*").eq("shop_id", shopId).order("sort").order("name"),
      supabase.from("menu_items").select("*").eq("shop_id", shopId).order("sort").order("name"),
      supabase.from("tables").select("*").eq("shop_id", shopId),
      supabase
        .from("orders")
        .select(ORDER_COLS)
        .eq("shop_id", shopId)
        .or(`created_at.gte.${since},status.in.(pending,paid,making,ready)`)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (c.error || i.error || t.error || o.error) return setOnline(false);
    setOnline(true);
    const tables = (t.data || []).sort((a, b) => {
      if (a.is_takeaway !== b.is_takeaway) return a.is_takeaway ? 1 : -1;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
    setData({ categories: c.data, items: i.data, tables, orders: o.data });
    setLoaded(true);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    load();
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const f = `shop_id=eq.${shopId}`;
    const ch = supabase
      .channel("shop-" + shopId)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: f }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: f }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: f }, soon)
      .subscribe();
    const poll = setInterval(load, 20000); // cadangan kalau realtime terputus
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [shopId, load]);

  const value = useMemo(
    () => ({
      configured,
      session,
      ready: session !== undefined && (!session || memberships !== null),
      memberships: memberships || [],
      shop: current ? current.shop : null,
      role: current ? current.role : null,
      isOwner: !!current && current.role === "owner",
      setShopId,
      reloadShops: loadShops,
      reload: load,
      online,
      loaded,
      ...data,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, memberships, current, data, loaded, online, loadShops, load],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Menu siap pakai: gabungan item + nama kategori + status tutup. */
export function useMenu() {
  const { items, categories } = useApp();
  return useMemo(() => {
    const cat = new Map(categories.map((c) => [c.id, c]));
    return items
      .map((m) => {
        const c = cat.get(m.category_id);
        return c ? { id: m.id, n: m.name, p: m.price, v: m.variants, off: m.off, c: c.name, closed: c.closed, cid: c.id } : null;
      })
      .filter(Boolean);
  }, [items, categories]);
}
