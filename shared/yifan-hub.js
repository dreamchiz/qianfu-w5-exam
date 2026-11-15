/* 意帆複習：全站導覽列＋全站學習記錄（各科頁面共用）
   - 每一科頁面最上方插入：🏠 總入口｜科目切換｜今天各科合計時間
   - 記錄每天每一科實際使用的分鐘數，存在雲端（任何裝置都看得到）
   - 總入口也用這支檔案讀取各科雲端進度 */
window.YF = (function () {
  const API = "https://lmdxdwkgdiccsgytambx.supabase.co/rest/v1/rpc/";
  const APIKEY = "sb_publishable_Np_R4cgqHCbGWx0f1zlC5g_6v6RZJdj";
  const HUB_KEY = "yifan-hub-log-Qm7tR2xW9kLp4vZ8nB3c";
  const HUB_LS = "yf_hub_v1";
  const EXAM = { name: "第二次段考", start: "2026-12-01", end: "2026-12-02", text: "12/1（二）～12/2（三）" };
  const BASE = "/qianfu-w5-exam/";
  const SUBJECTS = [
    { id: "chi", name: "國文", icon: "文", path: "yifan-chinese/", ls: "yf_chi_v2", key: "yifan-chinese-Tz4pW8qLx2Nf6Rk9Vb3m", min: 45, ready: 1,
      scope: "第 4 課 論語選、第 5 課 背影、第 6 課 心囚、語文常識（二）閱讀導航",
      units: [["L4", "第 4 課 論語選"], ["L5", "第 5 課 背影"], ["L6", "第 6 課 心囚"], ["Y2", "語文常識（二）閱讀導航"], ["MK", "段考模擬考"]], mock: "MK" },
    { id: "sci", name: "自然", icon: "自", path: "yifan-science/", ls: "yf_sci_v2", key: "yifan-science-L5u8vJ6NqlqBwfEfrXSLd-41", min: 60, ready: 1, weak: 1,
      scope: "第 3 章 3-4 人體如何獲得養分、第 4 章 運輸作用（4-1～4-3）",
      units: [["3-4", "3-4 人體如何獲得養分"], ["4", "第 4 章 運輸作用"]] },
    { id: "geo", name: "地理", icon: "地", weak: 1, min: 60 },
    { id: "math", name: "數學", icon: "數", min: 35 },
    { id: "his", name: "歷史", icon: "史", min: 15 },
    { id: "civ", name: "公民", icon: "公", min: 10 },
    { id: "eng", name: "英文", icon: "英", min: 15 }
  ];
  const dkey = d => { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  async function call(fn, body, keepalive) {
    const r = await fetch(API + fn, { method: "POST", keepalive: !!keepalive, headers: { apikey: APIKEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("http " + r.status);
    return r.json();
  }
  async function getCloud(key) { const r = await call("get_progress", { p_k: key }); return r && r.data ? r : null; }

  /* ---------- 全站記錄（每天每科分鐘） ---------- */
  let H = null, hubRev = 0, hubDirty = false, hubBusy = false;
  function loadHub() {
    try { const o = JSON.parse(localStorage.getItem(HUB_LS)); if (o && o.days) { H = o.h; hubRev = o.rev || 0; hubDirty = !!o.dirty; } } catch (e) {}
    if (!H || !H.days) H = { v: 1, days: {} };
  }
  function saveHub() { try { localStorage.setItem(HUB_LS, JSON.stringify({ h: H, rev: hubRev, dirty: hubDirty, days: 1 })); } catch (e) {} }
  function mergeHub(a, b) {
    const m = { v: 1, days: {} };
    [a, b].forEach(x => { if (!x || !x.days) return; for (const d in x.days) { m.days[d] = m.days[d] || {}; for (const s in x.days[d]) m.days[d][s] = Math.max(m.days[d][s] || 0, x.days[d][s] || 0); } });
    return m;
  }
  async function syncHub() {
    if (hubBusy) return; hubBusy = true;
    try {
      const cr = await call("get_rev", { p_k: HUB_KEY });
      if (cr > hubRev) { const r = await call("get_progress", { p_k: HUB_KEY }); if (r && r.data) { H = mergeHub(H, r.data); hubRev = r.rev; if (JSON.stringify(H) !== JSON.stringify(r.data)) hubDirty = true; saveHub(); } }
      for (let i = 0; hubDirty && i < 4; i++) {
        const r = await call("put_progress", { p_k: HUB_KEY, p_data: H, p_base: hubRev });
        if (r && r.ok) { hubRev = r.rev; hubDirty = false; }
        else { if (r && r.data) H = mergeHub(H, r.data); hubRev = (r && r.rev) || 0; }
        saveHub();
      }
    } catch (e) {}
    hubBusy = false;
  }
  function addSeconds(sub, s) {
    const d = dkey(); H.days[d] = H.days[d] || {}; H.days[d][sub] = (H.days[d][sub] || 0) + s; hubDirty = true; saveHub();
  }
  const minutes = (d, sub) => Math.floor(((H.days[d] || {})[sub] || 0) / 60);
  const todayTotal = () => Math.floor(Object.values(H.days[dkey()] || {}).reduce((a, b) => a + b, 0) / 60);

  /* ---------- 科目頁：導覽列＋計時 ---------- */
  function mountBar(subId) {
    const me = SUBJECTS.find(s => s.id === subId);
    const css = document.createElement("style");
    css.textContent = `.yfbar{display:flex;align-items:center;gap:8px;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top,0px));background:var(--sheet,#fff);border-bottom:1px solid var(--rule,#d9dee5);font-family:var(--sans,system-ui,sans-serif);font-size:15px;position:relative;z-index:30}
.yfbar a.yfhome{display:inline-flex;align-items:center;gap:4px;text-decoration:none;color:var(--ink,#1b1f24);font-weight:700;border:1px solid var(--rule,#d9dee5);border-radius:999px;padding:5px 12px;white-space:nowrap}
.yfbar .yfsub{position:relative}.yfbar .yfsub>button{font:inherit;font-weight:700;border:1px solid var(--rule,#d9dee5);background:var(--paper,#f6f8fb);color:var(--ink,#1b1f24);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}
.yfmenu{position:absolute;left:0;top:calc(100% + 6px);background:var(--sheet,#fff);border:1px solid var(--rule,#d9dee5);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);min-width:200px;padding:6px;display:none}
.yfmenu.on{display:block}.yfmenu a,.yfmenu span{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:8px;text-decoration:none;color:var(--ink,#1b1f24)}
.yfmenu a:hover{background:var(--paper,#f6f8fb)}.yfmenu a[aria-current=true]{font-weight:700;color:var(--red,#b3261e)}.yfmenu span{color:var(--ink2,#5b6470)}.yfmenu small{color:var(--ink2,#5b6470)}
.yfbar .yft{margin-left:auto;color:var(--ink2,#5b6470);font-size:13px;white-space:nowrap}`;
    document.head.appendChild(css);
    const bar = document.createElement("div"); bar.className = "yfbar"; bar.setAttribute("role", "navigation"); bar.setAttribute("aria-label", "全站導覽");
    bar.innerHTML = `<a class="yfhome" href="${BASE}yifan/" id="yfHome">🏠 總入口</a>
      <div class="yfsub"><button id="yfSubBtn" aria-haspopup="true" aria-expanded="false">${me ? me.name : "科目"} ▾</button>
      <div class="yfmenu" id="yfMenu">${SUBJECTS.map(s => s.ready ? `<a href="${BASE}${s.path}" ${s.id === subId ? 'aria-current="true"' : ""}>${s.name}<small>${s.id === subId ? "目前" : "今天 " + minutes(dkey(), s.id) + " 分"}</small></a>` : `<span>${s.name}<small>等講義上傳</small></span>`).join("")}</div></div>
      <span class="yft" id="yfT">今天全部 ${todayTotal()} / 240 分</span>`;
    document.body.insertBefore(bar, document.body.firstChild);
    const btn = bar.querySelector("#yfSubBtn"), menu = bar.querySelector("#yfMenu");
    btn.onclick = e => { e.stopPropagation(); const on = !menu.classList.contains("on"); menu.classList.toggle("on", on); btn.setAttribute("aria-expanded", on); };
    document.addEventListener("click", () => { menu.classList.remove("on"); btn.setAttribute("aria-expanded", false); });
    // 計時：畫面開著、90 秒內有操作才算
    let last = Date.now();
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(ev => window.addEventListener(ev, () => last = Date.now(), { passive: true }));
    setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - last > 90000) return;
      addSeconds(subId, 10);
      const t = document.getElementById("yfT"); if (t) t.textContent = `今天全部 ${todayTotal()} / 240 分`;
    }, 10000);
    setInterval(syncHub, 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && hubDirty) syncHub(); });
  }

  loadHub();
  const me = document.currentScript && document.currentScript.dataset.subject;
  if (me) { if (document.body) mountBar(me); else document.addEventListener("DOMContentLoaded", () => mountBar(me)); }
  setTimeout(syncHub, 1500);

  return { SUBJECTS, EXAM, BASE, dkey, getCloud, hub: () => H, syncHub, minutes, todayTotal, mergeHub };
})();
