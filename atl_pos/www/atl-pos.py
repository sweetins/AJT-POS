# Copyright (c) 2026, Agyeiwaa's Table Limited
import frappe

ALLOWED = {"URY Cashier", "URY Manager", "System Manager", "ATL Kiosk"}


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/atl-pos"
        raise frappe.Redirect

    if not (ALLOWED & set(frappe.get_roles(frappe.session.user))):
        frappe.throw("You do not have access to the ATL POS.",
                     frappe.PermissionError)

    context.no_cache = 1
    context.show_sidebar = False
    context.title = "ATL POS"
    return context
