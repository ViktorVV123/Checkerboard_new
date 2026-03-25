import React, {useState, useCallback, useRef, useEffect} from 'react';
import * as s from './DataTable.module.scss';
import {calculateAllRows} from '@/utils/calculations';

interface Column {
    key: string;
    label: string;
    color?: 'blue' | 'red' | 'green';
    editable?: boolean;
    absValue?: boolean;
}

export interface UpdateInfoData {
    [category: string]: { [sub: string]: string };
}

export interface DeviationData {
    factExpected: number;
    factShipment: number;
    ozhidExpected: number;
    ozhidShipment: number;
    planExpected: number;
    planShipment: number;
    obrExpected: number;
    obrShipment: number;
    parkVolume: number;
    ozhidShipmentFact: number;
    ozhidRailway: number;
    ozhidPipe: number;
    ozhidMnpp: number;
    ozhidWater: number;
    planRailway: number;
    planPipe: number;
    planMnpp: number;
    planWater: number;
    obrRailway: number;
    obrPipe: number;
    obrMnpp: number;
    obrWater: number;
    obrTotal: number;
}

interface DataTableProps {
    columns: Column[];
    data: any[];
    originalData?: any[];
    formatDate?: (date: number) => string;
    editable?: boolean;
    onCellEdit?: (rowId: number, field: string, value: string) => void;
    onFillDown?: (rowIds: number[], field: string, value: string) => void;
    onDeviationData?: (data: DeviationData) => void;
    onPasteMultiple?: (edits: { rowId: number; field: string; value: string }[]) => void;
}

