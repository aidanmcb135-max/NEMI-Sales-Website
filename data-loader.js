/**
 * Handles file reading and parsing using SheetJS
 */
class DataLoader {
    static async parseExcelFile(file, logger = console.log) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    logger("Parsing spreadsheet structure...");
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    const firstSheetName = workbook.SheetNames[0];
                    logger(`Sheet found: "${firstSheetName}". Converting to JSON...`);
                    const worksheet = workbook.Sheets[firstSheetName];

                    // START AT ROW 5: range: 4 (0-indexed) skips the first 4 rows
                    const rawJson = XLSX.utils.sheet_to_json(worksheet, {
                        defval: null,
                        range: 4
                    });

                    logger(`Found ${rawJson.length} raw rows (starting from Row 5). Starting analysis...`);

                    if (rawJson.length === 0) {
                        throw new Error("The spreadsheet appears to be empty or headers were not found on Row 5.");
                    }

                    const cleanedData = this.cleanAndFilterData(rawJson, logger);
                    resolve(cleanedData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    static cleanAndFilterData(rawData, logger = console.log) {
        let lastCustomer = null;

        const mapped = rawData.map((row) => {
            const keys = Object.keys(row);
            const firstColKey = keys.length > 0 ? keys[0] : null;
            const firstColVal = firstColKey ? row[firstColKey] : null;

            // Find keys case-insensitively using a helper
            const getVal = (possibleKeys) => {
                const key = keys.find(k =>
                    possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()))
                );
                return key ? row[key] : null;
            };

            // Safely parse numbers, stripping currency symbols or commas
            const parseNumber = (val) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    const cleaned = val.replace(/[^0-9.-]+/g, "");
                    return parseFloat(cleaned) || 0;
                }
                return 0;
            };

            const transactionDate = getVal(['transaction date', 'date', 'trans date']);
            // Read Description and Product/Service as SEPARATE columns
            // Prefer Description over Product/Service for the display name
            const descriptionCol = getVal(['memo/description', 'memo', 'description']);
            const productServiceCol = getVal(['product/service', 'product/service full name', 'product', 'item']);
            // Use description if available, otherwise fall back to product/service code
            const productSold = (descriptionCol && String(descriptionCol).trim()) 
                ? String(descriptionCol).trim() 
                : (productServiceCol ? String(productServiceCol).trim() : null);
            const quantity = getVal(['quantity', 'qty']);
            const amount = getVal(['amount', 'revenue', 'value']);
            const invoiceNo = String(getVal(['no.', 'invoice', 'inv']) || '').trim();

            const firstColStr = String(firstColVal || '').trim();

            // 1. DETECT CUSTOMER NAME ROWS: 
            // In the sheet, a new customer is a row where the first column has a name but there's no date.
            if (firstColStr && !transactionDate) {
                if (firstColStr.toLowerCase().startsWith('total')) {
                    return null;
                }
                lastCustomer = firstColStr;
                return null; // Don't count the name row as a sale
            }

            // IGNORE rows that are subtotals or lack a valid product
            const rowString = JSON.stringify(row).toLowerCase();
            if (firstColStr.toLowerCase().startsWith("total") || (rowString.includes("total") && !productSold)) {
                return null;
            }

            // 2. DETECT TRANSACTIONS
            if (transactionDate && (productSold || amount !== 0)) {
                // DATE PARSING: Handle Excel Dates vs String DD/MM/YYYY
                let dateObj = transactionDate;
                if (typeof transactionDate === 'string' && transactionDate.includes('/')) {
                    const parts = transactionDate.split('/');
                    if (parts.length === 3) {
                        dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                }

                return {
                    customer: lastCustomer || 'Unknown',
                    transactionDate: dateObj,
                    productSold: productSold || 'Other / Deposit',
                    quantity: parseNumber(quantity),
                    amount: parseNumber(amount),
                    invoiceNo: invoiceNo || 'Unknown'
                };
            }

            return null;
        }).filter(r => r !== null);

        if (mapped.length === 0 && rawData.length > 0) {
            // Check first row keys to help user debug headers
            const sampleKeys = Object.keys(rawData[0]).join(", ");
            throw new Error(`Data mapping failed. Headers found: [${sampleKeys}]. Please ensure "Transaction Date" and "Product/Service" are columns on Row 5.`);
        }

        return mapped;
    }
}
