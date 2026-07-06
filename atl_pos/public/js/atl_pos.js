/* ATL POS · Agyeiwaa's Table cashier console
   Custom HTML Block script. Green #15855c on cream, logo from /files/atl_logo.png.
   Talks to atl_kiosk_api (menu, tables_status, place_order, append_to_order)
   and atl_bill_api (open_shift, settle, charge_to_room, transfer_table, stats). */

frappe.ready(function () {
(function () {
  const root = document.getElementById("atl-pos-root");
  const GREEN = "#15855c", DARK = "#12331f", CREAM = "#faf7f1", AMBER = "#b7791f";
  const ROOMS = ["Restaurant Main", "Terrace", "Room Service", "Take Away"];
  let ROOM = "Restaurant Main";
  let STATE = { tables: [], bills: {}, now: null };
  let MENU = { courses: [], items: [] };
  let SEL = null;            // selected bill {name,...} or {new_table: "RM-01"}
  let PENDING = [];          // items queued in the add-overlay
  let STATS = {};
  let POLL = null;

  const css = `
  .apos{font-family:Inter,system-ui,sans-serif;background:${CREAM};color:${DARK};
    min-height:640px;border-radius:14px;overflow:hidden;border:1px solid #e8e2d8}
  .apos *{box-sizing:border-box}
  .apos-top{display:flex;align-items:center;gap:14px;padding:10px 16px;
    background:#fff;border-bottom:2px solid ${GREEN}}
  .apos-top img{height:46px}
  .apos-brand{font-weight:800;letter-spacing:.12em;font-size:13px;color:${GREEN}}
  .apos-strip{display:flex;gap:18px;margin-left:auto;font-size:12.5px}
  .apos-strip b{color:${GREEN};font-size:15px}
  .apos-chip{background:${GREEN};color:#fff;border:none;border-radius:20px;
    padding:8px 16px;font-weight:700;cursor:pointer;font-size:12.5px}
  .apos-chip.ghost{background:#eef5f0;color:${GREEN}}
  .apos-tabs{display:flex;gap:8px;padding:10px 16px 0}
  .apos-tab{padding:9px 18px;border-radius:10px 10px 0 0;cursor:pointer;
    font-weight:700;font-size:13px;background:#efe9de;color:#6b6355}
  .apos-tab.on{background:#fff;color:${GREEN};box-shadow:0 -2px 0 ${GREEN} inset}
  .apos-body{display:flex;min-height:540px;background:#fff}
  .apos-grid{flex:1;padding:14px;display:grid;gap:10px;align-content:start;
    grid-template-columns:repeat(auto-fill,minmax(128px,1fr))}
  .tcard{border-radius:12px;padding:10px;min-height:86px;cursor:pointer;
    border:1.5px dashed #d8d0c2;background:${CREAM};position:relative}
  .tcard .tn{font-weight:800;font-size:15px}
  .tcard .seat{font-size:10px;color:#a89e8c;font-style:italic;margin-top:16px}
  .tcard.occ{border:1.5px solid #dfe8e2;border-left:5px solid ${GREEN};
    background:#fff;box-shadow:0 1px 3px rgba(20,51,31,.08)}
  .tcard.occ .amt{font-weight:800;color:${GREEN};font-size:14px;margin-top:2px}
  .tcard .w{font-size:10.5px;color:#7c8a80}
  .tcard .mins{position:absolute;top:8px;right:8px;font-size:10px;
    background:#eef5f0;color:${GREEN};border-radius:9px;padding:2px 7px;font-weight:700}
  .tcard .mins.hot{background:#fbf0dd;color:${AMBER}}
  .tcard .tag{font-size:10px;color:#8a6d3b;font-weight:700}
  .apos-panel{width:378px;border-left:1px solid #eee6d9;display:flex;
    flex-direction:column;background:#fff}
  .apos-panel .ph{padding:12px 14px;border-bottom:1px solid #f0ead e0}
  .apos-panel .ph{border-bottom:1px solid #f0eade}
  .apos-panel .ph .t{font-weight:800;font-size:17px}
  .apos-panel .ph .s{font-size:11.5px;color:#7c8a80}
  .apos-items{flex:1;overflow:auto;padding:6px 14px}
  .irow{display:flex;justify-content:space-between;gap:8px;padding:7px 0;
    border-bottom:1px dashed #efe8da;font-size:13px}
  .irow .q{color:${GREEN};font-weight:800;min-width:26px}
  .irow .nm{flex:1}
  .irow .nt{font-size:10.5px;color:#9a8f7c;font-style:italic}
  .apos-total{display:flex;justify-content:space-between;padding:10px 14px;
    font-weight:800;font-size:17px;border-top:2px solid ${GREEN}}
  .apos-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px 14px}
  .abtn{border:1.5px solid ${GREEN};background:#fff;color:${GREEN};
    border-radius:10px;padding:11px 0;font-weight:800;font-size:12.5px;cursor:pointer}
  .abtn.solid{background:${GREEN};color:#fff}
  .abtn.wide{grid-column:1/3;font-size:14px;padding:13px 0}
  .ovl{position:absolute;inset:0;background:rgba(18,51,31,.45);display:flex;
    align-items:center;justify-content:center;z-index:50}
  .card{background:#fff;border-radius:16px;width:min(860px,94%);max-height:88%;
    display:flex;flex-direction:column;overflow:hidden}
  .card .ch{display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;background:${GREEN};color:#fff;font-weight:800}
  .card .ch button{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer}
  .mwrap{display:flex;min-height:430px}
  .mcourses{width:158px;border-right:1px solid #efe8da;overflow:auto;padding:8px}
  .mc{padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;
    cursor:pointer;color:#5d6b61;margin-bottom:2px}
  .mc.on{background:#eaf4ee;color:${GREEN}}
  .mitems{flex:1;padding:10px;overflow:auto;display:grid;gap:8px;
    grid-template-columns:repeat(auto-fill,minmax(150px,1fr));align-content:start}
  .mi{border:1px solid #e6dfd1;border-radius:10px;padding:9px;cursor:pointer;
    font-size:12.5px;background:${CREAM}}
  .mi b{display:block;color:${GREEN}}
  .mpend{width:236px;border-left:1px solid #efe8da;display:flex;flex-direction:column}
  .mpend .pl{flex:1;overflow:auto;padding:8px}
  .prow{font-size:12px;padding:6px;border-bottom:1px dashed #efe8da}
  .prow .st{display:flex;gap:6px;align-items:center;margin-top:3px}
  .prow button{width:24px;height:24px;border-radius:6px;border:1px solid ${GREEN};
    background:#fff;color:${GREEN};font-weight:800;cursor:pointer}
  .prow input{flex:1;border:1px solid #e6dfd1;border-radius:6px;font-size:11px;padding:3px 6px}
  .mwsearch{padding:8px 10px;border-bottom:1px solid #efe8da}
  .mwsearch input{width:100%;border:1.5px solid #e0d8c8;border-radius:9px;
    padding:9px 12px;font-size:13px}
  .tform{padding:18px;display:flex;flex-direction:column;gap:12px}
  .tform .big{font-size:30px;font-weight:800;text-align:center;color:${GREEN}}
  .trow{display:flex;gap:8px;align-items:center}
  .trow select,.trow input{border:1.5px solid #e0d8c8;border-radius:9px;
    padding:11px;font-size:15px}
  .trow input{flex:1;text-align:right;font-weight:700}
  .qcash{display:flex;gap:8px;justify-content:center}
  .qcash button{border:1.5px solid ${GREEN};background:#fff;color:${GREEN};
    border-radius:9px;padding:9px 14px;font-weight:800;cursor:pointer}
  .chg{text-align:center;font-size:15px}
  .chg b{color:${AMBER};font-size:22px}
  .msg{padding:10px 16px;font-size:13px;font-weight:700}
  .msg.err{color:#b3392f}.msg.ok{color:${GREEN}}
  .foot{padding:6px 16px;font-size:10px;color:#a89e8c;text-align:center;
    background:${CREAM};border-top:1px solid #eee6d9}
  .gr-pad{max-width:340px;margin:26px auto;text-align:center}
  .gr-pad input{font-size:26px;text-align:center;width:200px;border:2px solid ${GREEN};
    border-radius:12px;padding:10px}
  .gr-pad button{margin-left:10px}
  .atooltip{position:fixed;z-index:99;background:#12331f;color:#fff;
    padding:8px 11px;border-radius:9px;font-size:11px;max-width:250px;
    line-height:1.5;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .irow input[type=checkbox]{accent-color:#15855c;width:15px;height:15px}
  .thumb{width:100%;height:52px;object-fit:cover;border-radius:7px;
    margin-bottom:5px;background:#eee6d9}
  .thumb-ph{display:flex;align-items:center;justify-content:center;
    color:#15855c;font-size:20px}
  `;

  function api(method, args) {
    return new Promise((res) => {
      frappe.call({ method, args, callback: r => res(r.message || {}),
        error: () => res({ ok: 0, error: "Network / server error" }) });
    });
  }
  const fmt = n => "GHS " + (Number(n) || 0).toFixed(2);
  const esc = s => String(s || "").replace(/[<>&"]/g, c =>
    ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));

  async function refresh(light) {
    const [st, sg] = await Promise.all([
      api("atl_pos.api.kiosk", { action: "tables_status" }),
      api("atl_pos.api.bill", { action: "stats" })]);
    if (st.ok) STATE = st;
    if (sg.ok) STATS = sg;
    if (!MENU.items.length) {
      const m = await api("atl_pos.api.kiosk", { action: "menu" });
      if (m.ok) MENU = m;
    }
    render(light);
  }

  function minsSince(ts) {
    if (!ts || !STATE.now) return null;
    const d = (new Date(STATE.now.replace(" ", "T")) -
               new Date(ts.replace(" ", "T"))) / 60000;
    return Math.max(0, Math.round(d));
  }

  function tablesForRoom() {
    const t = STATE.tables || [];
    if (ROOM === "Take Away") return t.filter(x => x.is_take_away);
    if (ROOM === "Room Service")
      return t.filter(x => x.restaurant_room === "In-Room Dining");
    return t.filter(x => x.restaurant_room === ROOM && !x.is_take_away);
  }

  function render() {
    const shift = STATS.my_shift;
    root.innerHTML = `<style>${css}</style>
    <div class="apos" style="position:relative">
      <div class="apos-top">
        <img src="/files/atl_logo.png" onerror="this.style.display='none'">
        <div><div class="apos-brand">AGYEIWAA'S TABLE · POS</div>
          <div style="font-size:10.5px;color:#8a8272">there's always a seat for you</div></div>
        <div class="apos-strip">
          <div>Today<br><b>${fmt(STATS.today_revenue)}</b></div>
          <div>Open bills<br><b>${STATS.open_bills ?? "–"}</b></div>
          <div>Raybow folio<br><b>${fmt(STATS.folio_balance)}</b></div>
        </div>
        ${shift ? `<button class="apos-chip ghost">Shift open · ${esc(shift.name)}</button>`
                : `<button class="apos-chip" id="openShift">OPEN SHIFT</button>`}
        <button class="apos-chip ghost" id="rf">⟳</button>
      </div>
      <div class="apos-tabs">${ROOMS.map(r =>
        `<div class="apos-tab ${r === ROOM ? "on" : ""}" data-room="${r}">${r}</div>`).join("")}
      </div>
      <div class="apos-body">
        <div class="apos-grid" id="grid"></div>
        <div class="apos-panel" id="panel" style="display:none"></div>
      </div>
      <div class="foot">P9 Anita Mensah Street · Box 906, Takoradi · 0538819638</div>
      <div id="ovl"></div>
    </div>`;
    root.querySelectorAll(".apos-tab").forEach(el =>
      el.onclick = () => { ROOM = el.dataset.room; SEL = null; render(); });
    root.querySelector("#rf").onclick = () => refresh();
    const os = root.querySelector("#openShift");
    if (os) os.onclick = shiftOverlay;
    drawGrid();
    if (SEL) drawPanel();
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
        <div style="margin-top:18px;text-align:left">${occ.map(([t, bs]) =>
          bs.map(b => grCard(t, b)).join("")).join("") ||
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
      g.querySelectorAll("[data-bill]").forEach(el => el.onclick = () => {
        SEL = findBill(el.dataset.bill); drawPanel(); });
      return;
    }
    g.style.display = "grid";
    g.innerHTML = tablesForRoom().map(t => {
      const bs = (STATE.bills || {})[t.name] || [];
      if (!bs.length)
        return `<div class="tcard" data-new="${t.name}">
          <div class="tn">${t.name}</div><div class="seat">a seat for you</div></div>`;
      return bs.map(b => {
        const m = minsSince(b.last_kot);
        return `<div class="tcard occ" data-bill="${b.name}">
          <div class="tn">${t.name}</div>
          <div class="amt">${fmt(b.grand_total || b.total)}</div>
          <div class="w">${esc(b.waiter || "")}</div>
          ${b.custom_raybow_room ? `<div class="tag">⌂ ${esc(b.custom_raybow_room)}</div>` : ""}
          ${m !== null ? `<div class="mins ${m > 20 ? "hot" : ""}">${m}m</div>` : ""}
        </div>`;
      }).join("");
    }).join("");
    g.querySelectorAll("[data-new]").forEach(el => el.onclick = () => {
      SEL = { new_table: el.dataset.new }; drawPanel(); });
    g.querySelectorAll("[data-bill]").forEach(el => {
      el.onclick = () => { SEL = findBill(el.dataset.bill); drawPanel(); };
      const b = findBill(el.dataset.bill);
      if (b && b.summary) {
        el.onmouseenter = ev => {
          const t = document.createElement("div");
          t.className = "atooltip";
          t.innerHTML = `<b>${esc(b.name)}</b>${b.custom_guest_name ?
            " · " + esc(b.custom_guest_name) : ""}<br>${esc(b.summary)}`;
          document.body.appendChild(t); el._tt = t;
          const mv = e2 => { t.style.left = (e2.clientX + 14) + "px";
                             t.style.top = (e2.clientY + 12) + "px"; };
          mv(ev); el.onmousemove = mv;
        };
        el.onmouseleave = () => { if (el._tt) el._tt.remove(); el._tt = null; };
      }
    });
  }
  const grCard = (t, b) => `<div class="tcard occ" data-bill="${b.name}"
      style="margin-bottom:8px"><div class="tn">${t}</div>
      <div class="amt">${fmt(b.grand_total || b.total)}</div>
      ${b.custom_raybow_room ? `<div class="tag">⌂ ${esc(b.custom_raybow_room)}</div>` : ""}</div>`;
  function findBill(name) {
    for (const bs of Object.values(STATE.bills || {}))
      for (const b of bs) if (b.name === name) return b;
    return null;
  }

  async function drawPanel() {
    const p = root.querySelector("#panel");
    p.style.display = "flex";
    if (SEL && SEL.new_table) {
      p.innerHTML = `<div class="ph"><div class="t">${SEL.new_table}</div>
        <div class="s">New order</div></div>
        <div class="apos-items" style="display:flex;align-items:center;
          justify-content:center;color:#a89e8c;font-size:13px">
          No items yet. Add the first round.</div>
        <div class="apos-acts">
          <button class="abtn solid wide" id="addNew">+ ADD ITEMS</button>
          <button class="abtn wide" id="closeP">Close</button></div>`;
      p.querySelector("#addNew").onclick = () => menuOverlay(true);
      p.querySelector("#closeP").onclick = () => { SEL = null; p.style.display = "none"; };
      return;
    }
    const r = await api("atl_pos.api.bill", { action: "get_items", invoice: SEL.name });
    const items = r.items || [];
    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const charged = SEL.custom_charge_to_room;
    p.innerHTML = `<div class="ph"><div class="t">${esc(SEL.restaurant_table)}
        <span style="font-size:11px;color:#9aa79f">· ${esc(SEL.name)}</span></div>
      <div class="s">${esc(SEL.waiter || "")}${charged ?
        " · ⌂ Room " + esc(SEL.custom_raybow_room) : ""}
        · <a href="#" id="gname" style="color:#15855c;font-weight:700;
          text-decoration:none">${SEL.custom_guest_name ?
          esc(SEL.custom_guest_name) + " ✎" : "+ guest name"}</a></div></div>
      <div class="apos-items">${items.map(i => `<div class="irow">
        <input type="checkbox" data-ck="${esc(i.name)}">
        <div class="q">${Number(i.qty)}×</div>
        <div class="nm">${esc(i.item_name)}
          ${i.description && i.description !== i.item_name ?
            `<div class="nt">${esc(i.description)}</div>` : ""}</div>
        <div>${(Number(i.amount) || 0).toFixed(2)}</div></div>`).join("")}</div>
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
      await refresh(); SEL = findBill(SEL.name); drawPanel();
    };
    p.querySelector("#addMore").onclick = () => menuOverlay(false);
    p.querySelector("#preRc").onclick = () =>
      window.open(printUrl(SEL.name), "_blank");
    p.querySelector("#xfer").onclick = transferOverlay;
    p.querySelector("#chg").onclick = chargeOverlay;
    p.querySelector("#tender").onclick = () => tenderOverlay(total, charged);
  }
  const printUrl = n =>
    `/printview?doctype=POS%20Invoice&name=${encodeURIComponent(n)}` +
    `&format=ATL%20Thermal%20Receipt&no_letterhead=1`;

  /* ── menu overlay ───────────────────────────────────────── */
  let WAITERS = [];
  let PHOTOS = localStorage.getItem("atlpos_photos") !== "0";
  function menuOverlay(isNew) {
    PENDING = [];
    let main = null, sub = null, q = "", attendant = "", route = "";
    const ov = root.querySelector("#ovl");
    if (!WAITERS.length)
      api("atl_pos.api.kiosk", { action: "waiters" }).then(r => {
        if (r.ok) { WAITERS = r.waiters; draw(); } });
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
      const items = MENU.items.filter(inScope);
      const chips = q ? [] : (main ? (tree[main] || []) : mains);
      const crumb = q ? "Search results"
        : ["All", main && label(main), sub && label(sub)]
            .filter(Boolean).join(" / ");
      ov.innerHTML = `<div class="ovl"><div class="card">
        <div class="ch"><span>${isNew ? "New order · " + SEL.new_table
            : "Add to " + esc(SEL.restaurant_table)}</span>
          <button id="x">×</button></div>
        <div class="mwsearch" style="display:flex;gap:8px;align-items:center">
          <input id="ms" placeholder="Search the menu…" value="${esc(q)}" style="flex:1">
          <select id="att" title="Attendant" style="border:1.5px solid #e0d8c8;
            border-radius:9px;padding:9px;font-size:12.5px;max-width:170px">
            <option value="">Attendant: cashier</option>
            ${WAITERS.map(w => `<option ${w === attendant ? "selected" : ""}>${esc(w)}</option>`).join("")}
          </select>
          <button id="ph" title="Toggle photos" class="abtn"
            style="padding:8px 12px;${PHOTOS ? "background:#15855c;color:#fff" : ""}">📷</button>
          </div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
          border-bottom:1px solid #efe8da;flex-wrap:wrap">
          ${(main || sub || q) ? `<button class="abtn" id="up"
             style="padding:6px 12px">‹ Back</button>` : ""}
          <span style="font-size:11.5px;color:#8a8272;font-weight:700">${crumb}</span>
          ${chips.map(c => `<button class="mc" data-c="${esc(c)}"
            style="border:1.5px solid #15855c;background:${(sub||main)===c?"#15855c":"#fff"};
            color:${(sub||main)===c?"#fff":"#15855c"};border-radius:18px;
            padding:7px 14px;font-weight:800;font-size:12px;cursor:pointer">
            ${label(c)}</button>`).join("")}
        </div>
        <div class="mwrap">
          <div class="mitems" style="grid-template-columns:repeat(auto-fill,minmax(${PHOTOS ? "140px" : "160px"},1fr))">${items.map(i =>
            `<div class="mi" data-i="${esc(i.item)}">
             ${PHOTOS ? (i.image ?
               `<img class="thumb" src="${esc(i.image)}" loading="lazy">` :
               `<div class="thumb thumb-ph">🍽</div>`) : ""}
             <b>${esc(i.item_name)}</b>
             ${Number(i.rate).toFixed(2)}</div>`).join("")}</div>
          <div class="mpend"><div class="pl">${PENDING.map((pn, ix) =>
            `<div class="prow"><b>${esc(pn.item_name)}</b>
              <div style="display:flex;justify-content:space-between;font-size:11px;
                color:#5d6b61;margin-top:2px">
                <span>@ ${Number(pn.rate).toFixed(2)}</span>
                <b style="color:#15855c">${(pn.rate * pn.qty).toFixed(2)}</b></div>
              <div class="st"><button data-m="${ix}">−</button>
                <span style="font-weight:800">${pn.qty}</span>
                <button data-p="${ix}">+</button>
                <input data-n="${ix}" placeholder="note" value="${esc(pn.note)}"></div>
            </div>`).join("") ||
            "<div style='padding:14px;color:#a89e8c;font-size:12px'>Tap items to queue them.</div>"}</div>
            <div style="padding:8px 10px;border-top:1px solid #efe8da;font-size:12px;
              display:flex;justify-content:space-between">
              <span>${PENDING.reduce((s, x) => s + x.qty, 0)} item(s)</span>
              <b style="color:#15855c">${fmt(PENDING.reduce((s, x) =>
                s + x.rate * x.qty, 0))}</b></div>
            <div style="display:flex;gap:5px;padding:0 10px 6px">
              ${["", "Kitchen", "Bar"].map(r0 => `<button data-r="${r0}"
                class="abtn" style="flex:1;padding:6px 0;font-size:10.5px;
                ${route === r0 ? "background:#15855c;color:#fff" : ""}">
                ${r0 || "Auto route"}</button>`).join("")}</div>
            <div style="padding:0 10px 10px">
              <button class="abtn solid wide" id="fire" style="width:100%">
                SEND${PENDING.length ? " · " + PENDING.reduce((s, x) => s + x.qty, 0) + " item(s)" : ""}
              </button></div>
          </div>
        </div></div></div>`;
      ov.querySelector("#x").onclick = () => ov.innerHTML = "";
      const s = ov.querySelector("#ms");
      s.oninput = () => { q = s.value.toLowerCase(); draw(); s.focus();
        s.setSelectionRange(q.length, q.length); };
      ov.querySelectorAll(".mc").forEach(el => el.onclick = () => {
        const c = el.dataset.c; q = "";
        if (!main) { main = c; sub = null; }
        else if (!sub) sub = c;
        draw();
      });
      const up = ov.querySelector("#up");
      if (up) up.onclick = () => {
        if (q) q = "";
        else if (sub) sub = null;
        else main = null;
        draw();
      };
      const att = ov.querySelector("#att");
      if (att) att.onchange = () => { attendant = att.value; };
      ov.querySelector("#ph").onclick = () => {
        PHOTOS = !PHOTOS;
        localStorage.setItem("atlpos_photos", PHOTOS ? "1" : "0"); draw(); };
      ov.querySelectorAll("[data-r]").forEach(el => el.onclick = () => {
        route = el.dataset.r; draw(); });
      ov.querySelectorAll(".mi").forEach(el => el.onclick = () => {
        const it = MENU.items.find(x => x.item === el.dataset.i);
        const ex = PENDING.find(x => x.item === it.item && !x.note);
        if (ex) ex.qty += 1;
        else PENDING.push({ item: it.item, item_name: it.item_name,
                            rate: it.rate, qty: 1, note: "" });
        draw();
      });
      ov.querySelectorAll("[data-p]").forEach(el => el.onclick = () => {
        PENDING[el.dataset.p].qty += 1; draw(); });
      ov.querySelectorAll("[data-m]").forEach(el => el.onclick = () => {
        const i = el.dataset.m;
        PENDING[i].qty -= 1; if (PENDING[i].qty <= 0) PENDING.splice(i, 1);
        draw(); });
      ov.querySelectorAll("[data-n]").forEach(el => el.onchange = () => {
        PENDING[el.dataset.n].note = el.value; });
      ov.querySelector("#fire").onclick = fire;
    };
    const fire = async () => {
      if (!PENDING.length) return;
      const items = PENDING.map(x => ({ item: x.item, qty: x.qty, note: x.note }));
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
      root.querySelector("#ovl").innerHTML = "";
      await refresh();
      if (r.ok) { SEL = findBill(r.invoice) || SEL; drawPanel(); }
    };
    draw();
  }

  /* ── tender overlay ─────────────────────────────────────── */
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
              `<option ${m === l.mode ? "selected" : ""}>${m}</option>`).join("")}</select>
            <input data-a="${ix}" type="number" step="0.01" value="${l.amount}">
            ${lines.length > 1 ? `<button class="abtn" data-x="${ix}"
              style="padding:8px 12px">−</button>` : ""}
          </div>`).join("")}
          <div style="display:flex;justify-content:space-between">
            <button class="abtn" id="addLine" style="padding:8px 14px">+ split tender</button>
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
        root.querySelector("#panel").style.display = "none";
        refresh();
      };
    };
    draw();
  }

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
      if (SEL) drawPanel();
      else root.querySelector("#panel").style.display = "none";
    };
  }

  /* ── charge to room / transfer / shift ──────────────────── */
  function chargeOverlay() {
    const ov = root.querySelector("#ovl");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:400px">
      <div class="ch"><span>Charge to Raybow room</span><button id="x">×</button></div>
      <div class="tform">
        <div class="trow"><input id="cg" placeholder="Guest name (optional)"
          style="text-align:left"></div>
        <div class="trow"><input id="cr" placeholder="Raybow room no"
          inputmode="numeric" style="text-align:left"></div>
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
      SEL = findBill(SEL.name); drawPanel();
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
      ov.innerHTML = ""; SEL = null;
      root.querySelector("#panel").style.display = "none"; refresh();
    };
  }
  function shiftOverlay() {
    const ov = root.querySelector("#ovl");
    ov.innerHTML = `<div class="ovl"><div class="card" style="width:380px">
      <div class="ch"><span>Open shift</span><button id="x">×</button></div>
      <div class="tform">
        <div class="trow"><span style="min-width:120px;font-weight:700">Cash float</span>
          <input id="sf" type="number" step="0.01" value="0"></div>
        <button class="abtn solid wide" id="go">OPEN &amp; SUBMIT</button>
        <div class="msg err" id="serr"></div>
      </div></div></div>`;
    ov.querySelector("#x").onclick = () => ov.innerHTML = "";
    ov.querySelector("#go").onclick = async () => {
      const r = await api("atl_pos.api.bill", { action: "open_shift",
        payload: JSON.stringify({ cash: ov.querySelector("#sf").value }) });
      if (!r.ok) { ov.querySelector("#serr").textContent = r.error; return; }
      ov.innerHTML = ""; refresh();
    };
  }

  refresh();
  POLL = setInterval(() => { if (!root.querySelector(".ovl")) refresh(); }, 25000);
})();
});
