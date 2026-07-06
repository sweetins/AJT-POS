# Copyright (c) 2026, Agyeiwaa's Table Limited
# Whitelisted POS API for the ATL console. Ported from the proven, battle-tested
# server-script logic (RestrictedPython) into a normal Frappe app module.
import json
import frappe
from frappe.utils import flt, today, now


def _fail(msg):
    return {"ok": 0, "error": msg}


# ---------- kiosk helpers ----------
# atl_kiosk_api v3: waiter kiosk + cashier console ordering.
# Actions: auth, menu, tables, tables_status, place_order, append_to_order.
# place_order accepts a waiter PIN (mounts) or, with no pin, a logged-in
# URY Cashier session (console): waiter is then the cashier's name.



def waiter_by_pin(pin):
    return frappe.db.get_value("Employee",
        {"custom_pos_pin": pin, "company": "Agyeiwaa's Table Limited",
         "status": "Active"}, ["name", "employee_name"], as_dict=True)

def is_cashier(user):
    if user == "Administrator":
        return True
    return bool(frappe.db.get_value("Has Role",
        {"parent": user, "role": ["in", ["URY Cashier", "URY Manager"]],
         "parenttype": "User"}, "name"))

def menu_map():
    rows = frappe.db.get_all("URY Menu Item",
        filters={"parent": "ATL Master Menu", "disabled": 0},
        fields=["item", "item_name", "rate", "course"], order_by="idx")
    m = {}
    for r in rows:
        m[r.item] = r
    return m

def cut_kots(inv_doc, sent_rows, order_type, route=None):
    units = frappe.db.get_all("URY Production Unit",
        filters={"branch": "RIT Branch"}, fields=["name", "production"])
    routing = {}
    for u in units:
        for g in frappe.db.get_all("URY Production Item Groups",
                filters={"parent": u.name}, fields=["item_group"]):
            routing[g.item_group] = u.production
    grouped = {}
    for r in sent_rows:
        if route in ("Kitchen", "Bar"):
            unit = route
        else:
            grp = frappe.db.get_value("Item", r["item_code"], "item_group")
            unit = routing.get(grp, "Kitchen")
        grouped.setdefault(unit, []).append(r)
    made = []
    prefix = "TAKE AWAY. " if order_type == "Take Away" else ""
    for unit, rows in grouped.items():
        kot = frappe.get_doc({"doctype": "URY KOT",
            "naming_series": "KOT-ATL-.#####",
            "invoice": inv_doc.name, "restaurant_table": inv_doc.restaurant_table,
            "production": unit, "type": "New Order",
            "pos_profile": "ATL Main POS",
            "kot_items": [{"item": r["item_code"], "item_name": r["item_name"],
                "quantity": r["qty"],
                "comments": (prefix + (r.get("note") or "")).strip()}
                for r in rows]})
        kot.insert(ignore_permissions=True)
        made.append({"kot": kot.name, "unit": unit, "items": len(rows)})
    return made

def build_rows(items, mm):
    rows, total = [], 0
    for l in items:
        it = mm.get(l.get("item"))
        if not it:
            continue
        qty = frappe.utils.flt(l.get("qty") or 1)
        amt = frappe.utils.flt(it.rate) * qty
        total = total + amt
        rows.append({"item_code": it.item, "item_name": it.item_name,
            "qty": qty, "rate": it.rate, "amount": amt, "uom": "Nos",
            "stock_uom": "Nos", "conversion_factor": 1,
            "description": ((l.get("note") or "").strip() or it.item_name)})
    return rows, total


