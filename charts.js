/**
 * Handles rendering visualizations using Chart.js
 */
class ChartManager {
    constructor() {
        this.revenueChart = null;
        this.volumeChart = null;
        this.customerChart = null;
        this.productChart = null;
        this.top20Chart = null;
        this.top10TrendsChart = null;

        // Setup Chart.js global defaults for Base44 light theme
        Chart.defaults.color = '#64748B';
        Chart.defaults.font.family = "'Montserrat', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = '#FFFFFF';
        Chart.defaults.plugins.tooltip.titleColor = '#111827';
        Chart.defaults.plugins.tooltip.bodyColor = '#4B5563';
        Chart.defaults.plugins.tooltip.borderColor = '#E5E7EB';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.boxPadding = 4;
        Chart.defaults.plugins.tooltip.usePointStyle = true;
    }

    renderRevenueChart(monthlyData) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        const labels = monthlyData.map(d => d.month);
        const data = monthlyData.map(d => d.revenue);

        if (this.revenueChart) this.revenueChart.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(15, 44, 65, 0.2)');
        gradient.addColorStop(1, 'rgba(15, 44, 65, 0.0)');

        this.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    borderColor: '#0F2C41',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#FFFFFF',
                    pointBorderColor: '#0F2C41',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => '£' + context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: '#E5E7EB', drawBorder: false, borderDash: [5, 5] },
                        beginAtZero: true,
                        ticks: { callback: value => '£' + (value >= 1000 ? (value / 1000) + 'k' : value) }
                    }
                }
            }
        });
    }

    renderVolumeChart(quarterlyData) {
        const ctx = document.getElementById('volumeChart').getContext('2d');
        const labels = quarterlyData.map(d => d.quarter);
        const data = quarterlyData.map(d => d.quantity);

        if (this.volumeChart) this.volumeChart.destroy();

        this.volumeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales Volume',
                    data: data,
                    backgroundColor: '#1E496B',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
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

    renderCustomerChart(customerData) {
        const ctx = document.getElementById('customerChart').getContext('2d');
        const top10 = customerData.slice(0, 10);
        const labels = top10.map(d => d.name);
        const data = top10.map(d => d.revenue);

        if (this.customerChart) this.customerChart.destroy();

        this.customerChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    backgroundColor: '#1E496B',
                    borderRadius: 4,
                    barThickness: 'flex',
                    maxBarThickness: 24
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { color: '#E5E7EB', drawBorder: false, borderDash: [5, 5] },
                        ticks: { callback: value => '£' + (value >= 1000 ? (value / 1000) + 'k' : value) }
                    },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    renderProductChart(productData) {
        const ctx = document.getElementById('productChart').getContext('2d');

        const palette = ['#081722', '#0F2C41', '#1A4261', '#245A84', '#3174A8', '#4B8DBF', '#6CA3CD', '#90BADA', '#B6D1E8'];

        let displayData = [];
        if (productData.length > 8) {
            displayData = productData.slice(0, 7);
            const otherRev = productData.slice(7).reduce((sum, p) => sum + p.revenue, 0);
            displayData.push({ product: 'Other', revenue: otherRev });
        } else {
            displayData = productData;
        }

        const labels = displayData.map(d => d.product);
        const data = displayData.map(d => d.revenue);
        const totalRev = data.reduce((a, b) => a + b, 0);

        if (this.productChart) this.productChart.destroy();

        this.productChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: palette.slice(0, displayData.length),
                    borderWidth: 2,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed;
                                const pct = ((val / totalRev) * 100).toFixed(1);
                                return ` ${pct}% (£${val.toLocaleString(undefined, { minimumFractionDigits: 2 })})`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderTop20Products(productData) {
        const ctx = document.getElementById('top20Chart').getContext('2d');
        const labels = productData.map(d => d.product);
        const data = productData.map(d => d.quantity);

        if (this.top20Chart) this.top20Chart.destroy();

        this.top20Chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Units Sold',
                    data: data,
                    backgroundColor: '#245A84',
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

    renderTop10Trends(trendData) {
        const ctx = document.getElementById('top10TrendsChart').getContext('2d');

        const palette = [
            '#081722', '#0F2C41', '#1A4261', '#245A84', '#3174A8',
            '#4B8DBF', '#6CA3CD', '#90BADA', '#B6D1E8', '#10b981'
        ];

        // Apply colors and styling to datasets
        trendData.datasets.forEach((ds, i) => {
            ds.borderColor = palette[i % palette.length];
            ds.backgroundColor = palette[i % palette.length];
            ds.borderWidth = 2;
            ds.pointRadius = 3;
            ds.pointHoverRadius = 5;
            ds.fill = false;
            ds.tension = 0.3;
        });

        if (this.top10TrendsChart) this.top10TrendsChart.destroy();

        this.top10TrendsChart = new Chart(ctx, {
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
}
