/* 雲端進度同步（各科共用）
   進度存在雲端資料庫，任何裝置、任何瀏覽器打開同一個網址都接續同一份進度。
   本機 localStorage 只當快取：離線時照常練習，連上網後自動合併上傳。 */
window.CloudSync = (function () {
  const API = "https://lmdxdwkgdiccsgytambx.supabase.co/rest/v1/rpc/";
  const APIKEY = "sb_publishable_Np_R4cgqHCbGWx0f1zlC5g_6v6RZJdj";
  let C = null, rev = 0, dirty = false, timer = null, busy = false, again = false, status = "";
  const mk = s => C.ls + "_" + s;
  const meta = () => { try { localStorage.setItem(mk("rev"), String(rev)); localStorage.setItem(mk("dirty"), dirty ? "1" : "0"); } catch (e) {} };
  const say = s => { if (s !== status) { status = s; try { C.onStatus && C.onStatus(s); } catch (e) {} } };
  async function call(fn, body, keepalive) {
    const r = await fetch(API + fn, { method: "POST", keepalive: !!keepalive, headers: { apikey: APIKEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }
  async function push() {
    for (let i = 0; i < 5; i++) {
      const res = await call("put_progress", { p_k: C.key, p_data: C.get(), p_base: rev });
      if (res && res.ok) { rev = res.rev; dirty = false; meta(); return; }
      // 別台裝置先存了新進度：合併後再存
      if (res && res.data) { C.set(C.merge(C.get(), res.data)); C.onChange && C.onChange(); }
      rev = (res && res.rev) || 0; meta();
    }
    throw new Error("conflict loop");
  }
  async function sync(full) {
    if (!C) return;
    if (busy) { again = true; return; }
    busy = true; say("sync");
    try {
      const cloudRev = await call("get_rev", { p_k: C.key });
      if (cloudRev > rev || (full && cloudRev && cloudRev !== rev)) {
        const res = await call("get_progress", { p_k: C.key });
        if (res && res.data) {
          if (dirty || rev === 0) { C.set(C.merge(C.get(), res.data)); dirty = true; }
          else C.set(res.data);
          rev = res.rev; meta();
          C.onChange && C.onChange();
        }
      }
      if (dirty || cloudRev === 0) await push();
      say("ok");
    } catch (e) { say(navigator.onLine === false ? "offline" : "err"); }
    busy = false;
    if (again) { again = false; setTimeout(() => sync(false), 50); }
  }
  function init(cfg) {
    C = cfg;
    try { rev = +localStorage.getItem(mk("rev")) || 0; dirty = localStorage.getItem(mk("dirty")) === "1"; } catch (e) {}
    sync(true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sync(false);
      else if (dirty) { clearTimeout(timer); flush(); }
    });
    window.addEventListener("online", () => sync(false));
    window.addEventListener("focus", () => sync(false));
    window.addEventListener("pagehide", () => { if (dirty) flush(); });
    setInterval(() => { if (document.visibilityState === "visible") sync(false); }, 45000);
  }
  function flush() {
    // 關閉頁面前盡量送出（keepalive 有 64KB 限制，太大就交給下次開啟時同步）
    try {
      const body = { p_k: C.key, p_data: C.get(), p_base: rev };
      if (JSON.stringify(body).length < 60000) call("put_progress", body, true).then(r => { if (r && r.ok) { rev = r.rev; dirty = false; meta(); } }).catch(() => {});
    } catch (e) {}
  }
  function touch() {
    if (!C) return;
    dirty = true; meta(); say("pending");
    clearTimeout(timer); timer = setTimeout(() => sync(false), 1200);
  }
  return { init, touch, sync, state: () => ({ rev, dirty, status }) };
})();