@frappe.whitelist()
def kiosk(action=None, payload=None, **kw):
    """Waiter kiosk + cashier console ordering dispatcher."""
    kw['payload'] = payload


    if action == "auth":
        w = waiter_by_pin(kw.get("pin") or "")
        if w:
            return {"ok": 1, "waiter": w.employee_name}
        else:
            return _fail("Unknown PIN")

    elif action == "menu":
        rows = frappe.db.get_all("URY Menu Item",
            filters={"parent": "ATL Master Menu", "disabled": 0},
            fields=["item", "item_name", "rate", "course"], order_by="idx")
        groups = {}
        for it in frappe.db.get_all("Item",
                filters={"item_code": ["like", "ATL-%"]},
                fields=["item_code", "item_group"]):
            groups[it.item_code] = it.item_group
        images = {}
        for it in frappe.db.get_all("Item",
                filters={"item_code": ["like", "ATL-%"], "image": ["!=", ""]},
                fields=["item_code", "image"]):
            images[it.item_code] = it.image
        for r in rows:
            r["item_group"] = groups.get(r.item)
            r["image"] = images.get(r.item)
        mains = ["ATL Food", "ATL Drinks", "ATL Services"]
        tree = {}
        for m in mains:
            subs = frappe.db.get_all("Item Group",
                filters={"parent_item_group": m}, fields=["name"],
                order_by="name")
            tree[m] = [s.name for s in subs]
        courses = []
        for r in rows:
            if r.course not in courses:
                courses.append(r.course)
        return {"ok": 1, "courses": courses,
            "items": rows, "tree": tree}

    elif action == "tables":
        room = kw.get("room") or "Restaurant Main"
        fl = ["name", "occupied", "is_take_away", "restaurant_room"]
        rows = frappe.db.get_all("URY Table",
            filters={"restaurant_room": room, "is_take_away": 0},
            fields=fl, order_by="name")
        rows = rows + frappe.db.get_all("URY Table",
            filters={"is_take_away": 1}, fields=fl, order_by="name")
        if room != "In-Room Dining":
            rows = rows + frappe.db.get_all("URY Table",
                filters={"restaurant_room": "In-Room Dining", "is_take_away": 0},
                fields=fl, order_by="name")
        return {"ok": 1, "tables": rows}

    elif action == "waiters":
        rows = frappe.db.get_all("Employee",
            filters={"company": "Agyeiwaa's Table Limited", "status": "Active",
                     "designation": "Waiter / Waitress"},
            fields=["employee_name"], order_by="employee_name")
        return {"ok": 1,
            "waiters": [r.employee_name for r in rows]}

    elif action == "tables_status":
        if not is_cashier(frappe.session.user):
            return _fail("Cashier role required")
        else:
            tables = frappe.db.get_all("URY Table",
                fields=["name", "restaurant_room", "is_take_away"],
                order_by="name")
            invs = frappe.db.get_all("POS Invoice",
                filters={"docstatus": 0, "pos_profile": "ATL Main POS"},
                fields=["name", "restaurant_table", "waiter", "grand_total",
                        "total", "customer", "custom_raybow_room",
                        "custom_charge_to_room", "custom_guest_name",
                        "order_type"])
            lines = frappe.db.get_all("POS Invoice Item",
                filters={"parent": ["in", [i.name for i in invs] or ["x"]],
                         "item_code": ["!=", "ATL-SV01"]},
                fields=["parent", "item_name", "qty"], order_by="idx")
            summ = {}
            for l in lines:
                summ.setdefault(l.parent, []).append(
                    str(int(l.qty)) + "x " + l.item_name)
            kots = frappe.db.get_all("URY KOT",
                filters={"invoice": ["in", [i.name for i in invs] or ["x"]]},
                fields=["invoice", "creation"], order_by="creation")
            lastkot = {}
            for k in kots:
                lastkot[k.invoice] = str(k.creation)
            bills = {}
            for i in invs:
                e = dict(i)
                e["last_kot"] = lastkot.get(i.name)
                sm = summ.get(i.name) or []
                e["summary"] = ", ".join(sm[:5]) +                 (" +" + str(len(sm) - 5) + " more" if len(sm) > 5 else "")
                bills.setdefault(i.restaurant_table, []).append(e)
            return {"ok": 1,
                "now": frappe.utils.now(),
                "tables": tables, "bills": bills}

    elif action == "place_order":
        payload = json.loads(payload or "{}")
        pin = (payload.get("pin") or "").strip()
        waiter = None
        if pin:
            w = waiter_by_pin(pin)
            if w:
                waiter = w.employee_name
        elif is_cashier(frappe.session.user):
            attendant = (payload.get("attendant") or "").strip()
            if attendant and frappe.db.exists("Employee",
                    {"employee_name": attendant,
                     "company": "Agyeiwaa's Table Limited", "status": "Active"}):
                waiter = attendant
            else:
                waiter = frappe.db.get_value("Employee",
                    {"user_id": frappe.session.user}, "employee_name") or \
                    frappe.session.user
        if not waiter:
            return _fail("Unknown PIN")
        else:
            table = payload.get("table")
            order_type = payload.get("order_type") or "Dine In"
            if order_type == "Room Service":
                order_type = "Dine In"
            if order_type not in ("Dine In", "Take Away"):
                order_type = "Dine In"
            if not frappe.db.exists("URY Table", {"name": table}):
                return _fail("Unknown table " + str(table))
            else:
                mm = menu_map()
                rows, total = build_rows(payload.get("items") or [], mm)
                if not rows:
                    return _fail("No valid items")
                else:
                    if str(table).startswith("GR-"):
                        svc = frappe.db.get_value("URY Menu Item",
                            {"parent": "ATL Master Menu", "item": "ATL-SV01"},
                            ["item", "item_name", "rate"], as_dict=True)
                        if svc:
                            rows.insert(0, {"item_code": svc.item,
                                "item_name": svc.item_name, "qty": 1,
                                "rate": svc.rate,
                                "amount": frappe.utils.flt(svc.rate),
                                "uom": "Nos", "stock_uom": "Nos",
                                "conversion_factor": 1,
                                "description": svc.item_name})
                            total = total + frappe.utils.flt(svc.rate)
                    inv = frappe.get_doc({"doctype": "POS Invoice",
                        "naming_series": "ATL-",
                        "company": "Agyeiwaa's Table Limited",
                        "customer": "Walk-In Customer", "is_pos": 1,
                        "pos_profile": "ATL Main POS",
                        "selling_price_list": "ATL Menu", "currency": "GHS",
                        "conversion_rate": 1, "plc_conversion_rate": 1,
                        "price_list_currency": "GHS",
                        "posting_date": frappe.utils.today(),
                        "due_date": frappe.utils.today(),
                        "restaurant_table": table, "order_type": order_type,
                        "waiter": waiter,
                        "taxes_and_charges": "ATL Inclusive Taxes - ATL",
                        "items": rows})
                    inv.insert(ignore_permissions=True)
                    kot_rows = [r for r in rows if r["item_code"] != "ATL-SV01"]
                    kots = cut_kots(inv, kot_rows, order_type, payload.get("route"))
                    return {"ok": 1, "invoice": inv.name,
                        "table": table, "waiter": waiter, "total": total,
                        "kots": kots}

    elif action == "append_to_order":
        if not is_cashier(frappe.session.user):
            return _fail("Cashier role required")
        else:
            frappe.flags.atl_bill_ops = 1
            payload = json.loads(payload or "{}")
            if not frappe.db.exists("POS Invoice", payload.get("invoice") or "x"):
                return _fail("Unknown bill")
                inv = None
            else:
                inv = frappe.get_doc("POS Invoice", payload.get("invoice"))
            if inv is None:
                pass
            elif inv.docstatus != 0:
                return _fail("Bill is already settled")
            else:
                mm = menu_map()
                rows, added = build_rows(payload.get("items") or [], mm)
                if not rows:
                    return _fail("No valid items")
                else:
                    for r in rows:
                        inv.append("items", dict(r))
                    inv.save(ignore_permissions=True)
                    kots = cut_kots(inv, rows, inv.order_type, payload.get("route"))
                    gt = 0
                    for it in frappe.db.get_all("POS Invoice Item",
                            filters={"parent": inv.name}, fields=["amount"]):
                        gt = gt + frappe.utils.flt(it.amount)
                    return {"ok": 1, "invoice": inv.name,
                        "added": added, "total": gt, "kots": kots}

    else:
        return _fail("Unknown action")



