/**
 * Analyzes the cleaned data and produces metrics
 */
class DataAnalyzer {
    constructor(data) {
        this.data = data;
        this.maxDate = new Date(0);

        // Setup Date and Month parsing
        this.data.forEach(row => {
            if (!(row.transactionDate instanceof Date)) {
                if (typeof row.transactionDate === 'number') {
                    row.transactionDate = new Date(Math.round((row.transactionDate - 25569) * 86400 * 1000));
                } else {
                    row.transactionDate = new Date(row.transactionDate);
                }
            }
            const d = row.transactionDate;
            if (!isNaN(d.getTime())) {
                if (d > this.maxDate) this.maxDate = d;

                row.monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                row.monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

                // Quarter logic
                const q = Math.floor(d.getMonth() / 3) + 1;
                row.quarterKey = `${d.getFullYear()}-Q${q}`;
                row.quarterLabel = `Q${q} ${d.getFullYear()}`;
            } else {
                row.monthKey = 'Unknown';
                row.monthLabel = 'Unknown';
                row.quarterKey = 'Unknown';
                row.quarterLabel = 'Unknown';
            }
        });
    }

    getTotalRevenue() { return this.data.reduce((sum, row) => sum + row.amount, 0); }
    getTotalTransactions() { return this.data.length; }

    getRevenueByMonth() {
        const monthly = {};
        this.data.forEach(row => {
            if (row.monthKey === 'Unknown') return;
            if (!monthly[row.monthKey]) {
                monthly[row.monthKey] = { label: row.monthLabel, revenue: 0, quantity: 0 };
            }
            monthly[row.monthKey].revenue += row.amount;
            monthly[row.monthKey].quantity += row.quantity;
        });

        return Object.keys(monthly).sort().map(key => ({
            month: monthly[key].label,
            monthKey: key,
            revenue: monthly[key].revenue,
            quantity: monthly[key].quantity
        }));
    }

    getVolumeByQuarter() {
        const quarters = {};
        this.data.forEach(row => {
            if (row.quarterKey === 'Unknown') return;
            if (!quarters[row.quarterKey]) {
                quarters[row.quarterKey] = { label: row.quarterLabel, quantity: 0 };
            }
            quarters[row.quarterKey].quantity += row.quantity;
        });

        return Object.keys(quarters).sort().map(key => ({
            quarter: quarters[key].label,
            quantity: quarters[key].quantity
        }));
    }

    getBestSalesMonth() {
        const monthly = this.getRevenueByMonth();
        if (monthly.length === 0) return { month: '-', revenue: 0 };
        return monthly.reduce((best, current) => current.revenue > best.revenue ? current : best, monthly[0]);
    }

