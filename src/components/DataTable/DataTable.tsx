import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as s from './DataTable.module.scss';
import { calculateAllRows } from '../../utils/calculations';

interface Column {
    key: string;
    label: string;
    color?: 'blue' | 'red' | 'green';
    editable?: boolean;
}

interface DataTableProps {
    columns: Column[];
    data: any[];
    originalData?: any[];
    formatDate?: (date: number) => string;
    editable?: boolean;
    onCellEdit?: (rowId: number, field: string, value: string) => void;
    onFillDown?: (rowIds: number[], field: string, value: string) => void;
}

const DataTable: React.FC<DataTableProps> = ({
                                                 columns,
                                                 data,
                                                 formatDate,
                                                 editable = false,
                                                 onCellEdit,
                                                 onFillDown,
                                                 originalData,
                                             }) => {
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Fill-down state
    const [fillSource, setFillSource] = useState<{ rowIndex: number; colKey: string; value: any } | null>(null);
    const [fillTargetIndex, setFillTargetIndex] = useState<number | null>(null);
    const isDragging = useRef(false);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const rowRectsRef = useRef<DOMRect[]>([]);

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const num = Number(value);
        if (!isNaN(num) && value !== '') {
            if (num === 0) return '0';
            return Math.round(num).toLocaleString('ru-RU');
        }
        return String(value);
    };

    const getColorClass = (color?: string): string => {
        if (color === 'blue') return s.colBlue;
        if (color === 'red') return s.colRed;
        if (color === 'green') return s.colGreen;
        return '';
    };

    const processedData = calculateAllRows(data, editable, originalData);
    const processedDataRef = useRef(processedData);
    processedDataRef.current = processedData;

    // --- Editing logic ---
    const handleCellClick = (rowId: number, col: Column, currentValue: any) => {
        if (!editable || !col.editable) return;
        if (isDragging.current) return;
        const key = `${rowId}-${col.key}`;
        setEditingCell(key);
        setEditValue(currentValue !== null && currentValue !== undefined ? String(Math.round(Number(currentValue))) : '');
    };

    const handleCellSave = (rowId: number, field: string) => {
        if (onCellEdit) {
            onCellEdit(rowId, field, editValue);
        }
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowId: number, field: string) => {
        if (e.key === 'Enter') handleCellSave(rowId, field);
        if (e.key === 'Escape') setEditingCell(null);
    };

    // --- Fill-down logic ---
    const handleFillHandleMouseDown = useCallback(
        (e: React.MouseEvent, rowIndex: number, colKey: string, value: any) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging.current = true;
            setFillSource({ rowIndex, colKey, value });
            setFillTargetIndex(rowIndex);

            // Snapshot row positions at drag start
            if (tbodyRef.current) {
                const rows = tbodyRef.current.querySelectorAll('tr');
                rowRectsRef.current = Array.from(rows).map((r) => r.getBoundingClientRect());
            }
        },
        []
    );

    const fillSourceRef = useRef(fillSource);
    fillSourceRef.current = fillSource;
    const fillTargetRef = useRef(fillTargetIndex);
    fillTargetRef.current = fillTargetIndex;

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !fillSourceRef.current) return;

            const rects = rowRectsRef.current;
            const sourceIdx = fillSourceRef.current.rowIndex;
            const y = e.clientY;

            // Find the last row whose top is above or at the cursor position
            // This ensures continuous selection even with fast mouse movement
            let targetIdx = sourceIdx;
            for (let i = sourceIdx + 1; i < rects.length; i++) {
                const rect = rects[i];
                // Row center determines if we've "entered" this row
                const rowCenter = rect.top + rect.height / 2;
                if (y >= rowCenter) {
                    targetIdx = i;
                } else {
                    break;
                }
            }

            setFillTargetIndex(targetIdx);
        };

        const handleMouseUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;

            const source = fillSourceRef.current;
            const target = fillTargetRef.current;
            const currentData = processedDataRef.current;

            if (source && target !== null && target > source.rowIndex) {
                const rowIds: number[] = [];
                for (let i = source.rowIndex + 1; i <= target; i++) {
                    if (currentData[i]) {
                        rowIds.push(currentData[i].id);
                    }
                }

                if (rowIds.length > 0) {
                    if (onFillDown) {
                        onFillDown(rowIds, source.colKey, String(source.value));
                    } else if (onCellEdit) {
                        rowIds.forEach((id) => {
                            onCellEdit(id, source.colKey, String(source.value));
                        });
                    }
                }
            }

            setFillSource(null);
            setFillTargetIndex(null);
            rowRectsRef.current = [];
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onFillDown, onCellEdit]);

    const isCellInFillRange = (rowIndex: number, colKey: string): boolean => {
        if (!fillSource || fillTargetIndex === null) return false;
        return (
            colKey === fillSource.colKey &&
            rowIndex > fillSource.rowIndex &&
            rowIndex <= fillTargetIndex
        );
    };

    // --- Totals ---
    const now = new Date();
    const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1);

    const totals: Record<string, number> = {
        plan: 0,
        expected: 0,
        shipmentFact: 0,
        railwayShipmentFact: 0,
        pipeShipmentFact: 0,
        mnppShipmentFact: 0,
        waterShipmentFact: 0,
        obr: 0,
        parkVolume: 0,
    };

    processedData.forEach((row) => {
        const dateStr = String(row.date);
        const rowMonth = Number(dateStr.slice(0, 6));

        if (rowMonth === currentMonth) {
            totals.plan += Number(row.plan) || 0;
            totals.expected += Number(row.expected) || 0;
            totals.shipmentFact += Number(row.shipmentFact) || 0;
            totals.railwayShipmentFact += Number(row.railwayShipmentFact) || 0;
            totals.pipeShipmentFact += Number(row.pipeShipmentFact) || 0;
            totals.mnppShipmentFact += Number(row.mnppShipmentFact) || 0;
            totals.waterShipmentFact += Number(row.waterShipmentFact) || 0;
        }
    });

    const obrRow = processedData.find((r) => r.obr);
    if (obrRow) totals.obr = Number(obrRow.obr);

    const parkRow = processedData.find((r) => Number(r.parkVolume) > 0);
    if (parkRow) totals.parkVolume = Number(parkRow.parkVolume);

    return (
        <div className={s.wrapper}>
            <table className={s.table} ref={tableRef}>
                <thead>
                <tr>
                    {columns.map((col) => (
                        <th key={col.key} className={getColorClass(col.color)}>
                            {col.label}
                            {editable && col.editable && <span className={s.editIcon}>✎</span>}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody ref={tbodyRef}>
                {processedData.map((row, rowIndex) => (
                    <tr key={row.id || rowIndex}>
                        {columns.map((col) => {
                            const cellKey = `${row.id}-${col.key}`;
                            const isEditing = editingCell === cellKey;
                            const isEdited = row.editedFields?.includes(col.key);
                            const cellValue = row[col.key];
                            const isNegative =
                                cellValue !== null && cellValue !== undefined && Number(cellValue) < 0;
                            const inFillRange = isCellInFillRange(rowIndex, col.key);

                            const cellClass = [
                                getColorClass(col.color),
                                isEdited ? s.editedCell : '',
                                editable && col.editable ? s.editableCell : '',
                                isNegative ? s.negativeCell : '',
                                inFillRange ? s.fillPreview : '',
                            ]
                                .filter(Boolean)
                                .join(' ');

                            const showFillHandle =
                                editable &&
                                col.editable &&
                                !isEditing &&
                                cellValue !== null &&
                                cellValue !== undefined &&
                                cellValue !== '';

                            return (
                                <td
                                    key={col.key}
                                    className={cellClass}
                                    onClick={() => handleCellClick(row.id, col, row[col.key])}
                                >
                                    {isEditing ? (
                                        <input
                                            className={s.cellInput}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => handleCellSave(row.id, col.key)}
                                            onKeyDown={(e) => handleKeyDown(e, row.id, col.key)}
                                            autoFocus
                                        />
                                    ) : col.key === 'date' && formatDate ? (
                                        formatDate(row[col.key])
                                    ) : (
                                        <>
                                            {inFillRange
                                                ? formatValue(fillSource?.value)
                                                : formatValue(row[col.key])}
                                            {showFillHandle && (
                                                <span
                                                    className={s.fillHandle}
                                                    onMouseDown={(e) =>
                                                        handleFillHandleMouseDown(e, rowIndex, col.key, cellValue)
                                                    }
                                                />
                                            )}
                                        </>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
                </tbody>
                <tfoot>
                <tr className={s.summaryRow}>
                    <td>План</td>
                    <td>{Math.round(totals.plan).toLocaleString('ru-RU')}</td>
                    {columns.slice(2).map((col) => (
                        <td key={col.key}></td>
                    ))}
                </tr>
                <tr className={s.summaryRow}>
                    <td>ОБР</td>
                    <td>{Math.round(totals.obr).toLocaleString('ru-RU')}</td>
                    {columns.slice(2).map((col) => (
                        <td key={col.key}></td>
                    ))}
                </tr>
                <tr className={s.summaryRow}>
                    <td>Ожид</td>
                    <td>{Math.round(totals.expected).toLocaleString('ru-RU')}</td>
                    <td>{Math.round(totals.shipmentFact).toLocaleString('ru-RU')}</td>
                    <td>{Math.round(totals.railwayShipmentFact).toLocaleString('ru-RU')}</td>
                    <td>{Math.round(totals.pipeShipmentFact).toLocaleString('ru-RU')}</td>
                    <td>{Math.round(totals.mnppShipmentFact).toLocaleString('ru-RU')}</td>
                    <td>{Math.round(totals.waterShipmentFact).toLocaleString('ru-RU')}</td>
                    {columns.slice(7).map((col) => (
                        <td key={col.key}></td>
                    ))}
                </tr>
                <tr className={s.summaryRow}>
                    <td>Объем парка</td>
                    <td>{Math.round(totals.parkVolume).toLocaleString('ru-RU')}</td>
                    {columns.slice(2).map((col) => (
                        <td key={col.key}></td>
                    ))}
                </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default DataTable;
