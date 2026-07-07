/* ATL POS v4 · Agyeiwaa's Table cashier console
   Shell: fixed top bar + fixed footer nav (Table | Menu | Cart); the middle is
   the only scroller and hosts pages and overlays. Talks to atl_kiosk_api and
   atl_bill_api. Brand: #15855c on cream. */

frappe.ready(function () {
(function () {
  const root = document.getElementById("atl-pos-root");
  const GREEN = "#15855c", DARK = "#12331f", CREAM = "#faf7f1", AMBER = "#b7791f";
  const ROOMS = ["Restaurant Main", "Terrace", "Room Service", "Take Away"];
  const REASONS = ["Customer changed mind", "Wrong item entered",
    "Kitchen unable to prepare", "Quality issue", "Long wait",
    "Duplicate entry", "Other"];
  let PAGE = "tables";           // tables | menu | cart
  let ROOM = "Restaurant Main";
  let STATE = { tables: [], bills: {}, now: null };
  let MENU = { courses: [], items: [], tree: {} };
  let STATS = {};
  let SEL = null;                // bill object or {new_table}
  let PENDING = [];
  let WAITERS = [];
  let VOIDS = {};                // row -> {request, state} for SEL
  let PHOTOS = localStorage.getItem("atlpos_photos") !== "0";
  const UEMAIL = (window.frappe && frappe.session && frappe.session.user) || "";
  let SHIFT_PROMPTED = false;

  const css = `
  .apos{font-family:Inter,system-ui,sans-serif;background:${CREAM};color:${DARK};
    height:100vh;min-height:560px;border-radius:0;overflow:hidden;
    border:1px solid #e8e2d8;display:flex;flex-direction:column}
  .apos *{box-sizing:border-box}
  .apos-top{display:flex;align-items:center;gap:12px;padding:8px 14px;
    background:#fff;border-bottom:2px solid ${GREEN};flex:0 0 auto;flex-wrap:wrap}
  .apos-top img{height:42px}
  .apos-brand{font-weight:800;letter-spacing:.12em;font-size:12.5px;color:${GREEN}}
  .apos-strip{display:flex;gap:14px;margin-left:auto;font-size:11.5px;
    white-space:nowrap}
  .apos-strip b{color:${GREEN};font-size:14px}
  .apos-chip{background:${GREEN};color:#fff;border:none;border-radius:18px;
    padding:7px 14px;font-weight:700;cursor:pointer;font-size:12px;
    white-space:nowrap}
  .apos-chip.ghost{background:#eef5f0;color:${GREEN}}
  .avatar{width:36px;height:36px;border-radius:50%;background:${GREEN};
    color:#fff;font-weight:800;display:flex;align-items:center;
    justify-content:center;cursor:pointer;font-size:13px;overflow:hidden;
    flex:0 0 auto}
  .avatar img{width:100%;height:100%;object-fit:cover}
  .umenu{position:absolute;top:54px;right:12px;background:#fff;border:1px solid
    #e6dfd1;border-radius:10px;box-shadow:0 6px 18px rgba(20,51,31,.15);
    z-index:120;min-width:180px;overflow:hidden}
  .umenu .uh{padding:10px 14px;font-weight:800;font-size:12.5px;
    border-bottom:1px solid #f0eade}
  .umenu button{display:block;width:100%;text-align:left;border:none;
    background:#fff;padding:10px 14px;font-size:12.5px;cursor:pointer;
    color:${DARK}}
  .umenu button:hover{background:#f5f1e8}
  .apos-main{flex:1 1 auto;overflow:auto;position:relative;background:#fff}
  .apos-foot{flex:0 0 auto;background:#fff;border-top:1px solid #e8e2d8}
  .fnav{display:flex}
  .fnav button{flex:1;border:none;background:#fff;padding:9px 0 6px;
    cursor:pointer;color:#8a8272;font-size:11px;font-weight:700}
  .fnav button .ic{display:block;font-size:17px;line-height:1;margin-bottom:2px}
  .fnav button.on{color:${GREEN};box-shadow:0 -2.5px 0 ${GREEN} inset}
  .credit{padding:3px 0 5px;font-size:9.5px;color:#a89e8c;text-align:center}
  .apos-tabs{display:flex;gap:8px;padding:10px 14px 0;flex-wrap:wrap}
  .apos-tab{padding:8px 16px;border-radius:10px 10px 0 0;cursor:pointer;
    font-weight:700;font-size:12.5px;background:#efe9de;color:#6b6355}
  .apos-tab.on{background:#fff;color:${GREEN};box-shadow:0 -2px 0 ${GREEN} inset;
    background:${CREAM}}
  .tbody{display:flex;align-items:stretch}
  .apos-grid{flex:1;padding:12px;display:grid;gap:10px;align-content:start;
    grid-template-columns:repeat(auto-fill,minmax(126px,1fr))}
  .tcard{border-radius:12px;padding:10px;min-height:84px;cursor:pointer;
    border:1.5px dashed #d8d0c2;background:${CREAM};position:relative}
  .tcard .tn{font-weight:800;font-size:15px}
  .tcard .seat{font-size:10px;color:#a89e8c;font-style:italic;margin-top:14px}
  .tcard.occ{border:1.5px solid #dfe8e2;border-left:5px solid ${GREEN};
    background:#fff;box-shadow:0 1px 3px rgba(20,51,31,.08)}
  .tcard.occ .amt{font-weight:800;color:${GREEN};font-size:13.5px;margin-top:2px}
  .tcard .w{font-size:10.5px;color:#7c8a80}
  .tcard .mins{position:absolute;top:8px;right:8px;font-size:10px;
    background:#eef5f0;color:${GREEN};border-radius:9px;padding:2px 7px;
    font-weight:700}
  .tcard .mins.hot{background:#fbf0dd;color:${AMBER}}
  .tcard .tag{font-size:10px;color:#8a6d3b;font-weight:700}
  .apos-panel{width:372px;border-left:1px solid #eee6d9;display:flex;
    flex-direction:column;background:#fff}
  .apos-panel .ph{padding:11px 14px;border-bottom:1px solid #f0eade}
  .apos-panel .ph .t{font-weight:800;font-size:16.5px}
  .apos-panel .ph .s{font-size:11.5px;color:#7c8a80}
  .apos-items{padding:4px 14px}
  .irow{display:flex;align-items:flex-start;gap:7px;padding:7px 0;
    border-bottom:1px dashed #efe8da;font-size:13px}
  .irow input[type=checkbox]{accent-color:${GREEN};width:15px;height:15px;
    margin-top:2px}
  .irow .q{color:${GREEN};font-weight:800;min-width:24px}
  .irow .nm{flex:1}
  .irow .nt{font-size:10.5px;color:#9a8f7c;font-style:italic}
  .irow .vx{border:1px solid #d8bdb8;background:#fff;color:#b3392f;
    border-radius:7px;width:22px;height:22px;font-weight:800;cursor:pointer;
    line-height:1}
  .vbadge{font-size:9.5px;font-weight:800;border-radius:8px;padding:2px 7px;
    display:inline-block;margin-top:2px}
  .vbadge.pending{background:#fbf0dd;color:${AMBER}}
  .vbadge.approved{background:#e2f3e9;color:${GREEN}}
  .apos-total{display:flex;justify-content:space-between;padding:10px 14px;
    font-weight:800;font-size:16.5px;border-top:2px solid ${GREEN}}
  .apos-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;
    padding:0 14px 14px}
  .abtn{border:1.5px solid ${GREEN};background:#fff;color:${GREEN};
    border-radius:10px;padding:10px 0;font-weight:800;font-size:12.5px;
    cursor:pointer}
  .abtn.solid{background:${GREEN};color:#fff}
  .abtn.wide{grid-column:1/3;font-size:13.5px;padding:12px 0}
  .ovl{position:absolute;inset:0;background:rgba(18,51,31,.45);display:flex;
    align-items:center;justify-content:center;z-index:60;padding:10px}
  .card{background:#fff;border-radius:16px;width:min(560px,96%);max-height:96%;
    display:flex;flex-direction:column;overflow:auto}
  .card .ch{display:flex;align-items:center;justify-content:space-between;
    padding:11px 16px;background:${GREEN};color:#fff;font-weight:800;
    flex:0 0 auto}
  .card .ch button{background:transparent;border:none;color:#fff;
    font-size:20px;cursor:pointer}
  .tform{padding:16px;display:flex;flex-direction:column;gap:12px}
  .tform .big{font-size:28px;font-weight:800;text-align:center;color:${GREEN}}
  .trow{display:flex;gap:8px;align-items:center}
  .trow select{border:1.5px solid #e0d8c8;border-radius:9px;padding:10px;
    font-size:14px;min-width:0}
  .trow input{flex:1;min-width:0;width:100%;border:1.5px solid #e0d8c8;
    border-radius:9px;padding:10px;font-size:15px;text-align:right;
    font-weight:700}
  .trow input.lt{text-align:left;font-weight:400}
  .qcash{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
  .qcash button{border:1.5px solid ${GREEN};background:#fff;color:${GREEN};
    border-radius:9px;padding:8px 12px;font-weight:800;cursor:pointer}
  .chg{text-align:center;font-size:14px}
  .chg b{color:${AMBER};font-size:21px}
  .msg{padding:8px 16px;font-size:12.5px;font-weight:700}
  .msg.err{color:#b3392f}.msg.ok{color:${GREEN}}
  .atooltip{position:fixed;z-index:130;background:${DARK};color:#fff;
    padding:8px 11px;border-radius:9px;font-size:11px;max-width:250px;
    line-height:1.5;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .gr-pad{max-width:340px;margin:24px auto;text-align:center}
  .gr-pad input{font-size:24px;text-align:center;width:180px;
    border:2px solid ${GREEN};border-radius:12px;padding:9px}
  .gr-pad .apos-chip{margin-left:8px}
  /* menu page */
  .mhead{display:flex;gap:8px;align-items:center;padding:10px 12px;
    border-bottom:1px solid #efe8da;flex-wrap:wrap;background:#fff;
    position:sticky;top:0;z-index:5}
  .mhead input{flex:1;min-width:160px;border:1.5px solid #e0d8c8;
    border-radius:9px;padding:9px 12px;font-size:13px}
  .mhead select{border:1.5px solid #e0d8c8;border-radius:9px;padding:9px;
    font-size:12.5px;max-width:180px}
  .crumbs{display:flex;align-items:center;gap:8px;padding:8px 12px;
    border-bottom:1px solid #efe8da;flex-wrap:wrap}
  .chipbtn{border:1.5px solid ${GREEN};background:#fff;color:${GREEN};
    border-radius:18px;padding:7px 14px;font-weight:800;font-size:12px;
    cursor:pointer}
  .chipbtn.on{background:${GREEN};color:#fff}
  .mbody{display:flex;align-items:stretch}
  .mitems{flex:1;padding:10px;display:grid;gap:8px;align-content:start;
    grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
  .mi{border:1px solid #e6dfd1;border-radius:10px;padding:9px;cursor:pointer;
    font-size:12.5px;background:${CREAM}}
  .mi b{display:block;color:${GREEN}}
  .thumb{width:100%;height:56px;object-fit:cover;border-radius:7px;
    margin-bottom:5px;background:#eee6d9}
  .thumb-ph{display:flex;align-items:center;justify-content:center;
    color:${GREEN};font-size:20px}
  .mpend{width:236px;border-left:1px solid #efe8da;display:flex;
    flex-direction:column;background:#fff}
  .prow{font-size:12px;padding:6px 8px;border-bottom:1px dashed #efe8da}
  .prow .st{display:flex;gap:6px;align-items:center;margin-top:3px}
  .prow .st button{width:24px;height:24px;border-radius:6px;
    border:1px solid ${GREEN};background:#fff;color:${GREEN};font-weight:800;
    cursor:pointer}
  .prow input{flex:1;min-width:0;border:1px solid #e6dfd1;border-radius:6px;
    font-size:11px;padding:3px 6px}
  .cartrow{display:flex;justify-content:space-between;align-items:center;
    gap:10px;padding:12px 14px;border-bottom:1px solid #f0eade;cursor:pointer}
  .cartrow:hover{background:#faf7f1}
  .center-note{padding:50px 20px;text-align:center;color:#a89e8c;
    font-size:13.5px}
  `;

  function api(method, args) {
    return new Promise((res) => {
      frappe.call({ method, args, callback: r => res(r.message || {}),
        error: () => res({ ok: 0, error: "Network / server error" }) });
    });
  }
  const fmt = n => "GHS " + (Number(n) || 0).toFixed(2);
  const esc = s => String(s || "").replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const tfmt = ts => {
    if (!ts) return "";
    const d = new Date(String(ts).replace(" ", "T"));
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
  };
  const initials = n => (n || "??").split(/\s+/).map(x => x[0]).join("")
    .slice(0, 2).toUpperCase();

  async function refresh() {
    const [st, sg] = await Promise.all([
      api("atl_pos.api.kiosk", { action: "tables_status" }),
      api("atl_pos.api.bill", { action: "stats" })]);
    if (st.ok) STATE = st;
    if (sg.ok) STATS = sg;
    if (!MENU.items.length) {
      const m = await api("atl_pos.api.kiosk", { action: "menu" });
      if (m.ok) MENU = m;
    }
    if (!WAITERS.length) {
      const w = await api("atl_pos.api.kiosk", { action: "waiters" });
      if (w.ok) WAITERS = w.waiters;
    }
    render();
    if (!STATS.my_shift && !SHIFT_PROMPTED) {
      SHIFT_PROMPTED = true;
      shiftOverlay();
    }
  }

  function minsSince(ts) {
    if (!ts || !STATE.now) return null;
    const d = (new Date(STATE.now.replace(" ", "T")) -
               new Date(ts.replace(" ", "T"))) / 60000;
    return Math.max(0, Math.round(d));
  }
  function findBill(name) {
    for (const bs of Object.values(STATE.bills || {}))
      for (const b of bs) if (b.name === name) return b;
    return null;
  }
  function roomOfTable(t) {
    const row = (STATE.tables || []).find(x => x.name === t);
    if (!row) return "Restaurant Main";
    if (row.is_take_away) return "Take Away";
    if (row.restaurant_room === "In-Room Dining") return "Room Service";
    return row.restaurant_room;
  }
  const printUrl = n =>
    `/printview?doctype=POS%20Invoice&name=${encodeURIComponent(n)}` +
    `&format=ATL%20Thermal%20Receipt&no_letterhead=1`;

  /* ═══ shell ═══ */
  function render() {
    const shift = STATS.my_shift;
    const me = STATS.me || {};
    root.innerHTML = `<style>${css}</style>
    <div class="apos">
      <div class="apos-top">
        <img src="/files/atl_logo.png" onerror="this.style.display='none'">
        <div><div class="apos-brand">AGYEIWAA'S TABLE · POS</div>
          <div style="font-size:10px;color:#8a8272;font-style:italic">
            there's always a seat for you</div></div>
        <div class="apos-strip">
          <div>Today<br><b>${fmt(STATS.today_revenue)}</b></div>
          <div>Open bills<br><b>${STATS.open_bills ?? "–"}</b></div>
          <div>Folio<br><b>${fmt(STATS.folio_balance)}</b></div>
          ${shift ? `<div>Float<br><b>${fmt(shift.cash_float)}</b></div>` : ""}
        </div>
        ${shift
          ? `<button class="apos-chip ghost">Shift Opened @ ${tfmt(shift.period_start_date)}</button>`
          : `<button class="apos-chip" id="openShift">OPEN SHIFT</button>`}
        <button class="apos-chip ghost" id="rf">Reload</button>
        <div class="avatar" id="ava" title="${esc(me.full_name || "")}">
          ${me.image ? `<img src="${esc(me.image)}">` : initials(me.full_name)}
        </div>
      </div>
      <div class="apos-main" id="main"></div>
      <div class="apos-foot">
        <div class="fnav">
          ${[["tables", "▦", "Table"], ["menu", "▤", "Menu"],
             ["cart", "🧾", "Cart"]].map(([p, ic, lb]) =>
            `<button class="${PAGE === p ? "on" : ""}" data-pg="${p}">
               <span class="ic">${ic}</span>${lb}</button>`).join("")}
        </div>
        <div class="credit">Designed by System Manager @ ATL · 0542820156</div>
      </div>
    </div>`;
    const os = root.querySelector("#openShift");
    if (os) os.onclick = shiftOverlay;
    root.querySelector("#rf").onclick = () => window.location.reload();
    root.querySelector("#ava").onclick = userMenu;
    root.querySelectorAll("[data-pg]").forEach(el => el.onclick = () => {
      PAGE = el.dataset.pg;
      if (PAGE === "menu") PENDING = [];
      render();
    });
    drawMain();
  }

  function userMenu() {
    const main = root.querySelector(".apos");
    const old = main.querySelector(".umenu");
    if (old) { old.remove(); return; }
    const me = STATS.me || {};
    const d = document.createElement("div");
    d.className = "umenu";
    d.innerHTML = `<div class="uh">${esc(me.full_name || UEMAIL)}
      <div style="font-weight:400;font-size:10.5px;color:#8a8272">
        ${esc(UEMAIL)}</div></div>
      <button id="ulogout">Log Out</button>`;
    main.style.position = "relative";
    main.appendChild(d);
    d.querySelector("#ulogout").onclick = () => {
      frappe.call({ method: "logout",
        callback: () => { window.location.href = "/login"; } });
    };
    setTimeout(() => {
      document.addEventListener("click", function h(e) {
        if (!d.contains(e.target)) { d.remove();
          document.removeEventListener("click", h); }
      });
    }, 50);
  }

  function drawMain() {
    const m = root.querySelector("#main");
    m.innerHTML = `<div id="pg"></div><div id="ovl"></div>`;
    if (PAGE === "tables") drawTables();
    else if (PAGE === "menu") drawMenuPage();
    else drawCart();
  }

  /* ═══ Tables page ═══ */
  function drawTables() {
    const pg = root.querySelector("#pg");
    pg.innerHTML = `
      <div class="apos-tabs">${ROOMS.map(r =>
        `<div class="apos-tab ${r === ROOM ? "on" : ""}" data-room="${r}">${r}</div>`)
        .join("")}</div>
      <div class="tbody">
        <div class="apos-grid" id="grid"></div>
        <div class="apos-panel" id="panel" style="display:none"></div>
      </div>`;
    pg.querySelectorAll(".apos-tab").forEach(el => el.onclick = () => {
      ROOM = el.dataset.room; SEL = null; drawTables(); });
    drawGrid();
    if (SEL) drawPanel();
  }

  function tablesForRoom() {
    const t = STATE.tables || [];
    if (ROOM === "Take Away") return t.filter(x => x.is_take_away);
    if (ROOM === "Room Service")
      return t.filter(x => x.restaurant_room === "In-Room Dining");
    return t.filter(x => x.restaurant_room === ROOM && !x.is_take_away);
  }

  function attachTip(el, b) {
    if (!b || !b.summary) return;
    el.onmouseenter = ev => {
      const t = document.createElement("div");
      t.className = "atooltip";
      t.innerHTML = `<b>${esc(b.name)}</b>${b.custom_guest_name ?
        " · " + esc(b.custom_guest_name) : ""}<br>${esc(b.summary)}`;
      document.body.appendChild(t); el._tt = t;
      const mv = e2 => {
        t.style.left = Math.min(e2.clientX + 14,
          window.innerWidth - t.offsetWidth - 8) + "px";
        t.style.top = (e2.clientY + 12) + "px";
      };
      mv(ev); el.onmousemove = mv;
    };
    el.onmouseleave = () => { if (el._tt) el._tt.remove(); el._tt = null; };
  }

  function drawGrid() {
    const g = root.querySelector("#grid");
    if (ROOM === "Room Service") {
      const occ = Object.entries(STATE.bills || {})
        .filter(([t]) => t.startsWith("GR-"));
      g.style.display = "block";
      g.innerHTML = `<div class="gr-pad">
        <div style="font-weight:800;margin-bottom:8px">Guest room number</div>
        <input id="grno" inputmode="numeric" placeholder="e.g. 120">
        <button class="apos-chip" id="grgo">Open</button>
        <div style="margin-top:16px;text-align:left">${occ.map(([t, bs]) =>
          bs.map(b => `<div class="tcard occ" data-bill="${b.name}"
            style="margin-bottom:8px"><div class="tn">${t}</div>
            <div class="amt">${fmt(b.grand_total || b.total)}</div>
            ${b.custom_raybow_room ?
              `<div class="tag">⌂ ${esc(b.custom_raybow_room)}</div>` : ""}
          </div>`).join("")).join("") ||
          "<div style='color:#a89e8c;font-size:12px'>No room-service bills open.</div>"}
        </div></div>`;
      g.querySelector("#grgo").onclick = () => {
        const n = (g.querySelector("#grno").value || "").trim();
        if (!/^\d{3}$/.test(n)) return;
        const tb = "GR-" + n;
        const bs = (STATE.bills || {})[tb];
        SEL = bs && bs.length ? bs[0] : { new_table: tb };
        drawPanel();
      };
      g.querySelectorAll("[data-bill]").forEach(el => {
        el.onclick = () => { SEL = findBill(el.dataset.bill); drawPanel(); };
        attachTip(el, findBill(el.dataset.bill));
      });
      return;
    }
    g.style.display = "grid";
    g.innerHTML = tablesForRoom().map(t => {
      const bs = (STATE.bills || {})[t.name] || [];
      if (!bs.length)
        return `<div class="tcard" data-new="${t.name}">
          <div class="tn">${t.name}</div>
          <div class="seat">a seat for you</div></div>`;
      return bs.map(b => {
        const m = minsSince(b.last_kot);
        return `<div class="tcard occ" data-bill="${b.name}">
          <div class="tn">${t.name}</div>
          <div class="amt">${fmt(b.grand_total || b.total)}</div>
          <div class="w">${esc(b.waiter || "")}</div>
          ${b.custom_raybow_room ?
            `<div class="tag">⌂ ${esc(b.custom_raybow_room)}</div>` : ""}
          ${m !== null ?
            `<div class="mins ${m > 20 ? "hot" : ""}">${m}m</div>` : ""}
        </div>`;
      }).join("");
    }).join("");
    g.querySelectorAll("[data-new]").forEach(el => el.onclick = () => {
      SEL = { new_table: el.dataset.new }; drawPanel(); });
    g.querySelectorAll("[data-bill]").forEach(el => {
      el.onclick = () => { SEL = findBill(el.dataset.bill); drawPanel(); };
      attachTip(el, findBill(el.dataset.bill));
    });
  }

  /* ═══ Order panel ═══ */
  async function drawPanel() {
    const p = root.querySelector("#panel");
    if (!p) return;
    p.style.display = "flex";
    if (SEL && SEL.new_table) {
      p.innerHTML = `<div class="ph"><div class="t">${SEL.new_table}</div>
        <div class="s">New order</div></div>
        <div class="apos-items center-note">No items yet. Add the first round.</div>
        <div class="apos-acts">
          <button class="abtn solid wide" id="addNew">+ ADD ITEMS</button>
          <button class="abtn wide" id="closeP">Close</button></div>`;
      p.querySelector("#addNew").onclick = () => {
        PENDING = []; PAGE = "menu"; render(); };
      p.querySelector("#closeP").onclick = () => {
        SEL = null; p.style.display = "none"; };
      return;
    }
    const r = await api("atl_pos.api.bill", { action: "get_items",
                                          invoice: SEL.name });
    const items = r.items || [];
    VOIDS = r.voids || {};
    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const charged = SEL.custom_charge_to_room;
    p.innerHTML = `<div class="ph"><div class="t">${esc(SEL.restaurant_table)}
        <span style="font-size:11px;color:#9aa79f">· ${esc(SEL.name)}</span></div>
      <div class="s">${esc(SEL.waiter || "")}${charged ?
        " · ⌂ Room " + esc(SEL.custom_raybow_room) : ""}
        · <a href="#" id="gname" style="color:${GREEN};font-weight:700;
          text-decoration:none">${SEL.custom_guest_name ?
          esc(SEL.custom_guest_name) + " ✎" : "+ guest name"}</a></div></div>
      <div class="apos-items">${items.map(i => {
        const v = VOIDS[i.name];
        return `<div class="irow">
        <input type="checkbox" data-ck="${esc(i.name)}">
        <div class="q">${Number(i.qty)}×</div>
        <div class="nm">${esc(i.item_name)}
          ${i.description && i.description !== i.item_name ?
            `<div class="nt">${esc(i.description)}</div>` : ""}
          ${v ? `<span class="vbadge ${v.state}">${v.state === "pending"
            ? "VOID pending approval"
            : "VOID approved · tap ✕"}</span>` : ""}
        </div>
        <div>${(Number(i.amount) || 0).toFixed(2)}</div>
        <button class="vx" data-vx="${esc(i.name)}" title="Void item">✕</button>
        </div>`; }).join("")}</div>
      <div class="apos-total"><span>TOTAL</span><span>${fmt(total)}</span></div>
      <div class="apos-acts">
        <button class="abtn" id="addMore">+ Add items</button>
        <button class="abtn" id="preRc">Pre-receipt</button>
        <button class="abtn" id="xfer">Transfer</button>
        <button class="abtn" id="chg">${charged ? "⌂ Charged" : "Charge to room"}</button>
        <button class="abtn solid wide" id="tender">TENDER · ${fmt(total)}</button>
        <button class="abtn wide" id="mv" style="display:none">MOVE SELECTED TO…</button>
      </div>
      <div class="msg" id="pmsg"></div>`;
    const mvBtn = p.querySelector("#mv");
    const cks = () => [...p.querySelectorAll("[data-ck]:checked")]
      .map(x => x.dataset.ck);
    p.querySelectorAll("[data-ck]").forEach(x => x.onchange = () => {
      mvBtn.style.display = cks().length ? "block" : "none";
      mvBtn.textContent = cks().length === items.length
        ? "COMBINE WHOLE BILL INTO…" : `MOVE ${cks().length} SELECTED TO…`;
    });
    mvBtn.onclick = () => moveOverlay(cks(), items.length);
    p.querySelector("#gname").onclick = async e => {
      e.preventDefault();
      const g = prompt("Guest name for this bill:",
                       SEL.custom_guest_name || "");
      if (g === null) return;
      await api("atl_pos.api.bill", { action: "name_bill",
        payload: JSON.stringify({ invoice: SEL.name, guest: g }) });
      await refresh(); SEL = findBill(SEL.name);
      PAGE = "tables"; render();
    };
    p.querySelector("#addMore").onclick = () => {
      PENDING = []; PAGE = "menu"; render(); };
    p.querySelector("#preRc").onclick = () =>
      window.open(printUrl(SEL.name), "_blank");
    p.querySelector("#xfer").onclick = transferOverlay;
    p.querySelector("#chg").onclick = chargeOverlay;
    p.querySelector("#tender").onclick = () => tenderOverlay(total, charged);
    p.querySelectorAll("[data-vx]").forEach(el => el.onclick = () =>
      voidFlow(el.dataset.vx, items.find(i => i.name === el.dataset.vx)));
  }

  /* ═══ Void flow ═══ */
  function voidFlow(rowid, item) {
    const v = VOIDS[rowid];
    if (v && v.state === "pending") {
      alert("Void already requested. Waiting for the Auditor (" +
            v.request + ").");
      return;
    }
    if (v && v.state === "approved") {
      if (!confirm(`Auditor approved. Remove ${item.item_name} from the bill?`))
        return;
      api("atl_pos.api.bill", { action: "apply_void",
        payload: JSON.stringify({ request: v.request }) }).then(async r => {
          if (!r.ok) { alert(r.error); return; }
          await refresh(); SEL = findBill(SEL.name);
          if (SEL) { PAGE = "tables"; render(); }
        });
      return;
    }
    const ov = root.querySelector("#ovl");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:420px">
      <div class="ch"><span>Void · ${esc(item.item_name)}</span>
        <button id="x">×</button></div>
      <div class="tform">
        <div style="font-size:12px;color:#7c8a80">A KOT has been sent, so
          removal needs the Auditor. Pick a reason; the request goes for
          approval.</div>
        <div class="trow"><select id="vr" style="flex:1">
          ${REASONS.map(r => `<option>${r}</option>`).join("")}</select></div>
        <div class="trow"><input id="vn" class="lt" placeholder="Note (optional)"></div>
        <button class="abtn solid wide" id="go">REQUEST VOID</button>
        <div class="msg err" id="verr"></div>
      </div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "request_void",
        payload: JSON.stringify({ invoice: SEL.name, row: rowid,
          reason: ov.querySelector("#vr").value,
          note: ov.querySelector("#vn").value }) });
      if (!r.ok) { ov.querySelector("#verr").textContent = r.error; return; }
      ov.innerHTML = "";
      drawPanel();
    };
  }

  /* ═══ Menu page (full page) ═══ */
  function drawMenuPage() {
    const pg = root.querySelector("#pg");
    if (!SEL) {
      pg.innerHTML = `<div class="center-note">Select a table first, then add
        items to its bill.<br><br>
        <button class="abtn solid" style="padding:10px 22px" id="goT">
          Go to Tables</button></div>`;
      pg.querySelector("#goT").onclick = () => { PAGE = "tables"; render(); };
      return;
    }
    const isNew = !!SEL.new_table;
    let main = null, sub = null, q = "", attendant = "", route = "";
    let deb = null;
    const label = g => String(g || "").replace(/^ATL /, "");
    const tree = MENU.tree || {};
    const mains = Object.keys(tree);
    const inScope = i => {
      if (q) return i.item_name.toLowerCase().includes(q) ||
                    i.item.toLowerCase().includes(q);
      if (sub) return i.item_group === sub;
      if (main) return i.item_group === main ||
                       (tree[main] || []).includes(i.item_group);
      return true;
    };
    const draw = () => {
      const items = MENU.items.filter(inScope)
        .slice().sort((a, b) => a.item_name.localeCompare(b.item_name));
      const chips = q ? [] : (main ? (tree[main] || []) : mains);
      const crumb = q ? "Search results"
        : ["All", main && label(main), sub && label(sub)]
            .filter(Boolean).join(" / ");
      const pcount = PENDING.reduce((s, x) => s + x.qty, 0);
      pg.innerHTML = `
      <div class="mhead">
        <b style="color:${GREEN};font-size:13px;white-space:nowrap">
          ${isNew ? "New · " + esc(SEL.new_table)
                  : "Add to " + esc(SEL.restaurant_table)}</b>
        <input id="ms" placeholder="Search the menu…" value="${esc(q)}">
        <select id="att">
          <option value="">Attendant: cashier</option>
          ${WAITERS.map(w =>
            `<option ${w === attendant ? "selected" : ""}>${esc(w)}</option>`)
            .join("")}</select>
        <button id="ph" class="abtn" style="padding:8px 12px;
          ${PHOTOS ? `background:${GREEN};color:#fff` : ""}">📷</button>
      </div>
      <div class="crumbs">
        ${(main || sub || q) ? `<button class="abtn" id="up"
           style="padding:6px 12px">‹ Back</button>` : ""}
        <span style="font-size:11.5px;color:#8a8272;font-weight:700">${crumb}</span>
        ${chips.map(c => `<button class="chipbtn ${(sub || main) === c ? "on" : ""}"
          data-c="${esc(c)}">${label(c)}</button>`).join("")}
      </div>
      <div class="mbody">
        <div class="mitems" style="grid-template-columns:repeat(auto-fill,
          minmax(${PHOTOS ? "140px" : "160px"},1fr))">
          ${items.map(i => `<div class="mi" data-i="${esc(i.item)}">
            ${PHOTOS ? (i.image ?
              `<img class="thumb" src="${esc(i.image)}" loading="lazy">` :
              `<div class="thumb thumb-ph">🍽</div>`) : ""}
            <b>${esc(i.item_name)}</b>${Number(i.rate).toFixed(2)}</div>`)
            .join("")}
        </div>
        <div class="mpend">
          <div style="flex:1;overflow:auto">${PENDING.map((pn, ix) =>
            `<div class="prow"><b>${esc(pn.item_name)}</b>
              <div style="display:flex;justify-content:space-between;
                font-size:11px;color:#5d6b61;margin-top:2px">
                <span>@ ${Number(pn.rate).toFixed(2)}</span>
                <b style="color:${GREEN}">${(pn.rate * pn.qty).toFixed(2)}</b></div>
              <div class="st"><button data-m="${ix}">−</button>
                <span style="font-weight:800">${pn.qty}</span>
                <button data-p="${ix}">+</button>
                <input data-n="${ix}" placeholder="note" value="${esc(pn.note)}">
              </div></div>`).join("") ||
            `<div style="padding:14px;color:#a89e8c;font-size:12px">
              Tap items to queue them.</div>`}
          </div>
          <div style="padding:8px 10px;border-top:1px solid #efe8da;
            font-size:12px;display:flex;justify-content:space-between">
            <span>${pcount} item(s)</span>
            <b style="color:${GREEN}">${fmt(PENDING.reduce((s, x) =>
              s + x.rate * x.qty, 0))}</b></div>
          <div style="display:flex;gap:5px;padding:0 10px 6px">
            ${["", "Kitchen", "Bar"].map(r0 => `<button data-r="${r0}"
              class="abtn" style="flex:1;padding:6px 0;font-size:10.5px;
              ${route === r0 ? `background:${GREEN};color:#fff` : ""}">
              ${r0 || "Auto route"}</button>`).join("")}</div>
          <div style="padding:0 10px 10px">
            <button class="abtn solid wide" id="fire" style="width:100%">
              SEND${pcount ? " · " + pcount + " item(s)" : ""}</button></div>
        </div>
      </div>`;
      const s = pg.querySelector("#ms");
      s.oninput = () => {
        clearTimeout(deb);
        deb = setTimeout(() => { q = s.value.toLowerCase(); draw();
          const s2 = pg.querySelector("#ms");
          s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length);
        }, 400);
      };
      s.onkeydown = e => { if (e.key === "Enter") { clearTimeout(deb);
        q = s.value.toLowerCase(); draw(); } };
      const att = pg.querySelector("#att");
      att.onchange = () => { attendant = att.value; };
      pg.querySelector("#ph").onclick = () => {
        PHOTOS = !PHOTOS;
        localStorage.setItem("atlpos_photos", PHOTOS ? "1" : "0"); draw(); };
      const up = pg.querySelector("#up");
      if (up) up.onclick = () => {
        if (q) { q = ""; }
        else if (sub) sub = null;
        else main = null;
        draw();
      };
      pg.querySelectorAll(".chipbtn").forEach(el => el.onclick = () => {
        const c = el.dataset.c; q = "";
        if (!main) { main = c; sub = null; }
        else if (!sub) sub = c;
        draw();
      });
      pg.querySelectorAll(".mi").forEach(el => el.onclick = () => {
        const it = MENU.items.find(x => x.item === el.dataset.i);
        const ex = PENDING.find(x => x.item === it.item && !x.note);
        if (ex) ex.qty += 1;
        else PENDING.push({ item: it.item, item_name: it.item_name,
                            rate: it.rate, qty: 1, note: "" });
        draw();
      });
      pg.querySelectorAll("[data-p]").forEach(el => el.onclick = () => {
        PENDING[el.dataset.p].qty += 1; draw(); });
      pg.querySelectorAll("[data-m]").forEach(el => el.onclick = () => {
        const i = el.dataset.m;
        PENDING[i].qty -= 1; if (PENDING[i].qty <= 0) PENDING.splice(i, 1);
        draw(); });
      pg.querySelectorAll("[data-n]").forEach(el => el.onchange = () => {
        PENDING[el.dataset.n].note = el.value; });
      pg.querySelectorAll("[data-r]").forEach(el => el.onclick = () => {
        route = el.dataset.r; draw(); });
      pg.querySelector("#fire").onclick = fire;
    };
    const fire = async () => {
      if (!PENDING.length) return;
      const items = PENDING.map(x => ({ item: x.item, qty: x.qty,
                                        note: x.note }));
      let r;
      if (isNew) {
        r = await api("atl_pos.api.kiosk", { action: "place_order",
          payload: JSON.stringify({ table: SEL.new_table, items,
            attendant, route,
            order_type: SEL.new_table.startsWith("TW-") ? "Take Away" :
              SEL.new_table.startsWith("GR-") ? "Room Service" : "Dine In" }) });
      } else {
        r = await api("atl_pos.api.kiosk", { action: "append_to_order",
          payload: JSON.stringify({ invoice: SEL.name, items, route }) });
      }
      PENDING = [];
      await refresh();
      if (r.ok) {
        SEL = findBill(r.invoice) || SEL;
        ROOM = roomOfTable(SEL.restaurant_table || SEL.new_table);
      } else if (r.error) {
        alert(r.error);
      }
      PAGE = "tables"; render();
    };
    draw();
  }

  /* ═══ Cart page ═══ */
  function drawCart() {
    const pg = root.querySelector("#pg");
    const all = [];
    for (const [t, bs] of Object.entries(STATE.bills || {}))
      for (const b of bs) all.push([t, b]);
    all.sort((a, b) => a[0].localeCompare(b[0]));
    pg.innerHTML = `<div style="padding:12px 14px;font-weight:800;
        font-size:14px">Active tables · all rooms (${all.length})</div>
      ${all.map(([t, b]) => {
        const m = minsSince(b.last_kot);
        return `<div class="cartrow" data-bill="${b.name}">
        <div><b>${t}</b>
          <span style="font-size:11px;color:#8a8272">· ${esc(b.waiter || "")}
          ${b.custom_guest_name ? "· " + esc(b.custom_guest_name) : ""}
          ${b.custom_raybow_room ? "· ⌂ " + esc(b.custom_raybow_room) : ""}</span>
          <div style="font-size:11px;color:#a89e8c">${esc(b.summary || "")}</div>
        </div>
        <div style="text-align:right">
          <b style="color:${GREEN}">${fmt(b.grand_total || b.total)}</b>
          ${m !== null ? `<div style="font-size:10.5px;
            color:${m > 20 ? AMBER : "#8a8272"}">${m}m ago</div>` : ""}
        </div></div>`;
      }).join("") ||
      `<div class="center-note">No active tables. there's always a seat
        for you.</div>`}`;
    pg.querySelectorAll("[data-bill]").forEach(el => el.onclick = () => {
      SEL = findBill(el.dataset.bill);
      if (SEL) { ROOM = roomOfTable(SEL.restaurant_table); }
      PAGE = "tables"; render();
    });
  }

  /* ═══ overlays: move / tender / charge / transfer / shift ═══ */
  function moveOverlay(rows, totalRows) {
    const others = [];
    for (const bs of Object.values(STATE.bills || {}))
      for (const b of bs) if (b.name !== SEL.name) others.push(b);
    const ov = root.querySelector("#ovl");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:400px">
      <div class="ch"><span>${rows.length === totalRows ?
        "Combine whole bill into" : "Move " + rows.length + " item(s) to"}</span>
        <button id="x">×</button></div>
      <div class="tform">
        <div class="trow"><select id="tgt" style="flex:1">
          ${others.map(b => `<option value="${esc(b.name)}">
            ${esc(b.restaurant_table)} · ${esc(b.name)} · ${fmt(b.grand_total)}
          </option>`).join("")}</select></div>
        <button class="abtn solid wide" id="go">MOVE</button>
        <div class="msg err" id="merr"></div>
      </div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    if (!others.length) {
      ov.querySelector("#merr").textContent =
        "No other open bill. Use Transfer to move the table instead.";
      ov.querySelector("#go").disabled = true; return;
    }
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "move_items",
        payload: JSON.stringify({ source: SEL.name, rows,
          target: ov.querySelector("#tgt").value }) });
      if (!r.ok) { ov.querySelector("#merr").textContent = r.error; return; }
      ov.innerHTML = ""; await refresh();
      SEL = findBill(r.source_gone ? r.target : SEL.name);
      PAGE = "tables"; render();
    };
  }

  function tenderOverlay(total, charged) {
    const ov = root.querySelector("#ovl");
    let lines = [{ mode: charged ? "Raybow Folio" : "Cash", amount: total }];
    const modes = ["Cash", "Mobile Money", "Credit Card"]
      .concat(charged ? ["Raybow Folio"] : []);
    const draw = () => {
      const paid = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const change = paid - total;
      ov.innerHTML = `<div class="ovl"><div class="card" style="width:430px">
        <div class="ch"><span>Tender · ${esc(SEL.restaurant_table)}</span>
          <button id="x">×</button></div>
        <div class="tform">
          <div class="big">${fmt(total)}</div>
          ${lines.map((l, ix) => `<div class="trow">
            <select data-s="${ix}">${modes.map(m =>
              `<option ${m === l.mode ? "selected" : ""}>${m}</option>`)
              .join("")}</select>
            <input data-a="${ix}" type="number" step="0.01" value="${l.amount}">
            ${lines.length > 1 ? `<button class="abtn" data-x="${ix}"
              style="padding:8px 12px">−</button>` : ""}
          </div>`).join("")}
          <div style="display:flex;justify-content:space-between;
            align-items:center;flex-wrap:wrap;gap:6px">
            <button class="abtn" id="addLine" style="padding:8px 14px">
              + split tender</button>
            <div class="qcash">${[10, 20, 50, 100, 200].map(v =>
              `<button data-q="${v}">${v}</button>`).join("")}
              <button data-q="exact">exact</button></div>
          </div>
          <div class="chg">${change >= 0 ?
            `Change <b>${fmt(change)}</b>` :
            `<span style="color:#b3392f">Short by ${fmt(-change)}</span>`}</div>
          <button class="abtn solid wide" id="ok"
            ${change < -0.004 ? "disabled style='opacity:.4'" : ""}>
            CONFIRM &amp; PRINT</button>
          <div class="msg err" id="terr"></div>
        </div></div></div>`;
      ov.querySelector("#x").onclick = () => ov.innerHTML = "";
      ov.querySelectorAll("[data-s]").forEach(el => el.onchange = () => {
        lines[el.dataset.s].mode = el.value; });
      ov.querySelectorAll("[data-a]").forEach(el => el.onchange = () => {
        lines[el.dataset.a].amount = Number(el.value) || 0; draw(); });
      ov.querySelectorAll("[data-x]").forEach(el => el.onclick = () => {
        lines.splice(el.dataset.x, 1); draw(); });
      ov.querySelector("#addLine").onclick = () => {
        lines.push({ mode: "Mobile Money", amount: 0 }); draw(); };
      ov.querySelectorAll("[data-q]").forEach(el => el.onclick = () => {
        const v = el.dataset.q === "exact" ? total : Number(el.dataset.q);
        lines[0].amount = v; draw(); });
      ov.querySelector("#ok").onclick = async () => {
        const r = await api("atl_pos.api.bill", { action: "settle",
          payload: JSON.stringify({ invoice: SEL.name,
            tenders: lines.filter(l => Number(l.amount) > 0) }) });
        if (!r.ok) { ov.querySelector("#terr").textContent = r.error; return; }
        window.open(printUrl(SEL.name), "_blank");
        ov.innerHTML = ""; SEL = null;
        refresh();
      };
    };
    draw();
  }

  function chargeOverlay() {
    const ov = root.querySelector("#ovl");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:400px">
      <div class="ch"><span>Charge to Raybow room</span>
        <button id="x">×</button></div>
      <div class="tform">
        <div class="trow"><input id="cg" class="lt"
          placeholder="Guest name (optional)"></div>
        <div class="trow"><input id="cr" class="lt"
          placeholder="Raybow room no" inputmode="numeric"></div>
        <button class="abtn solid wide" id="go">CHARGE</button>
        <div class="msg err" id="cerr"></div>
      </div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "charge_to_room",
        payload: JSON.stringify({ invoice: SEL.name,
          guest: ov.querySelector("#cg").value,
          room: ov.querySelector("#cr").value }) });
      if (!r.ok) { ov.querySelector("#cerr").textContent = r.error; return; }
      ov.innerHTML = ""; await refresh();
      SEL = findBill(SEL.name); PAGE = "tables"; render();
    };
  }

  function transferOverlay() {
    const ov = root.querySelector("#ovl");
    const opts = (STATE.tables || []).map(t =>
      `<option>${t.name}</option>`).join("");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:360px">
      <div class="ch"><span>Transfer table</span><button id="x">×</button></div>
      <div class="tform"><div class="trow">
        <select id="tt" style="flex:1">${opts}</select></div>
        <button class="abtn solid wide" id="go">TRANSFER</button>
        <div class="msg err" id="xerr"></div></div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "transfer_table",
        payload: JSON.stringify({ invoice: SEL.name,
          table: ov.querySelector("#tt").value }) });
      if (!r.ok) { ov.querySelector("#xerr").textContent = r.error; return; }
      ov.innerHTML = ""; SEL = null; refresh();
    };
  }

  function shiftOverlay() {
    const ov = root.querySelector("#ovl");
    if (!ov) return;
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:380px">
      <div class="ch"><span>Open shift</span><button id="x">×</button></div>
      <div class="tform">
        <div style="font-size:12px;color:#7c8a80">Count the drawer and enter
          the cash float. Cash, MoMo, Card and Raybow Folio all open on the
          entry; only cash carries a float.</div>
        <div class="trow"><span style="min-width:96px;font-weight:700">
          Cash float</span>
          <input id="sf" type="number" step="0.01" min="0"
            placeholder="0.00"></div>
        <button class="abtn solid wide" id="go">OPEN &amp; SUBMIT</button>
        <div class="msg err" id="serr"></div>
      </div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "open_shift",
        payload: JSON.stringify({
          cash: ov.querySelector("#sf").value || 0 }) });
      if (!r.ok) { ov.querySelector("#serr").textContent = r.error; return; }
      ov.innerHTML = ""; refresh();
    };
  }

  refresh();
  setInterval(() => {
    const ovl = root.querySelector("#ovl");
    if (PAGE === "tables" && (!ovl || !ovl.innerHTML)) refresh();
  }, 25000);
})();
});
