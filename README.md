# NEMI Teas — Sales Analytics Dashboard

A static, client-side sales analytics dashboard for NEMI Teas, hosted on GitHub Pages. No backend, no database — all data is embedded directly in the JavaScript and rendered in the browser.

---

## What it does

The dashboard gives a full picture of NEMI Teas' sales performance across three views:

- **Overview** — top-level KPIs (total revenue, order count, average order value, revenue per customer, most profitable month, top product, total customers, and average lifetime value), a revenue-over-time line chart, and a new vs returning revenue bar chart.
- **Products** — sales volume by quarter, a revenue breakdown donut chart by product, a top 20 products bar chart ranked by units sold, and a top 10 products over time line chart.
- **Customers** — top 10 customers by revenue, a customer activity & retention panel (segmented into At Risk / Dormant / Churn Risk / Lost), and a full customer order frequency table showing unique invoices per month across all 742 accounts.

---

## How it is built

| Layer | Technology |
|---|---|
| Hosting | GitHub Pages (free static hosting) |
| Markup | HTML |
| Styling | CSS (custom, no framework) |
| Charts | Chart.js (loaded via CDN) |
| Data | Hardcoded JavaScript arrays/objects |
| Fonts | System sans-serif (default) |

There is no build step, no bundler, and no package manager. Everything runs directly in the browser from a single HTML file (or a small set of HTML/JS/CSS files in the repository).

---

## File structure

```
/
├── index.html          # Main dashboard shell, navigation tabs, KPI cards
├── style.css           # All visual styling — colours, layout, typography
├── data.js             # All sales data — orders, products, customers
├── charts.js           # Chart.js initialisation and rendering logic
└── README.md           # This file
```

> Note: depending on how the repo is organised, some of the above may be inlined directly inside `index.html` rather than split into separate files.

---

## How the data flows

1. `data.js` holds the raw sales data as JavaScript arrays and objects — one record per invoice, with fields like customer name, product, quantity, price, and date.
2. When the page loads, `charts.js` reads from those arrays, aggregates the numbers (totals, averages, monthly groupings, per-customer counts), and passes the results into Chart.js to render each chart.
3. KPI card values (total revenue, average order value, etc.) are also calculated from `data.js` at page load and injected into the HTML via `document.getElementById` or similar DOM calls.
4. The three tabs (Overview, Products, Customers) are controlled by a simple `show/hide` toggle in JavaScript — all three panels are present in the DOM at all times, and clicking a tab just changes which one is visible.

---

## How to update the data

All sales figures live in `data.js`. To refresh the dashboard for a new period:

1. Open `data.js`.
2. Add new invoice records to the orders array. Each record typically looks something like:
```js
{ date: "2026-03-15", customer: "Daylesford", product: "Chai Syrup 500ml", qty: 24, unitPrice: 9.50 }
```
3. Save the file and push to GitHub. GitHub Pages will automatically redeploy within a minute or two.

No rebuilding or compiling is needed.

---

## How to export data

Charts and tables throughout the dashboard include **Export .xlsx** links. These generate a downloadable Excel file from the underlying data using client-side JavaScript (no server involved). The full dataset can also be downloaded via the **Download Full Report (.xlsx)** button in the top-right of the Overview tab.

---

## How GitHub Pages hosting works

The repository is configured to serve from the `main` branch (or a `/docs` folder — check the repo's Settings → Pages). Whenever you push a commit to that branch, GitHub automatically updates the live site at:

```
https://aidanmcb135-max.github.io/
```

There is no server to manage and no deployment pipeline — GitHub handles it all.

---

## Customer retention logic

The **Customer Activity & Retention** panel on the Customers tab segments accounts by how many days have passed since their last order:

| Segment | Definition |
|---|---|
| At Risk | 30–59 days since last order |
| Dormant | 60–89 days since last order |
| Churn Risk | 90–180 days since last order |
| Lost | 180+ days since last order |

These thresholds are calculated in `charts.js` (or `data.js`) by comparing each customer's most recent invoice date against today's date at page load time. The counts will therefore update automatically as time passes, without any manual intervention.

---

## Making changes

| What you want to change | Where to change it |
|---|---|
| Colours, fonts, spacing | `style.css` |
| Chart types or layouts | `charts.js` |
| KPI card labels or logic | `index.html` + `charts.js` |
| Sales data | `data.js` |
| Navigation tabs | `index.html` |
| Retention thresholds | `charts.js` or `data.js` |

---

## Planned improvements

- Warm cream page background (`#faf9f7`) to reinforce the NEMI brand
- Consistent brand green accent across tabs, badges, and chart highlights
- Inter + Playfair Display font pairing for a more premium feel
- Two new KPI cards: Repeat Purchase Rate and Average Days Between Orders
- Bolder active tab indicator using the brand green
- Date range picker to filter all metrics by a custom period
