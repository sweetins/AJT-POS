app_name = "atl_pos"
app_title = "Agyeiwaa's Table POS"
app_publisher = "Agyeiwaa's Table Limited"
app_description = "Branded restaurant POS console for Agyeiwaa's Table, on top of ERPNext + URY."
app_email = "info@agyeiwaastable.com"
app_license = "mit"

# ERPNext must be present (POS Invoice, accounts). URY must also be installed on
# the bench (URY KOT / URY Menu / URY Table); it is not enforced here because it
# is not a registry app, but the console will not function without it.
required_apps = ["erpnext"]

# One-time, idempotent setup of the objects the console relies on. Everything is
# guarded by an existence check, so installing on an already-configured site is a
# no-op and installing on a fresh site stands the pieces up.
after_install = "atl_pos.install.after_install"

# Server-side guards, moved out of database server scripts into version control.
doc_events = {
    "POS Invoice": {
        "before_save": "atl_pos.guards.guard_item_removal",
    },
    "Employee": {
        "after_insert": "atl_pos.guards.pin_company",
        "on_update": "atl_pos.guards.pin_company",
    },
}

# Website page /atl-pos is provided by www/atl-pos.html + www/atl-pos.py.
# Public assets (the console JS) are served from /assets/atl_pos/ after build.