# ---------- bill-ops helpers ----------
# atl_bill_api v3: cashier operations + shift + settlement + stats.
# Actions: list_open, get_items, split_bill, merge_bills, transfer_table,
# charge_to_room, open_shift, settle, stats.
# frappe.db.sql is SELECT-only in server scripts; writes use set_value /
# doc.save / delete_doc. "Raybow Folio" is a payment mode into a clearing
# account; a room-charged bill settled to it is PAID into that account and
# the account balance is what Raybow owes ATL.



def is_cashier(user):
    if user == "Administrator":
        return True
    return bool(frappe.db.get_value("Has Role",
        {"parent": user, "role": ["in", ["URY Cashier", "URY Manager"]],
         "parenttype": "User"}, "name"))

def recalc_totals(name):
    rows = frappe.db.get_all("POS Invoice Item", filters={"parent": name},
                             fields=["amount"])
    total = 0
    for r in rows:
        total = total + frappe.utils.flt(r.amount)
    net = round(total / 1.219, 2)
    frappe.db.set_value("POS Invoice", name,
        {"total": total, "base_total": total, "net_total": net,
         "base_net_total": net, "grand_total": total,
         "base_grand_total": total, "rounded_total": total,
         "base_rounded_total": total})
    return total

def copy_row(it):
    return {"item_code": it.item_code, "item_name": it.item_name,
            "qty": it.qty, "rate": it.rate, "amount": it.amount,
            "uom": "Nos", "stock_uom": "Nos", "conversion_factor": 1,
            "income_account": it.income_account,
            "cost_center": it.cost_center, "warehouse": it.warehouse,
            "description": it.description or it.item_name}

