# Agyeiwaa's Table POS (`atl_pos`)

A branded restaurant POS console for Agyeiwaa's Table Limited, built on top of
ERPNext and the URY restaurant app. It adds a full-screen cashier page at
**`/atl-pos`** and the whitelisted API behind it.

## What it provides

- A website page at `/atl-pos`: floor grid by room, order panel, menu with
  three-level category zoom and photos, KOT routing (Kitchen / Bar / auto),
  move-and-combine bills, split tenders with live change, charge-to-Raybow-room
  settling to a folio clearing account, shift open, and a live day strip.
- Whitelisted API methods `atl_pos.api.kiosk` and `atl_pos.api.bill`.
- Server-side guards: a post-KOT item-removal block (Auditor override) and
  automatic company pinning for Agyeiwaa's Table staff.
- An idempotent installer that ensures the folio account, the `Raybow Folio`
  payment mode, the POS Invoice custom fields, and the folio customer exist. On
  an already-configured site every step is skipped.

## Requirements

The bench and site must already have **frappe**, **erpnext**, and **ury**
installed. This app does not create the company, menu, tables, taxes, or the
`ATL Main POS` profile; it expects them to exist (they do on the production
site) and builds on them.

## Install on Frappe Cloud (Install App from GitHub)

1. Push this repository to a GitHub repo you control.
2. In the Frappe Cloud dashboard, open your **Bench**, go to **Apps**, choose
   **Add App → From GitHub**, and point it at the repo and branch.
3. Frappe Cloud clones, builds (which compiles the console asset), and adds the
   app to the bench. Deploy the bench.
4. Open your **Site → Apps → Install App** and install `atl_pos` on the site.
5. Visit `https://<your-site>/atl-pos`, logged in as a cashier.

If the page loads but stays on "Loading the floor…", the front-end asset was not
built; on the bench run `bench build --app atl_pos`, which Frappe Cloud performs
automatically on deploy.

## Access

`/atl-pos` is restricted to users holding `URY Cashier`, `URY Manager`,
`System Manager`, or `ATL Kiosk`. Guests are redirected to login.

## Local development

```bash
bench get-app atl_pos <repo-url>
bench --site <site> install-app atl_pos
bench build --app atl_pos
```
