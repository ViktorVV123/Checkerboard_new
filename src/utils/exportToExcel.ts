import * as XLSX from 'xlsx';

export const exportToExcel = (
    data: any[],
    columns: { key: string; label: string }[],
    formatDate: (d: number) => string,
    filename: string,
) => {
    const header = columns.map((c) => c.label);

    const rows = data.map((row) =>
        columns.map((col) => {
            if (col.key === 'date') return formatDate(row.date);
            const val = row[col.key];
            if (val === null || val === undefined) return '';
            const num = Number(val);
            return isNaN(num) ? String(val) : Math.round(num);
        }),
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // Ширина колонок
    ws['!cols'] = columns.map((col) => ({
        wch: col.key === 'date' ? 10 : 18,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Данные');
    XLSX.writeFile(wb, filename);
};
