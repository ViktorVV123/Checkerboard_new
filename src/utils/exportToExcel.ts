import * as XLSX from 'xlsx';

export const exportToExcel = (
    data: any[],
    columns: { key: string; label: string }[],
    formatDate: (d: number) => string,
    filename: string,
) => {
    const header = columns.map((c) => c.label);
    const rows = dataToRows(data, columns, formatDate);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = columns.map((col) => ({ wch: col.key === 'date' ? 10 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Данные');
    XLSX.writeFile(wb, filename);
};

// Экспорт всего завода — каждый продукт на отдельном листе
export const exportEnterpriseToExcel = (
    products: string[],
    dataByProduct: Record<string, any[]>,
    columns: (product: string) => { key: string; label: string }[],
    formatDate: (d: number) => string,
    filename: string,
) => {
    const wb = XLSX.utils.book_new();

    for (const product of products) {
        const data = dataByProduct[product] || [];
        const cols = columns(product);
        const header = cols.map((c) => c.label);
        const rows = dataToRows(data, cols, formatDate);
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = cols.map((col) => ({ wch: col.key === 'date' ? 10 : 18 }));
        // Имя листа макс 31 символ — ограничение Excel
        const sheetName = product.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, filename);
};

function dataToRows(
    data: any[],
    columns: { key: string; label: string }[],
    formatDate: (d: number) => string,
): (string | number)[][] {
    return data.map((row) =>
        columns.map((col) => {
            if (col.key === 'date') return formatDate(row.date);
            const val = row[col.key];
            if (val === null || val === undefined) return 0;
            const num = Number(val);
            return isNaN(num) ? String(val) : Math.round(num);
        }),
    );
}
