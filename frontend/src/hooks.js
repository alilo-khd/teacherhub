import { useCallback, useEffect, useRef, useState } from "react";
import { api, listOf } from "./api";
import { useToast } from "./components/Toast";
import { useLang } from "./i18n";

/** CRUD hook with optimistic updates + rollback on failure. */
export function useResource(endpoint) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();
  const { t } = useLang();
  const seq = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(listOf(await api(endpoint)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (payload) => {
    const temp = { ...payload, id: `tmp-${++seq.current}`, _temp: true };
    setItems((xs) => [temp, ...xs]);
    try {
      const saved = await api(endpoint, { method: "POST", body: payload });
      setItems((xs) => xs.map((x) => (x.id === temp.id ? saved : x)));
      toast(t("تمت الإضافة بنجاح"));
      return saved;
    } catch (e) {
      setItems((xs) => xs.filter((x) => x.id !== temp.id));
      toast(e.message, "danger");
      throw e;
    }
  }, [endpoint, toast]);

  const update = useCallback(async (id, payload) => {
    let snapshot;
    setItems((xs) => xs.map((x) => (x.id === id ? (snapshot = x, { ...x, ...payload }) : x)));
    try {
      const saved = await api(`${endpoint}${id}/`, { method: "PATCH", body: payload });
      setItems((xs) => xs.map((x) => (x.id === id ? saved : x)));
      toast(t("تم الحفظ"));
      return saved;
    } catch (e) {
      setItems((xs) => xs.map((x) => (x.id === id ? snapshot : x)));
      toast(e.message, "danger");
      throw e;
    }
  }, [endpoint, toast]);

  const remove = useCallback(async (id) => {
    let snapshot, index;
    setItems((xs) => {
      index = xs.findIndex((x) => x.id === id);
      snapshot = xs[index];
      return xs.filter((x) => x.id !== id);
    });
    try {
      await api(`${endpoint}${id}/`, { method: "DELETE" });
      toast(t("تم الحذف"), "warning");
    } catch (e) {
      setItems((xs) => {
        const copy = [...xs];
        copy.splice(index ?? copy.length, 0, snapshot);
        return copy;
      });
      toast(e.message, "danger");
      throw e;
    }
  }, [endpoint, toast]);

  return { items, setItems, loading, error, load, create, update, remove };
}

export function useThemes(params = "") {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api(`/themes/${params}`)
      .then((d) => live && setThemes(listOf(d)))
      .catch(() => live && setThemes([]))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [params]);
  return { themes, setThemes, loading };
}

/** State persisted in localStorage (filters & view preferences). */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`th-view:${key}`);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      // merge defaults so newly-added filter keys appear for returning users
      return (parsed && initial && typeof parsed === "object" && typeof initial === "object" && !Array.isArray(parsed))
        ? { ...initial, ...parsed } : parsed;
    } catch { return initial; }
  });
  const set = useCallback((v) => {
    setValue((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(`th-view:${key}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);
  return [value, set];
}
