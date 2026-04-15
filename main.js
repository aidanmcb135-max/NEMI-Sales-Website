/**
 * Main application logic bridging UI and data scripts
 */
document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');
    const dashboard = document.getElementById('dashboard');
    const debugLog = document.getElementById('debugLog');
    const logContent = document.getElementById('logContent');

    // Global state for date filtering
    let _rawData = null;
    let _chartManager = null;

    function log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Let <details> open if there's an error
        if (type === 'error') {
            debugLog.open = true;
        }
        debugLog.classList.remove('hidden');
    }

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(tabId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.add('hidden'));

        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (btn) btn.classList.add('active');
        const panel = document.getElementById(tabId);
        if (panel) panel.classList.remove('hidden');

        // Force Chart.js to resize/remount nicely on unhide
        window.dispatchEvent(new Event('resize'));
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // KPI Card Click Navigation
    function highlightTarget(elementId) {
        const target = document.getElementById(elementId);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Re-trigger animation safely
            target.classList.remove('target-highlight');
            void target.offsetWidth; // trigger reflow
            target.classList.add('target-highlight');
            
            setTimeout(() => {
                target.classList.remove('target-highlight');
            }, 1500);
        }
    }

    document.getElementById('card-revenue').addEventListener('click', () => {
        switchTab('tab-overview');
        highlightTarget('chart-card-revenue');
    });

    document.getElementById('card-best-month').addEventListener('click', () => {
        switchTab('tab-overview');
        highlightTarget('chart-card-revenue');
        
        setTimeout(() => { // wait for scroll to finish before tooltip appears
            const bestMonthVal = document.getElementById('val-best-month').textContent;
            if (bestMonthVal && bestMonthVal !== '-') {
                chartManager.highlightMonth(bestMonthVal);
            }
        }, 500);
    });

    document.getElementById('card-top-product').addEventListener('click', () => {
        switchTab('tab-products');
        highlightTarget('chart-card-top20');
    });

    document.getElementById('card-active-customers').addEventListener('click', () => {
        switchTab('tab-customers');
        highlightTarget('section-customer-activity');
    });

    // Header Click Navigation (Home) — stop propagation from date picker
    const mainHeader = document.querySelector('.top-nav');
    if (mainHeader) {
        mainHeader.addEventListener('click', (e) => {
            // Don't navigate if user clicked on date inputs or reset button
            if (e.target.closest('#date-from') || e.target.closest('#date-to') || e.target.closest('#date-reset-btn')) return;
            switchTab('tab-overview');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    _chartManager = new ChartManager();
    const chartManager = _chartManager;

    // Drag and drop setup
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, preventDefaults, false));
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    ['dragenter', 'dragover'].forEach(eventName => dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false));

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) handleFiles(files[0]);
    });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () { if (this.files.length) handleFiles(this.files[0]); });

    async function handleFiles(file) {
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            uploadStatus.textContent = "Error: Please upload a valid Excel file (.xlsx or .xls)";
            uploadStatus.style.color = '#ef4444';
            return;
        }

        uploadStatus.textContent = "Processing and analyzing your data...";
        uploadStatus.style.color = '#10b981';

        try {
            log(`Starting process for: ${file.name}`);
            if (typeof XLSX === 'undefined') throw new Error("Spreadsheet library (SheetJS) failed to load.");

            log("Reading file into memory...");
            const rawData = await DataLoader.parseExcelFile(file, log);
            if (rawData.length === 0) throw new Error("No valid data found.");

            log(`Analyzing ${rawData.length} valid sales records...`, 'success');
            uploadStatus.textContent = `Successfully processed ${rawData.length} rows.`;

            // Store raw data globally for date filtering
            _rawData = rawData;

            const analyzer = new DataAnalyzer(rawData);

            // Set date picker defaults from data range
            setupDatePicker(rawData);

            // Hide Upload elements, reveal Dashboard properly
            document.getElementById('uploadSection').classList.add('hidden');
            document.getElementById('uploadHeader').classList.remove('hidden');

            renderAll(analyzer);

            dashboard.classList.remove('hidden');
            dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error(error);
            log(`ERROR: ${error.message}`, 'error');
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadStatus.style.color = '#ef4444';
        }
    }

    function renderAll(analyzer) {
            // 1. Dashboard Metrics
            updateDashboardMetrics(analyzer);

            // 2. Main Charts
            chartManager.renderRevenueChart(analyzer.getRevenueByMonth());
            chartManager.renderVolumeChart(analyzer.getVolumeByQuarter());
            chartManager.renderCustomerChart(analyzer.getRevenueByCustomer());
            chartManager.renderProductChart(analyzer.getRevenueByProduct());
            chartManager.renderNewVsReturningChart(analyzer.getNewVsReturningMetrics());

            // 3. Boss V2 Charts
            renderTop20Chart(analyzer.getTopProductsByQuantity(20));
            renderTop10TrendsChart(analyzer.getTop10ProductTrends());

            // 4. Tables and Lists
            renderFrequencyTable(analyzer.getCustomerFrequencyTable());
            renderChurnLists(analyzer.getChurnedCustomers());
    }

    // ---- TOP 20 PRODUCTS CHART (standalone) ----
    let _top20Chart = null;
    function renderTop20Chart(productData) {
        const ctx = document.getElementById('top20Chart').getContext('2d');
        const labels = productData.map(d => d.product);
        const data = productData.map(d => d.quantity);

        if (_top20Chart) _top20Chart.destroy();

        _top20Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Units Sold',
                    data: data,
                    backgroundColor: '#4c9568',
                    borderRadius: 4,
                    barThickness: 'flex',
                    maxBarThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: '#E5E7EB', drawBorder: false, borderDash: [5, 5] }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });
    }

    // ---- TOP 10 PRODUCT TRENDS CHART (standalone) ----
    let _top10TrendsChart = null;
    function renderTop10TrendsChart(trendData) {
        const ctx = document.getElementById('top10TrendsChart').getContext('2d');

        const palette = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ];

        trendData.datasets.forEach((ds, i) => {
            ds.borderColor = palette[i % palette.length];
            ds.backgroundColor = palette[i % palette.length];
            ds.borderWidth = 2;
            ds.pointRadius = 3;
            ds.pointHoverRadius = 5;
            ds.fill = false;
            ds.tension = 0.3;
        });

        if (_top10TrendsChart) _top10TrendsChart.destroy();

        _top10TrendsChart = new Chart(ctx, {
            type: 'line',
            data: trendData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: '#E5E7EB', drawBorder: false, borderDash: [5, 5] },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function updateDashboardMetrics(analyzer) {
        const colFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

        document.getElementById('val-revenue').textContent = colFormatter.format(analyzer.getTotalRevenue());
        document.getElementById('sub-revenue').textContent = `${analyzer.getTotalTransactions().toLocaleString()} orders processed`;

        const momData = analyzer.getMoMChange();
        if (momData) {
            document.getElementById('val-mom').textContent = (momData.isPositive ? '+' : '') + momData.pctChange + '%';
            document.getElementById('sub-mom').textContent = `vs ${momData.previousMonth}`;
            
            // Add trend to Revenue card as well
            const trendRev = document.getElementById('trend-revenue');
            trendRev.className = `kpi-trend ${momData.isPositive ? 'trend-up' : 'trend-down'}`;
            trendRev.innerHTML = `${momData.isPositive ? '↑' : '↓'} ${Math.abs(momData.pctChange)}%`;
        } else {
            document.getElementById('val-mom').textContent = '-';
            document.getElementById('sub-mom').textContent = 'Not enough data';
            document.getElementById('trend-revenue').className = 'kpi-trend trend-neutral';
        }

        document.getElementById('val-aov').textContent = colFormatter.format(analyzer.getAverageOrderValue());
        document.getElementById('val-rpc').textContent = colFormatter.format(analyzer.getRevenuePerCustomer());
        document.getElementById('val-clv').textContent = colFormatter.format(analyzer.getRevenuePerCustomer());

        const bestMonth = analyzer.getBestSalesMonth();
        document.getElementById('val-best-month').textContent = bestMonth.month !== '-' ? bestMonth.month : '-';
        document.getElementById('sub-best-month').textContent = `${colFormatter.format(bestMonth.revenue || 0)} revenue`;

        const topProduct = analyzer.getTopProductsByQuantity(1)[0] || { product: '-', quantity: 0 };
        document.getElementById('val-top-product').textContent = topProduct.product;
        document.getElementById('sub-top-product').textContent = `${(topProduct.quantity || 0).toLocaleString()} units sold`;

        document.getElementById('val-total-customers').textContent = analyzer.getTotalCustomers().toLocaleString();
    }

    function renderFrequencyTable(freqData) {
        const table = document.getElementById('frequencyTable');
        table.innerHTML = '';

        // Build Header
        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Customer</th>';
        freqData.months.forEach(m => {
            headerRow += `<th>${m.label.split(' ')[0]}</th>`; // Show just the month name to save space
        });
        headerRow += '<th class="total-col">Total</th></tr>';
        thead.innerHTML = headerRow;
        table.appendChild(thead);

        // Build Body
        const tbody = document.createElement('tbody');
        freqData.data.forEach(row => {
            let tr = document.createElement('tr');
            let content = `<td><strong>${row.customer}</strong></td>`;
            freqData.months.forEach(m => {
                const count = row[m.key] || 0;
                content += count === 0 
                    ? `<td class="cell-zero">-</td>` 
                    : `<td>${count}</td>`;
            });
            content += `<td class="total-col">${row.total}</td>`;
            tr.innerHTML = content;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
    }

    function renderChurnLists(churnData) {
        const list30 = document.getElementById('churn30List');
        const list60 = document.getElementById('churn60List');
        const list90 = document.getElementById('churn90List');
        const list180 = document.getElementById('churn180List');

        list30.innerHTML = '';
        list60.innerHTML = '';
        list90.innerHTML = '';
        list180.innerHTML = '';

        if (churnData.churned30.length === 0) list30.innerHTML = '<div class="no-data-msg">No at-risk accounts found.</div>';
        if (churnData.churned60.length === 0) list60.innerHTML = '<div class="no-data-msg">No dormant accounts found.</div>';
        if (churnData.churned90.length === 0) list90.innerHTML = '<div class="no-data-msg">No high-risk accounts found.</div>';
        if (churnData.churned180.length === 0) list180.innerHTML = '<div class="no-data-msg">No lost accounts found.</div>';

        churnData.churned30.forEach(c => {
            const dateStr = c.lastOrder.toLocaleDateString();
            list30.innerHTML += `<div class="churn-item"><span class="churn-name">${c.customer}</span><span class="churn-days">${c.daysSince} days (${dateStr})</span></div>`;
        });

        churnData.churned60.forEach(c => {
            const dateStr = c.lastOrder.toLocaleDateString();
            list60.innerHTML += `<div class="churn-item"><span class="churn-name">${c.customer}</span><span class="churn-days">${c.daysSince} days (${dateStr})</span></div>`;
        });

        churnData.churned90.forEach(c => {
            const dateStr = c.lastOrder.toLocaleDateString();
            list90.innerHTML += `<div class="churn-item"><span class="churn-name">${c.customer}</span><span class="churn-days">${c.daysSince} days (${dateStr})</span></div>`;
        });

        churnData.churned180.forEach(c => {
            const dateStr = c.lastOrder.toLocaleDateString();
            list180.innerHTML += `<div class="churn-item"><span class="churn-name">${c.customer}</span><span class="churn-days">${c.daysSince} days (${dateStr})</span></div>`;
        });
    }

    // ===== DATE RANGE PICKER =====
    function setupDatePicker(rawData) {
        // Find min and max dates from data
        let minDate = new Date('9999-12-31');
        let maxDate = new Date(0);
        rawData.forEach(row => {
            const d = row.transactionDate;
            if (d instanceof Date && !isNaN(d.getTime())) {
                if (d < minDate) minDate = d;
                if (d > maxDate) maxDate = d;
            }
        });

        const fromInput = document.getElementById('date-from');
        const toInput = document.getElementById('date-to');
        const resetBtn = document.getElementById('date-reset-btn');
        const fyLabel = document.getElementById('nav-fy-label');

        const toISO = (d) => d.toISOString().split('T')[0];

        fromInput.value = toISO(minDate);
        toInput.value = toISO(maxDate);
        fromInput.min = toISO(minDate);
        fromInput.max = toISO(maxDate);
        toInput.min = toISO(minDate);
        toInput.max = toISO(maxDate);

        const updateFYLabel = () => {
            const from = new Date(fromInput.value);
            const to = new Date(toInput.value);
            const opts = { month: 'short', year: 'numeric' };
            fyLabel.textContent = from.toLocaleDateString('en-GB', opts) + ' – ' + to.toLocaleDateString('en-GB', opts);
        };
        updateFYLabel();

        const applyFilter = () => {
            if (!_rawData) return;
            const from = new Date(fromInput.value + 'T00:00:00');
            const to = new Date(toInput.value + 'T23:59:59');
            const filtered = _rawData.filter(row => {
                const d = row.transactionDate;
                return d instanceof Date && !isNaN(d.getTime()) && d >= from && d <= to;
            });
            if (filtered.length === 0) return;
            // Deep-clone rows so DataAnalyzer re-parses cleanly
            const cloned = filtered.map(r => ({...r, transactionDate: new Date(r.transactionDate)}));
            const analyzer = new DataAnalyzer(cloned);
            renderAll(analyzer);
            updateFYLabel();
        };

        fromInput.addEventListener('change', applyFilter);
        toInput.addEventListener('change', applyFilter);
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fromInput.value = toISO(minDate);
            toInput.value = toISO(maxDate);
            applyFilter();
        });

        // Prevent clicks on inputs from triggering header navigation
        [fromInput, toInput, resetBtn].forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
        });
    }
});
