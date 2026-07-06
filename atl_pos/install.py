# Copyright (c) 2026, Agyeiwaa's Table Limited
# Idempotent post-install setup. Every step checks first, so this is safe to run
# on the already-configured production site (it will mostly skip) and also stands
# a fresh site up. Nothing here raises; failures are logged and install proceeds.
import frappe

COMPANY = "Agyeiwaa's Table Limited"
ABBR = "ATL"
PROFILE = "ATL Main POS"
FOLIO_ACCOUNT = "Raybow Guest Folio - " + ABBR
FOLIO_MODE = "Raybow Folio"
FOLIO_CUSTOMER = "Raybow International Hotel Ltd. (Guest Folio)"


def after_install():
    for step in (
        _folio_account, _folio_mode, _profile_payment,
        _charge_fields, _guest_field, _folio_customer,
        _retire_old_server_scripts,
    ):
        try:
            step()
        except Exception:
            frappe.log_error(title="ATL POS install: " + step.__name__,
                             message=frappe.get_traceback())
    frappe.db.commit()


def _has_company():
    return frappe.db.exists("Company", COMPANY)


def _folio_account():
    if not _has_company():
        return
    if frappe.db.exists("Account", FOLIO_ACCOUNT):
        return
    parent = "Bank Accounts - " + ABBR
    if not frappe.db.exists("Account", parent):
        parent = frappe.db.get_value(
            "Account", {"company": COMPANY, "account_type": "Bank",
                        "is_group": 1}, "name")
    frappe.get_doc({
        "doctype": "Account", "account_name": "Raybow Guest Folio",
        "company": COMPANY, "parent_account": parent,
        "account_type": "Bank", "account_currency": "GHS", "is_group": 0,
    }).insert(ignore_permissions=True)


def _folio_mode():
    if frappe.db.exists("Mode of Payment", FOLIO_MODE):
        return
    if not frappe.db.exists("Account", FOLIO_ACCOUNT):
        return
    frappe.get_doc({
        "doctype": "Mode of Payment", "mode_of_payment": FOLIO_MODE,
        "type": "Bank", "enabled": 1,
        "accounts": [{"company": COMPANY, "default_account": FOLIO_ACCOUNT}],
    }).insert(ignore_permissions=True)


def _profile_payment():
    if not frappe.db.exists("POS Profile", PROFILE):
        return
    if frappe.db.exists("POS Payment Method",
                        {"parent": PROFILE, "mode_of_payment": FOLIO_MODE}):
        return
    prof = frappe.get_doc("POS Profile", PROFILE)
    prof.append("payments", {"mode_of_payment": FOLIO_MODE,
                             "default": 0, "allow_in_returns": 0})
    prof.save(ignore_permissions=True)


def _cf(dt, fieldname, spec):
    if frappe.db.exists("Custom Field", {"dt": dt, "fieldname": fieldname}):
        return
    doc = {"doctype": "Custom Field", "dt": dt, "fieldname": fieldname}
    doc.update(spec)
    frappe.get_doc(doc).insert(ignore_permissions=True)


def _charge_fields():
    _cf("POS Invoice", "custom_charge_to_room",
        {"label": "Charge to Raybow Room", "fieldtype": "Check",
         "insert_after": "order_type"})
    _cf("POS Invoice", "custom_raybow_room",
        {"label": "Raybow Room No", "fieldtype": "Data",
         "insert_after": "custom_charge_to_room",
         "depends_on": "custom_charge_to_room"})
    _cf("POS Invoice", "custom_split_from",
        {"label": "Split From", "fieldtype": "Data", "read_only": 1,
         "insert_after": "custom_raybow_room"})
    _cf("POS Invoice", "custom_merged_from",
        {"label": "Merged From", "fieldtype": "Small Text", "read_only": 1,
         "insert_after": "custom_split_from"})


def _guest_field():
    _cf("POS Invoice", "custom_guest_name",
        {"label": "Guest Name", "fieldtype": "Data",
         "insert_after": "customer"})


def _folio_customer():
    if frappe.db.exists("Customer", FOLIO_CUSTOMER):
        return
    grp = frappe.db.get_value("Customer Group",
                              {"is_group": 0}, "name") or "All Customer Groups"
    territory = frappe.db.get_value("Territory",
                                    {"is_group": 0}, "name") or "All Territories"
    frappe.get_doc({
        "doctype": "Customer", "customer_name": FOLIO_CUSTOMER,
        "customer_type": "Company", "customer_group": grp,
        "territory": territory,
    }).insert(ignore_permissions=True)


def _retire_old_server_scripts():
    """The app now provides these via hooks; disable the database copies so the
    logic does not fire twice. Harmless if they were never created."""
    for name in ("ATL Guard Item Removal", "ATL Employee Company Pin"):
        if frappe.db.exists("Server Script", name):
            frappe.db.set_value("Server Script", name, "disabled", 1)