    getTopProductsByQuantity(limit = 20) {
        const products = {};
        this.data.forEach(row => {
            const prodText = String(row.productSold || 'Unknown').trim();
            if (prodText === 'Other / Deposit' || !prodText) return;

            if (!products[prodText]) products[prodText] = 0;
            products[prodText] += row.quantity;
        });

        return Object.keys(products)
            .map(name => ({ product: name, quantity: products[name] }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, limit);
    }

    getTop10ProductTrends() {
        // 1. Get Top 10 Products by Quantity
        const top10 = this.getTopProductsByQuantity(10).map(p => p.product);

        // 2. Get all distinct sorted months
        const allMonths = this.getRevenueByMonth().map(m => m.monthKey);

        // 3. Initialize mapping array for each product
        const trends = {};
        top10.forEach(p => {
            trends[p] = {};
            allMonths.forEach(m => trends[p][m] = 0);
        });

        // 4. Fill with quantities
        this.data.forEach(row => {
            const prodText = String(row.productSold || 'Unknown').trim();
            if (top10.includes(prodText) && row.monthKey !== 'Unknown') {
                trends[prodText][row.monthKey] += row.quantity;
            }
        });

        // 5. Convert to Chart.js dataset format
        // Return months (labels) and datasets
        const datasets = top10.map(productName => {
            return {
                label: productName,
                data: allMonths.map(mKey => trends[productName][mKey])
            };
        });

        return {
            labels: this.getRevenueByMonth().map(m => m.month),
            datasets: datasets
        };
    }

    getRevenueByProduct() {
        const products = {};
        this.data.forEach(row => {
            const prodText = String(row.productSold || 'Unknown').trim();
            if (!products[prodText]) products[prodText] = 0;
            products[prodText] += row.amount;
        });

        return Object.keys(products)
            .map(name => ({ product: name, revenue: products[name] }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    getRevenueByCustomer() {
        const customers = {};
        this.data.forEach(row => {
            const name = row.customer || 'Unknown';
            if (!customers[name]) customers[name] = 0;
            customers[name] += row.amount;
        });

        return Object.keys(customers)
            .map(name => ({ name, revenue: customers[name] }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    getTotalCustomers() {
        return this.getRevenueByCustomer().length;
    }

    getCustomerFrequencyTable() {
        // We want to count UNIQUE invoices per customer per month
        const frequencyMap = {};

        this.data.forEach(row => {
            const customer = row.customer || 'Unknown';
            const mKey = row.monthKey;
            const invoice = row.invoiceNo;

            if (mKey === 'Unknown' || !invoice) return;

            if (!frequencyMap[customer]) frequencyMap[customer] = {};
            if (!frequencyMap[customer][mKey]) frequencyMap[customer][mKey] = new Set();

            frequencyMap[customer][mKey].add(invoice);
        });

        const allMonths = this.getRevenueByMonth().map(m => ({ label: m.month, key: m.monthKey }));

        const tableData = Object.keys(frequencyMap).map(customer => {
            const rowObj = { customer };
            let totalInvoices = 0;
            allMonths.forEach(m => {
                const count = frequencyMap[customer][m.key] ? frequencyMap[customer][m.key].size : 0;
                rowObj[m.key] = count;
                totalInvoices += count;
            });
            rowObj.total = totalInvoices;
            return rowObj;
        });

        return {
            months: allMonths,
            data: tableData.sort((a, b) => b.total - a.total)
        };
    }

    getChurnedCustomers() {
        const customerDates = {};
        this.data.forEach(row => {
            const customer = row.customer || 'Unknown';
            const d = row.transactionDate;
            if (isNaN(d.getTime())) return;

            if (!customerDates[customer] || d > customerDates[customer]) {
                customerDates[customer] = d;
            }
        });

        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        const churned30 = [];   // 30-59 days
        const churned60 = [];   // 60-89 days
        const churned90 = [];   // 90-180 days
        const churned180 = [];  // 180+ days

        Object.keys(customerDates).forEach(customer => {
            const diffDays = Math.floor((this.maxDate - customerDates[customer]) / MS_PER_DAY);
            if (diffDays > 180) {
                churned180.push({ customer, lastOrder: customerDates[customer], daysSince: diffDays });
            } else if (diffDays >= 90) {
                churned90.push({ customer, lastOrder: customerDates[customer], daysSince: diffDays });
            } else if (diffDays >= 60) {
                churned60.push({ customer, lastOrder: customerDates[customer], daysSince: diffDays });
            } else if (diffDays >= 30) {
                churned30.push({ customer, lastOrder: customerDates[customer], daysSince: diffDays });
            }
        });

        return {
            churned30: churned30.sort((a, b) => b.daysSince - a.daysSince),
            churned60: churned60.sort((a, b) => b.daysSince - a.daysSince),
            churned90: churned90.sort((a, b) => b.daysSince - a.daysSince),
            churned180: churned180.sort((a, b) => b.daysSince - a.daysSince)
        };
    }

    getMoMChange() {
        const monthly = this.getRevenueByMonth();
        if (monthly.length < 2) return null;
        
        const currentMonth = monthly[monthly.length - 1];
        const previousMonth = monthly[monthly.length - 2];
        const pctChange = previousMonth.revenue > 0 ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100 : 0;
        
        return {
            currentMonth: currentMonth.month,
            previousMonth: previousMonth.month,
            pctChange: pctChange.toFixed(1),
            isPositive: pctChange >= 0
        };
    }

    getAverageOrderValue() {
        const uniqueInvoices = new Set();
        this.data.forEach(row => {
            if (row.invoiceNo && row.invoiceNo !== 'Unknown') {
                uniqueInvoices.add(row.invoiceNo);
            }
        });
        const totalRevenue = this.getTotalRevenue();
        return uniqueInvoices.size > 0 ? (totalRevenue / uniqueInvoices.size) : 0;
    }

    getRevenuePerCustomer() {
        const totalRevenue = this.getTotalRevenue();
        const totalCustomers = this.getTotalCustomers();
        return totalCustomers > 0 ? (totalRevenue / totalCustomers) : 0;
    }

    getNewVsReturningMetrics() {
        const firstPurchaseMap = {};
        this.data.forEach(row => {
             const customer = row.customer || 'Unknown';
             if (row.monthKey === 'Unknown' || isNaN(row.transactionDate.getTime())) return;
             if (!firstPurchaseMap[customer] || row.transactionDate < firstPurchaseMap[customer]) {
                 firstPurchaseMap[customer] = row.transactionDate;
             }
        });

        const monthlyData = {};
        this.data.forEach(row => {
             if (row.monthKey === 'Unknown' || isNaN(row.transactionDate.getTime())) return;
             const customer = row.customer || 'Unknown';
             const isNew = (row.transactionDate.getFullYear() === firstPurchaseMap[customer].getFullYear() && 
                            row.transactionDate.getMonth() === firstPurchaseMap[customer].getMonth());
             
             if (!monthlyData[row.monthKey]) {
                 monthlyData[row.monthKey] = { label: row.monthLabel, newRevenue: 0, returningRevenue: 0 };
             }

             if (isNew) {
                 monthlyData[row.monthKey].newRevenue += row.amount;
             } else {
                 monthlyData[row.monthKey].returningRevenue += row.amount;
             }
        });

        const labels = Object.keys(monthlyData).sort();
        const newD = labels.map(key => monthlyData[key].newRevenue);
        const returningD = labels.map(key => monthlyData[key].returningRevenue);

        return {
             labels: labels.map(key => monthlyData[key].label),
             datasets: [
                 { label: 'Returning Revenue', data: returningD },
                 { label: 'New Revenue', data: newD }
             ]
        };
    }
}
