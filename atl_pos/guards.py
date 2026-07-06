# Copyright (c) 2026, Agyeiwaa's Table Limited
# Server-side guards for the ATL POS. These replace the former database
# server scripts "ATL Guard Item Removal" and "ATL Employee Company Pin".
import frappe
from frappe.utils import flt

COMPANY = "Agyeiwaa's Table Limited"
PROFILE = "ATL Main POS"


def guard_item_removal(doc, method=None):
    """Once a KOT exists for a bill, block removing or reducing its items unless
    an Auditor is doing it, or an authorised bill operation set the flag."""
    if getattr(doc, "pos_profile", None) != PROFILE:
        return
    if getattr(doc, "company", None) != COMPANY:
        return
    if frappe.flags.get("atl_bill_ops"):
        return
    user = frappe.session.user
    if user == "Administrator":
        return
    if "Auditor" in frappe.get_roles(user):
        return
    if not doc.name or doc.is_new():
        return
    if not frappe.db.exists("URY KOT", {"invoice": doc.name}):
        return

    old = {}
    for r in frappe.db.get_all("POS Invoice Item",
                               filters={"parent": doc.name},
                               fields=["name", "qty", "item_name"]):
        old[r.name] = r
    new_qty = {}
    for it in doc.items:
        if it.name:
            new_qty[it.name] = flt(it.qty)

    for rid, row in old.items():
        if rid not in new_qty or new_qty[rid] < flt(row.qty):
            frappe.throw(
                "Removing or reducing items after a KOT has been sent requires "
                "the Auditor. Blocked change on: {0}".format(row.item_name),
                title="Auditor Required",
            )


def pin_company(doc, method=None):
    """Pin every Agyeiwaa's Table employee's user to the ATL company via a
    default User Permission, so their POS forms scope correctly."""
    if getattr(doc, "company", None) != COMPANY:
        return
    user = getattr(doc, "user_id", None)
    if not user:
        return
    exists = frappe.db.exists("User Permission", {
        "user": user, "allow": "Company", "for_value": COMPANY,
    })
    if exists:
        return
    try:
        perm = frappe.get_doc({
            "doctype": "User Permission",
            "user": user,
            "allow": "Company",
            "for_value": COMPANY,
            "apply_to_all_doctypes": 1,
            "is_default": 1,
        })
        perm.insert(ignore_permissions=True)
    except Exception:
        frappe.log_error(title="ATL pin_company failed",
                         message=frappe.get_traceback())
