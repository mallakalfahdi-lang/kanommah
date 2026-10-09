import { useCallback, useEffect, useRef, useState } from 'react';

/** تحميل بيانات غير متزامنة مع إمكانية إعادة التحميل */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e.message || 'تعذّر تحميل البيانات.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (d) => setState({ data: d, loading: false, error: null }) };
}

/** حفظ قيمة في localStorage كمفضّلات خفيفة */
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch (e) { return initial; }
  });
  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }, [key]);
  return [value, set];
}