user = frappe.session.user


@frappe.whitelist()
def bill(action=None, payload=None, **kw):
    """Cashier operations, shift, settlement, stats dispatcher."""
    kw['payload'] = payload
    user = frappe.session.user


    if not is_cashier(user):
        return _fail("Cashier or Manager role required")

    elif action == "list_open":
        rows = frappe.db.get_all("POS Invoice",
            filters={"docstatus": 0, "pos_profile": "ATL Main POS"},
            fields=["name", "restaurant_table", "waiter", "grand_total",
                    "customer", "custom_raybow_room"],
            order_by="restaurant_table")
        return {"ok": 1, "invoices": rows}

    elif action == "get_items":
        inv = kw.get("invoice")
        rows = frappe.db.get_all("POS Invoice Item", filters={"parent": inv},
            fields=["name", "item_code", "item_name", "qty", "rate", "amount"],
            order_by="idx")
        return {"ok": 1, "items": rows}

    elif action == "split_bill":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        src = frappe.get_doc("POS Invoice", p.get("invoice"))
        rows = p.get("rows") or []
        if src.docstatus != 0:
            return _fail("Only unbilled (draft) orders can be split")
        elif not rows or len(rows) >= len(src.items):
            return _fail("Select some, but not all, items to split off")
        else:
            target_table = p.get("target_table") or src.restaurant_table
            moved = [it for it in src.items if it.name in rows]
            kept = [it for it in src.items if it.name not in rows]
            new = frappe.get_doc({"doctype": "POS Invoice",
                "naming_series": "ATL-", "company": src.company,
                "customer": src.customer, "is_pos": 1,
                "pos_profile": src.pos_profile,
                "selling_price_list": src.selling_price_list,
                "currency": src.currency, "conversion_rate": 1,
                "plc_conversion_rate": 1, "price_list_currency": src.currency,
                "posting_date": frappe.utils.today(),
                "due_date": frappe.utils.today(),
                "restaurant_table": target_table, "order_type": src.order_type,
                "waiter": src.waiter, "taxes_and_charges": src.taxes_and_charges,
                "custom_split_from": src.name,
                "items": [copy_row(it) for it in moved]})
            new.insert(ignore_permissions=True)
            src.items = kept
            src.save(ignore_permissions=True)
            t1 = recalc_totals(src.name)
            t2 = recalc_totals(new.name)
            return {"ok": 1, "source": src.name,
                "source_total": t1, "new_invoice": new.name, "new_total": t2,
                "new_table": target_table}

    elif action == "merge_bills":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        sname, tname = p.get("source"), p.get("target")
        if sname == tname:
            return _fail("Source and target are the same bill")
        else:
            sdoc = frappe.get_doc("POS Invoice", sname)
            tdoc = frappe.get_doc("POS Invoice", tname)
            if sdoc.docstatus != 0 or tdoc.docstatus != 0:
                return _fail("Both bills must be open (draft)")
            else:
                for it in sdoc.items:
                    tdoc.append("items", copy_row(it))
                trail = tdoc.get("custom_merged_from") or ""
                trail = (trail + "; " if trail else "") + sname + \
                    " (" + (sdoc.restaurant_table or "") + ")"
                tdoc.custom_merged_from = trail
                tdoc.save(ignore_permissions=True)
                for k in frappe.db.get_all("URY KOT",
                        filters={"invoice": sname}, fields=["name"]):
                    frappe.db.set_value("URY KOT", k.name, "invoice", tname)
                frappe.delete_doc("POS Invoice", sname, force=1,
                                  ignore_permissions=True)
                total = recalc_totals(tname)
                return {"ok": 1, "target": tname,
                    "target_total": total, "absorbed": sname}

    elif action == "move_items":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        sname, tname = p.get("source"), p.get("target")
        rows = p.get("rows") or []
        if sname == tname:
            return _fail("Source and target are the same bill")
        elif not frappe.db.exists("POS Invoice", sname or "x") or             not frappe.db.exists("POS Invoice", tname or "x"):
            return _fail("Unknown bill")
        else:
            sdoc = frappe.get_doc("POS Invoice", sname)
            tdoc = frappe.get_doc("POS Invoice", tname)
            if sdoc.docstatus != 0 or tdoc.docstatus != 0:
                return _fail("Both bills must be open (draft)")
            elif not rows:
                return _fail("Select items to move")
            else:
                moving = [it for it in sdoc.items if it.name in rows]
                keeping = [it for it in sdoc.items if it.name not in rows]
                for it in moving:
                    tdoc.append("items", copy_row(it))
                trail = tdoc.get("custom_merged_from") or ""
                tag = sname + (" (all)" if not keeping else
                               " (" + str(len(moving)) + " items)")
                tdoc.custom_merged_from = (trail + "; " if trail else "") + tag
                tdoc.save(ignore_permissions=True)
                if keeping:
                    sdoc.items = keeping
                    sdoc.save(ignore_permissions=True)
                    t1 = recalc_totals(sname)
                else:
                    for kk in frappe.db.get_all("URY KOT",
                            filters={"invoice": sname}, fields=["name"]):
                        frappe.db.set_value("URY KOT", kk.name, "invoice", tname)
                    frappe.delete_doc("POS Invoice", sname, force=1,
                                      ignore_permissions=True)
                    t1 = 0
                t2 = recalc_totals(tname)
                return {"ok": 1, "source": sname,
                    "source_total": t1, "source_gone": 0 if keeping else 1,
                    "target": tname, "target_total": t2,
                    "moved": len(moving)}

    elif action == "name_bill":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        inv = p.get("invoice")
        guest = (p.get("guest") or "").strip()
        d = frappe.db.get_value("POS Invoice", inv, "docstatus")
        if d != 0:
            return _fail("Only open bills can be named")
        else:
            frappe.db.set_value("POS Invoice", inv, "custom_guest_name", guest)
            return {"ok": 1, "invoice": inv, "guest": guest}

    elif action == "transfer_table":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        inv, table = p.get("invoice"), p.get("table")
        d = frappe.db.get_value("POS Invoice", inv, "docstatus")
        if d != 0:
            return _fail("Only open (draft) orders can be transferred")
        elif not frappe.db.exists("URY Table", {"name": table}):
            return _fail("Unknown table " + str(table))
        else:
            frappe.db.set_value("POS Invoice", inv, "restaurant_table", table)
            for k in frappe.db.get_all("URY KOT", filters={"invoice": inv},
                                       fields=["name"]):
                frappe.db.set_value("URY KOT", k.name, "restaurant_table", table)
            return {"ok": 1, "invoice": inv, "table": table}

    elif action == "charge_to_room":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        inv = p.get("invoice")
        room_no = (p.get("room") or "").strip()
        guest = (p.get("guest") or "").strip()
        d = frappe.db.get_value("POS Invoice", inv, "docstatus")
        if d != 0:
            return _fail("Only open (draft) bills can be charged to a room")
        elif not room_no:
            return _fail("Raybow room number is required")
        else:
            frappe.db.set_value("POS Invoice", inv,
                {"customer": "Raybow International Hotel Ltd. (Guest Folio)",
                 "customer_name": "Raybow International Hotel Ltd. (Guest Folio)",
                 "custom_charge_to_room": 1,
                 "custom_guest_name": guest,
                 "custom_raybow_room": room_no})
            return {"ok": 1, "invoice": inv,
                "room": room_no, "guest": guest}

    elif action == "open_shift":
        p = json.loads(payload or "{}")
        existing = frappe.db.get_value("POS Opening Entry",
            {"user": user, "status": "Open", "docstatus": 1,
             "posting_date": frappe.utils.today()}, "name")
        if existing:
            return {"ok": 1, "opening": existing,
                                          "already": 1}
        else:
            bal = [{"mode_of_payment": "Cash",
                    "opening_amount": frappe.utils.flt(p.get("cash") or 0)}]
            if p.get("momo") is not None:
                bal.append({"mode_of_payment": "Mobile Money",
                            "opening_amount": frappe.utils.flt(p.get("momo"))})
            if p.get("card") is not None:
                bal.append({"mode_of_payment": "Credit Card",
                            "opening_amount": frappe.utils.flt(p.get("card"))})
            op = frappe.get_doc({"doctype": "POS Opening Entry",
                "period_start_date": frappe.utils.now(),
                "posting_date": frappe.utils.today(),
                "company": "Agyeiwaa's Table Limited",
                "pos_profile": "ATL Main POS", "user": user,
                "restaurant": "Agyeiwaa's Table", "branch": "RIT Branch",
                "balance_details": bal})
            op.insert(ignore_permissions=True)
            op.submit()
            return {"ok": 1, "opening": op.name,
                                          "already": 0}

    elif action == "settle":
        frappe.flags.atl_bill_ops = 1
        p = json.loads(payload or "{}")
        if not frappe.db.exists("POS Invoice", p.get("invoice") or "x"):
            return _fail("Unknown bill " + str(p.get("invoice")))
            tenders = []
            inv = None
        else:
            inv = frappe.get_doc("POS Invoice", p.get("invoice"))
        tenders = (p.get("tenders") or []) if inv else []
        if inv is None:
            pass
        elif inv.docstatus != 0:
            return _fail("Bill is already settled")
        elif not tenders:
            return _fail("At least one tender is required")
        else:
            grand = 0
            for it in inv.items:
                grand = grand + frappe.utils.flt(it.amount)
            inv.set("payments", [])
            paid = 0
            for t in tenders:
                amt = frappe.utils.flt(t.get("amount") or 0)
                if amt <= 0:
                    continue
                paid = paid + amt
                inv.append("payments", {"mode_of_payment": t.get("mode"),
                                        "amount": amt, "base_amount": amt})
            if paid + 0.005 < grand:
                return _fail("Tendered " + str(paid) + " is less than the bill " +
                         str(grand))
            else:
                change = round(paid - grand, 2)
                inv.paid_amount = paid
                inv.base_paid_amount = paid
                inv.change_amount = change if change > 0 else 0
                inv.base_change_amount = inv.change_amount
                inv.save(ignore_permissions=True)
                inv.submit()
                return {"ok": 1, "invoice": inv.name,
                    "paid": paid, "change": inv.change_amount,
                    "status": "Paid"}

    elif action == "stats":
        today = frappe.utils.today()
        rev = 0
        for r in frappe.db.get_all("POS Invoice",
                filters={"docstatus": 1, "posting_date": today},
                fields=["grand_total"]):
            rev = rev + frappe.utils.flt(r.grand_total)
        folio = 0
        for g in frappe.db.get_all("GL Entry",
                filters={"account": "Raybow Guest Folio - ATL",
                         "is_cancelled": 0},
                fields=["debit", "credit"]):
            folio = folio + frappe.utils.flt(g.debit) - frappe.utils.flt(g.credit)
        myshift = frappe.db.get_value("POS Opening Entry",
            {"user": user, "status": "Open", "docstatus": 1,
             "posting_date": today}, ["name", "period_start_date"], as_dict=True)
        return {"ok": 1, "today_revenue": rev,
            "open_bills": frappe.db.count("POS Invoice", {"docstatus": 0}),
            "folio_balance": folio,
            "my_shift": myshift}

    else:
        if is_cashier(user):
            return _fail("Unknown action")

