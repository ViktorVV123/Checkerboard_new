// src/components/ImportExcel/ImportPreviewModal.tsx
import React, { useMemo, useState } from 'react';
import {
    ImportPreviewResponse,
    PreviewUnrecognized,
    UnrecognizedReason,
} from '../../api/importApi';
import {
    dbProductToDisplay,
    FIELD_LABELS,
} from '../../utils/excelSchema';
import * as s from './ImportPreviewModal.module.scss';

interface Props {
    fileName: string;
    preview: ImportPreviewResponse;
    defaultScenarioName?: string;
    onClose: () => void;
    onConfirm: (params: { scenarioName: string; comment: string }) => void;
    isCommitting: boolean;
}

const reasonLabels: Record<UnrecognizedReason, string> = {
    no_code: 'нет кода в шаблоне',
    unknown_product_id: 'продукта нет в маппинге',
    unknown_prefix: 'неизвестный тип данных',
    ignored_prefix: 'служебная колонка (не загружаем)',
};

const formatYmd = (ymd: number): string => {
    const s = String(ymd);
    return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
};

const formatNumber = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
};

const ImportPreviewModal: React.FC<Props> = ({
    fileName,
    preview,
    defaultScenarioName,
    onClose,
    onConfirm,
    isCommitting,
}) => {
    const [scenarioName, setScenarioName] = useState(
        defaultScenarioName ?? `Импорт ${fileName.replace(/\.xlsx$/i, '')}`,
    );
    const [comment, setComment] = useState('');

    /** Группируем edits для UI: product → field → count и пример. */
    const editsByProduct = useMemo(() => {
        const map = new Map<
            string,
            { byField: Map<string, number>; minDate: number; maxDate: number }
        >();
        for (const e of preview.edits) {
            const key = e.product;
            if (!map.has(key)) {
                map.set(key, {
                    byField: new Map(),
                    minDate: e.date,
                    maxDate: e.date,
                });
            }
            const entry = map.get(key)!;
            entry.byField.set(e.field, (entry.byField.get(e.field) ?? 0) + 1);
            if (e.date < entry.minDate) entry.minDate = e.date;
            if (e.date > entry.maxDate) entry.maxDate = e.date;
        }
        return Array.from(map.entries())
            .map(([dbProduct, info]) => ({
                dbProduct,
                displayName: dbProductToDisplay(dbProduct),
                byField: info.byField,
                minDate: info.minDate,
                maxDate: info.maxDate,
                totalEdits: Array.from(info.byField.values()).reduce((a, b) => a + b, 0),
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [preview.edits]);

    /** parkVolume по продукту — отдельной табличкой. */
    const parkByProduct = useMemo(() => {
        return preview.parkVolumes.map((pv) => ({
            ...pv,
            displayName: dbProductToDisplay(pv.product),
        }));
    }, [preview.parkVolumes]);

    /** Нераспознанные — группируем по причине, чтобы 16 одинаковых "no_code" не пугали. */
    const unrecognizedGrouped = useMemo(() => {
        const map = new Map<UnrecognizedReason, PreviewUnrecognized[]>();
        for (const u of preview.unrecognized) {
            if (!map.has(u.reason)) map.set(u.reason, []);
            map.get(u.reason)!.push(u);
        }
        return Array.from(map.entries());
    }, [preview.unrecognized]);

    const handleConfirm = () => {
        if (!scenarioName.trim() || isCommitting) return;
        onConfirm({ scenarioName: scenarioName.trim(), comment: comment.trim() });
    };

    return (
        <div className={s.modal} onClick={onClose}>
            <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={s.header}>
                    <h3>Импорт шахматки</h3>
                    <button className={s.closeBtn} onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>

                <div className={s.fileInfo}>
                    Файл: <span className={s.fileName}>{fileName}</span>
                </div>

                {/* Сводка */}
                <div className={s.summary}>
                    <div className={s.summaryItem}>
                        <span className={s.summaryLabel}>Распознано продуктов:</span>
                        <span className={s.summaryValue}>{preview.summary.matchedProducts.length}</span>
                    </div>
                    <div className={s.summaryItem}>
                        <span className={s.summaryLabel}>Дней с данными:</span>
                        <span className={s.summaryValue}>{preview.summary.dataRowsCount}</span>
                    </div>
                    <div className={s.summaryItem}>
                        <span className={s.summaryLabel}>Период:</span>
                        <span className={s.summaryValue}>
                            {formatYmd(preview.summary.dateRange.from)} — {formatYmd(preview.summary.dateRange.to)}
                        </span>
                    </div>
                  {/*  <div className={s.summaryItem}>
                        <span className={s.summaryLabel}>Всего правок:</span>
                        <span className={s.summaryValue}>{preview.summary.editsCount}</span>
                    </div>*/}
                </div>

                {/* Что загрузится */}
                <div className={s.section}>
                    <h4>Будет загружено</h4>
                    <div className={s.tableWrap}>
                        <table className={s.previewTable}>
                            <thead>
                                <tr>
                                    <th>Продукт</th>
                                    <th>Период</th>
                                    <th>Поля</th>
                                    <th>Объём парка</th>
                                </tr>
                            </thead>
                            <tbody>
                                {editsByProduct.map((row) => {
                                    const park = parkByProduct.find((p) => p.product === row.dbProduct);
                                    return (
                                        <tr key={row.dbProduct}>
                                            <td className={s.productCell}>{row.displayName}</td>
                                            <td className={s.dateCell}>
                                                {formatYmd(row.minDate)} — {formatYmd(row.maxDate)}
                                            </td>
                                            <td>
                                                <div className={s.fieldsList}>
                                                    {Array.from(row.byField.entries()).map(([field, count]) => (
                                                        <span key={field} className={s.fieldChip} title={`${count} значений`}>
                                                            {FIELD_LABELS[field] ?? field}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className={s.numCell}>
                                                {park ? formatNumber(park.value) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* продукты, у которых ТОЛЬКО парк (без edits) — редкий случай */}
                                {parkByProduct
                                    .filter((p) => !editsByProduct.some((e) => e.dbProduct === p.product))
                                    .map((p) => (
                                        <tr key={`park-only-${p.product}`}>
                                            <td className={s.productCell}>{p.displayName}</td>
                                            <td colSpan={2} className={s.muted}>только объём парка</td>
                                            <td className={s.numCell}>{formatNumber(p.value)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Что не распознали */}
                {/*{unrecognizedGrouped.length > 0 && (
                    <div className={s.section}>
                        <h4 className={s.warnTitle}>Не загружено</h4>
                        <div className={s.unrecognizedList}>
                            {unrecognizedGrouped.map(([reason, items]) => (
                                <div key={reason} className={s.unrecognizedGroup}>
                                    <div className={s.unrecognizedReason}>
                                        {reasonLabels[reason]} <span className={s.muted}>({items.length})</span>
                                    </div>
                                    <div className={s.unrecognizedItems}>
                                        {items.slice(0, 6).map((u, i) => (
                                            <span key={i} className={s.unrecognizedItem}>
                                                {u.productLabel ?? '?'}
                                                {u.metricLabel ? ` / ${u.metricLabel}` : ''}
                                            </span>
                                        ))}
                                        {items.length > 6 && (
                                            <span className={s.muted}>и ещё {items.length - 6}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}*/}

                {/* Поля черновика */}
                <div className={s.section}>
                    <h4>Создать черновик</h4>
                    <input
                        className={s.modalInput}
                        placeholder="Название черновика"
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        disabled={isCommitting}
                        autoFocus
                    />
                    <textarea
                        className={s.modalTextarea}
                        placeholder="Комментарий (необязательно)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        disabled={isCommitting}
                        style={{ marginTop: '8px' }}
                    />
                    <p className={s.draftHint}>
                        Импорт создаст новый черновик. Он будет виден только вам, пока вы его не опубликуете.
                    </p>
                </div>

                <div className={s.modalButtons}>
                    <button className={s.cancelBtn} onClick={onClose} disabled={isCommitting}>
                        Отмена
                    </button>
                    <button
                        className={s.confirmBtn}
                        onClick={handleConfirm}
                        disabled={!scenarioName.trim() || isCommitting}
                    >
                        {isCommitting ? 'Сохранение...' : 'Создать черновик'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportPreviewModal;