const DataTable: React.FC<DataTableProps> = ({
                                                 columns,
                                                 data,
                                                 formatDate,
                                                 editable = false,
                                                 onCellEdit,
                                                 onFillDown,
                                                 originalData,
                                                 onDeviationData,
                                                 onPasteMultiple,
                                             }) => {
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [fillSource, setFillSource] = useState<{ rowIndex: number; colKey: string; value: any } | null>(null);
    const [fillTargetIndex, setFillTargetIndex] = useState<number | null>(null);
    const [lastClickedCell, setLastClickedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
    const isDragging = useRef(false);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const rowRectsRef = useRef<DOMRect[]>([]);

    const formatValue = (value: any, isNumericCol: boolean = false): string => {
        if (value === null || value === undefined) {
            return isNumericCol ? '0' : '';
        }
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

    const handleCellClick = (rowId: number, col: Column, currentValue: any, rowIndex: number) => {
        if (!editable || !col.editable) return;
        if (isDragging.current) return;
        setLastClickedCell({ rowIndex, colKey: col.key });
        const key = `${rowId}-${col.key}`;
        setEditingCell(key);
        setEditValue(currentValue !== null && currentValue !== undefined ? String(Math.round(Number(currentValue))) : '');
    };

    const handleCellSave = (rowId: number, field: string) => {
        if (onCellEdit) onCellEdit(rowId, field, editValue);
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowId: number, field: string) => {
        if (e.key === 'Enter') handleCellSave(rowId, field);
        if (e.key === 'Escape') setEditingCell(null);
    };

    const handleFillHandleMouseDown = useCallback(
        (e: React.MouseEvent, rowIndex: number, colKey: string, value: any) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging.current = true;
            setFillSource({rowIndex, colKey, value});
            setFillTargetIndex(rowIndex);
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

    // ── Fill-down drag ──
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !fillSourceRef.current) return;
            const rects = rowRectsRef.current;
            const sourceIdx = fillSourceRef.current.rowIndex;
            const y = e.clientY;
            let targetIdx = sourceIdx;
            for (let i = sourceIdx + 1; i < rects.length; i++) {
                const rect = rects[i];
                const rowCenter = rect.top + rect.height / 2;
                if (y >= rowCenter) { targetIdx = i; } else { break; }
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
                    if (currentData[i]) rowIds.push(currentData[i].id);
                }
                if (rowIds.length > 0) {
                    if (onFillDown) {
                        onFillDown(rowIds, source.colKey, String(source.value));
                    } else if (onCellEdit) {
                        rowIds.forEach((id) => onCellEdit(id, source.colKey, String(source.value)));
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

    // ── Paste из Excel (multi-row) ──
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!lastClickedCell || !editable) return;

            const text = e.clipboardData?.getData('text/plain');
            if (!text) return;

            const values = text.split(/\r?\n/).filter((v) => v.trim() !== '');

            // Одно значение — пусть браузер вставит в инпут как обычно
            if (values.length <= 1) return;

            // Многострочная вставка — перехватываем
            e.preventDefault();

            const { rowIndex, colKey } = lastClickedCell;
            const currentData = processedDataRef.current;

            // Закрываем инпут если открыт
            setEditingCell(null);

            const edits: { rowId: number; field: string; value: string }[] = [];
            for (let i = 0; i < values.length; i++) {
                const targetRow = currentData[rowIndex + i];
                if (!targetRow) break;
                const cleanValue = values[i].trim().replace(/[\s\u00a0]/g, '');
                edits.push({ rowId: targetRow.id, field: colKey, value: cleanValue });
            }

            if (edits.length > 0 && onPasteMultiple) {
                onPasteMultiple(edits);
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [lastClickedCell, editable, onPasteMultiple]);

    const isCellInFillRange = (rowIndex: number, colKey: string): boolean => {
        if (!fillSource || fillTargetIndex === null) return false;
        return colKey === fillSource.colKey && rowIndex > fillSource.rowIndex && rowIndex <= fillTargetIndex;
    };

    // ── Даты ──
    const now = new Date();
    const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
    const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 6);
    const weekEnd = weekFromNow.getFullYear() * 10000 + (weekFromNow.getMonth() + 1) * 100 + weekFromNow.getDate();

    // ── Totals ──
    const totals: Record<string, number> = {
        plan: 0, expected: 0, shipmentFact: 0,
        railwayShipmentFact: 0, pipeShipmentFact: 0,
        mnppShipmentFact: 0, waterShipmentFact: 0,
        obr: 0, parkVolume: 0,
        railwayPlan: 0, pipePlan: 0, mnppPlan: 0, waterPlan: 0,
        railwayObr: 0, pipeObr: 0, mnppObr: 0, waterObr: 0,
    };

    let factExpected = 0;
    let factShipment = 0;

    processedData.forEach((row) => {
        const dateStr = String(row.date);
        const rowMonth = Number(dateStr.slice(0, 6));
        const rowDate = Number(row.date);

        if (rowMonth === currentMonth) {
            totals.plan += Number(row.plan) || 0;
            totals.expected += Number(row.expected) || 0;
            totals.shipmentFact += Number(row.shipmentFact) || 0;
            totals.railwayShipmentFact += Number(row.railwayShipmentFact) || 0;
            totals.pipeShipmentFact += Number(row.pipeShipmentFact) || 0;
            totals.mnppShipmentFact += Number(row.mnppShipmentFact) || 0;
            totals.waterShipmentFact += Number(row.waterShipmentFact) || 0;

            if (rowDate < today) {
                factExpected += Math.abs(Number(row.expected) || 0);
                factShipment += Math.abs(Number(row.shipmentFact) || 0);
            }
        }
    });

    const latestRow = [...processedData]
        .reverse()
        .find((r) => Number(r.date) <= today && Number(r.date) >= currentMonth * 100 + 1);

    if (latestRow) {
        totals.railwayPlan = Number(latestRow.railwayPlan) || 0;
        totals.pipePlan = Number(latestRow.pipePlan) || 0;
        totals.mnppPlan = Number(latestRow.mnppPlan) || 0;
        totals.waterPlan = Number(latestRow.waterPlan) || 0;
        totals.railwayObr = Number(latestRow.railwayObr) || 0;
        totals.pipeObr = Number(latestRow.pipeObr) || 0;
        totals.mnppObr = Number(latestRow.mnppObr) || 0;
        totals.waterObr = Number(latestRow.waterObr) || 0;
    }

    const obrRow = processedData.find((r) => r.obr);
    if (obrRow) totals.obr = Number(obrRow.obr);

    const parkRow = processedData.find((r) => Number(r.parkVolume) > 0);
    if (parkRow) totals.parkVolume = Number(parkRow.parkVolume);

    const planShipmentTotal = Math.abs(totals.railwayPlan) + Math.abs(totals.pipePlan) + Math.abs(totals.mnppPlan) + Math.abs(totals.waterPlan);
    const obrShipmentTotal = Math.abs(totals.railwayObr) + Math.abs(totals.pipeObr) + Math.abs(totals.mnppObr) + Math.abs(totals.waterObr);

    const prevDeviationRef = useRef<string>('');

    useEffect(() => {
        if (!onDeviationData || processedData.length === 0) return;
        const newData: DeviationData = {
            factExpected,
            factShipment,
            ozhidExpected: Math.abs(totals.expected),
            ozhidShipment: Math.abs(totals.shipmentFact),
            planExpected: totals.plan,
            planShipment: planShipmentTotal,
            obrExpected: totals.obr,
            obrShipment: obrShipmentTotal,
            parkVolume: totals.parkVolume,
            ozhidShipmentFact: Math.abs(totals.shipmentFact),
            ozhidRailway: Math.abs(totals.railwayShipmentFact),
            ozhidPipe: Math.abs(totals.pipeShipmentFact),
            ozhidMnpp: Math.abs(totals.mnppShipmentFact),
            ozhidWater: Math.abs(totals.waterShipmentFact),
            planRailway: Math.abs(totals.railwayPlan),
            planPipe: Math.abs(totals.pipePlan),
            planMnpp: Math.abs(totals.mnppPlan),
            planWater: Math.abs(totals.waterPlan),
            obrRailway: Math.abs(totals.railwayObr),
            obrPipe: Math.abs(totals.pipeObr),
            obrMnpp: Math.abs(totals.mnppObr),
            obrWater: Math.abs(totals.waterObr),
            obrTotal: totals.obr,
        };
        const key = JSON.stringify(newData);
        if (key !== prevDeviationRef.current) {
            prevDeviationRef.current = key;
            onDeviationData(newData);
        }
    });

    const getRowClass = (date: number): string => {
        if (date < today) return s.pastRow;
        if (date >= today && date <= weekEnd) return s.currentWeekRow;
        return '';
    };

    return (
        <div className={s.wrapper}>
            <table className={s.table} ref={tableRef}>
                <thead>
                <tr>
                    {columns.map((col) => (
                        <th key={col.key} className={getColorClass(col.color)}>
                            {col.label}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody ref={tbodyRef}>
                {processedData.map((row, rowIndex) => (
                    <tr key={row.id || rowIndex} className={getRowClass(Number(row.date))}>
                        {columns.map((col) => {
                            const cellKey = `${row.id}-${col.key}`;
                            const isEditing = editingCell === cellKey;
                            const isEdited = row.editedFields?.includes(col.key);
                            const cellValue = row[col.key];
                            const inFillRange = isCellInFillRange(rowIndex, col.key);
                            const isNegativeRemains = col.key === 'tradeRemains' && Number(row.date) >= today && cellValue !== null && cellValue !== undefined && Number(cellValue) < 0;
                            const isLowCapacity = col.key === 'freeCapacity' && Number(row.date) >= today && row.freeCapacity !== null && row.freeCapacity !== undefined && row.expected !== null && row.expected !== undefined && Number(row.freeCapacity) < Math.abs(Number(row.expected));
                            const cellClass = [getColorClass(col.color), isEdited ? s.editedCell : '', editable && col.editable ? s.editableCell : '', isNegativeRemains ? s.yellowText : '', isLowCapacity ? s.redText : '', inFillRange ? s.fillPreview : ''].filter(Boolean).join(' ');
                            const showFillHandle = editable && col.editable && !isEditing && cellValue !== null && cellValue !== undefined && cellValue !== '';

                            return (
                                <td key={col.key} className={cellClass}
                                    onClick={() => handleCellClick(row.id, col, row[col.key], rowIndex)}>
                                    {isEditing ? (
                                        <input className={s.cellInput} value={editValue}
                                               onChange={(e) => setEditValue(e.target.value)}
                                               onBlur={() => handleCellSave(row.id, col.key)}
                                               onKeyDown={(e) => handleKeyDown(e, row.id, col.key)} autoFocus/>
                                    ) : col.key === 'date' && formatDate ? (
                                        formatDate(row[col.key])
                                    ) : (
                                        <>
                                            {inFillRange
                                                ? formatValue(col.absValue ? Math.abs(Number(fillSource?.value) || 0) : fillSource?.value, col.key !== 'date')
                                                : formatValue(col.absValue ? Math.abs(Number(row[col.key]) || 0) : row[col.key], col.key !== 'date')}
                                            {showFillHandle && (
                                                <span className={s.fillHandle}
                                                      onMouseDown={(e) => handleFillHandleMouseDown(e, rowIndex, col.key, cellValue)}/>
                                            )}
                                        </>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;
