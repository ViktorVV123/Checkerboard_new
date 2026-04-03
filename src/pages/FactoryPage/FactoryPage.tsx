import React, {useEffect, useState} from 'react';
import Header from '../../components/Header/Header';
import ApprovalDots from '../../components/ApprovalDots/ApprovalDots';
import RejectModal from '../../components/RejectModal/RejectModal';
import RefreshIcon from '@mui/icons-material/Refresh';

import * as s from './FactoryPage.module.scss';
import {getProductIndicator, IndicatorColor} from '@/utils/calculations';
import {ApprovalStatus, getTodayApprovals, voteApproval} from '@/api/approvalsApi';
import {
    createScenario, deleteScenarioEdit,
    getEnterprises, getProductData, getProducts,
    getScenarioData, getUpdateInfo,
    saveScenarioEdit, saveSnapshot,
} from '@/api/factoriesApi';
import {exportEnterpriseToExcel} from '@/utils/exportToExcel';
import DataTable, {DeviationData} from '@/components/DataTable/DataTable';
import Tabs from '@/components/Tabs/Tabs';
import BottomPanel from '@/components/BottomPanel/BottomPanel';
import ScenarioModal from '@/components/ScenarioModal/ScenarioModal';
import CalendarDropdown from '@/components/CalendarDropdown/CalendarDropdown';

import {useAuth} from '@/hooks/useAuth';
import {useHistory} from '@/hooks/useHistory';
import {useScenarios} from '@/hooks/useScenarios';

/* ── Константы ── */

const APPROVERS_BY_ENTERPRISE: Record<string, string[]> = {
    'ВНП': ['vlasyukviv', 'kislovdmm', 'borzovpe', 'ivanovdmitrya'],
    'ННОС': ['vlasyukviv', 'kislovdmm', 'borzovpe', 'ivanovdmitrya'],
    'ПНОС': ['vlasyukviv', 'kislovdmm', 'borzovpe', 'ivanovdmitrya'],
};

const getColumns = (enterprise: string, product: string) => {
    const isNnosSpecial = enterprise === 'ННОС' && (product === 'Нефть' || product === 'ВГЛ');
    return [
        {key: 'date', label: 'Дата'},
        {key: 'expected', label: isNnosSpecial ? 'Переработка' : 'Выработка', color: 'blue' as const, editable: true},
        {key: 'shipmentFact', label: isNnosSpecial ? 'Поставка (всего)' : 'Отгрузка (всего)', absValue: isNnosSpecial},
        {key: 'railwayShipmentFact', label: 'ЖД', color: 'red' as const, editable: true, absValue: isNnosSpecial},
        {key: 'pipeShipmentFact', label: 'Труба', color: 'red' as const, editable: true, absValue: isNnosSpecial},
        {key: 'mnppShipmentFact', label: 'МНПП', color: 'red' as const, editable: true, absValue: isNnosSpecial},
        {key: 'waterShipmentFact', label: 'Вода', color: 'green' as const, editable: true, absValue: isNnosSpecial},
        {key: 'tradeRemains', label: 'Остатки (товар + компонент)'},
        {key: 'passport', label: 'Остатки (паспорт)'},
        {key: 'freeCapacity', label: 'Своб. емкость'},
        {key: 'unregisteredShipment', label: 'Неоформл. отгрузка'},
    ];
};

const formatDate = (dateNum: number): string => {
    const str = String(dateNum);
    const month = str.slice(4, 6);
    const day = str.slice(6, 8);
    const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${parseInt(day)}.${months[parseInt(month)]}`;
};

type ScenarioBarTab = 'scenarios' | 'drafts';

/* ── Компонента ── */

const FactoryPage: React.FC = () => {
    const [enterprises, setEnterprises] = useState<string[]>([]);
    const [enterprise, setEnterprise] = useState('');
    const [products, setProducts] = useState<string[]>([]);
    const [product, setProduct] = useState('');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [productIndicators, setProductIndicators] = useState<Record<string, IndicatorColor>>({});

    const [scenarioBarTab, setScenarioBarTab] = useState<ScenarioBarTab>('scenarios');
    const [showScenarioModal, setShowScenarioModal] = useState(false);
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioAuthor, setScenarioAuthor] = useState('');
    const [scenarioComment, setScenarioComment] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showBottomPanel, setShowBottomPanel] = useState(false);
    const [deviationData, setDeviationData] = useState<DeviationData | null>(null);
    const [updateInfo, setUpdateInfo] = useState<Record<string, Record<string, string>> | null>(null);
    const [approvals, setApprovals] = useState<ApprovalStatus[]>([]);
    const [showRejectModal, setShowRejectModal] = useState(false);

    const {currentUsername, authError, setAuthError} = useAuth();
    const history = useHistory();
    const scenario = useScenarios(enterprise, product, data, products, currentUsername, setProductIndicators);

    const isApprover = enterprise ? (APPROVERS_BY_ENTERPRISE[enterprise] || []).includes(currentUsername || '') : false;
    const isMyScenario = scenario.activeScenario?.createdBy === currentUsername;
    const visibleList = scenarioBarTab === 'scenarios' ? scenario.publicScenarios : scenario.draftScenarios;

    const displayData = data.map((row) => {
        const editedRow = {...row};
        let hasEdits = false;
        const editedFields: string[] = [];
        scenario.editedCells.forEach((value, key) => {
            const [rowId, field] = scenario.parseEditKey(key);
            if (rowId === row.id) {
                editedRow[field] = Number(value) || value;
                editedFields.push(field);
                hasEdits = true;
            }
        });
        return {...editedRow, edited: hasEdits, editedFields};
    });

    /* ── EFFECTS ── */

    useEffect(() => {
        getEnterprises().then((list) => {
            setEnterprises(list);
            if (list.length > 0) setEnterprise(list[0]);
        }).catch((err: any) => { if (err?.response?.status === 401) setAuthError(true); });
    }, []);

    useEffect(() => {
        if (!enterprise || currentUsername === undefined) return;
        getProducts(enterprise).then((list) => {
            setProducts(list);
            if (list.length > 0) setProduct(list[0]);
        }).catch((err: any) => { if (err?.response?.status === 401) setAuthError(true); });
        scenario.loadScenarios(currentUsername);
        scenario.resetScenarioState();
    }, [enterprise, currentUsername]);

    useEffect(() => {
        if (!enterprise || !product) return;
        setLoading(true);
        const loadData = history.selectedHistoryDate
            ? import('@/api/factoriesApi').then(m => m.getHistorySnapshot(enterprise, product, history.selectedHistoryDate!))
            : getProductData(enterprise, product);
        loadData.then((rows) => { setData(rows); setLoading(false); })
            .catch((err: any) => { if (err?.response?.status === 401) setAuthError(true); setLoading(false); });
    }, [enterprise, product, history.selectedHistoryDate]);

    useEffect(() => {
        if (!scenario.activeScenario || !data.length) return;
        loadScenarioEdits(scenario.activeScenario.id);
    }, [scenario.activeScenario, data, product]);

    useEffect(() => {
        if (!enterprise || products.length === 0) return;
        (async () => {
            try {
                const ind: Record<string, IndicatorColor> = {};
                await Promise.all(products.map(async (p) => { ind[p] = getProductIndicator(await getProductData(enterprise, p)); }));
                setProductIndicators(ind);
            } catch (err: any) { if (err?.response?.status === 401) setAuthError(true); }
        })();
    }, [enterprise, products]);

    useEffect(() => {
        if (!scenario.activeScenario || !product || data.length === 0) return;
        const indicator = getProductIndicator(displayData);
        setProductIndicators((prev) => prev[product] === indicator ? prev : {...prev, [product]: indicator});
    }, [scenario.editedCells]);

    useEffect(() => {
        if (!enterprise) return;
        const load = () => getTodayApprovals(enterprise).then(setApprovals).catch(() => {});
        load();
        const interval = setInterval(load, 25000);
        return () => clearInterval(interval);
    }, [enterprise]);

    useEffect(() => {
        if (!enterprise) return;
        getUpdateInfo(enterprise).then(setUpdateInfo).catch(() => setUpdateInfo(null));
    }, [enterprise]);

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return;
            if (!scenario.activeScenarioRef.current || scenario.undoStackRef.current.length === 0) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            const prevSnapshot = scenario.undoStackRef.current[scenario.undoStackRef.current.length - 1];
            scenario.undoStackRef.current = scenario.undoStackRef.current.slice(0, -1);
            scenario.setEditedCells(new Map(prevSnapshot));
            const allKeys = new Set([...Array.from(scenario.editedCellsRef.current.keys()), ...Array.from(prevSnapshot.keys())]);
            for (const key of Array.from(allKeys)) {
                const [rowId, field] = scenario.parseEditKey(key);
                const prev = scenario.editedCellsRef.current.get(key);
                const next = prevSnapshot.get(key);
                if (prev === next) continue;
                if (next !== undefined) await saveScenarioEdit(scenario.activeScenarioRef.current.id, rowId, field, next);
                else await deleteScenarioEdit(scenario.activeScenarioRef.current.id, rowId, field);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    /* ── HANDLERS ── */

    const loadScenarioEdits = async (scenarioId: number) => {
        try {
            const scenarioData = await getScenarioData(scenarioId);
            if (scenarioData.length > 0) {
                const currentIds = new Set(data.map((r) => r.id));
                const relevantRows = scenarioData.filter((r: any) => currentIds.has(r.id));
                const newEdited = new Map<string, string>();
                relevantRows.forEach((row: any) => {
                    Object.entries(row).forEach(([field, value]) => {
                        if (field !== 'id' && value !== null && value !== undefined) {
                            const orig = data.find((r) => r.id === row.id);
                            const origRaw = orig ? orig[field] : null;
                            const origVal = origRaw !== null && origRaw !== undefined ? String(Math.round(Number(origRaw) || 0)) : null;
                            const savedVal = String(Math.round(Number(value as any) || 0));
                            if (origVal === null && savedVal === '0') return;
                            if (savedVal !== (origVal ?? '')) newEdited.set(`${row.id}-${field}`, String(value));
                        }
                    });
                });
                scenario.setEditedCells(newEdited);
            } else {
                scenario.setEditedCells(new Map());
            }
            scenario.undoStackRef.current = [];
        } catch (err: any) { if (err?.response?.status === 401) setAuthError(true); }
    };

    const computeDerivedEdits = (newEdited: Map<string, string>, rowId: number, field: string, originalRow: any) => {
        const currentRow = {...(originalRow || {})};
        newEdited.forEach((val, k) => { const [rId, f] = scenario.parseEditKey(k); if (rId === rowId) currentRow[f] = Number(val); });
        const shipmentFields = ['railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact'];
        if (shipmentFields.includes(field)) {
            const total = (Number(currentRow.railwayShipmentFact) || 0) + (Number(currentRow.pipeShipmentFact) || 0) + (Number(currentRow.mnppShipmentFact) || 0) + (Number(currentRow.waterShipmentFact) || 0);
            const origShipment = originalRow ? Number(originalRow.shipmentFact) || 0 : 0;
            return {field: 'shipmentFact', value: String(total), isOriginal: Math.round(total) === Math.round(origShipment)};
        }
        if (['tradeRemains', 'parkVolume'].includes(field)) {
            const fc = (Number(currentRow.parkVolume) || 0) - (Number(currentRow.tradeRemains) || 0);
            const origFc = originalRow ? Number(originalRow.freeCapacity) || 0 : 0;
            return {field: 'freeCapacity', value: String(fc), isOriginal: Math.round(fc) === Math.round(origFc)};
        }
        return null;
    };

    const updateEditedProductsFlag = (newEdited: Map<string, string>) => {
        const hasEdits = Array.from(newEdited.keys()).some((k) => { const [rId] = scenario.parseEditKey(k); return data.some((r) => r.id === rId); });
        scenario.setEditedProducts((prev) => { const next = new Set(prev); if (hasEdits) next.add(product); else next.delete(product); return next; });
    };

    const handleCellEdit = async (rowId: number, field: string, value: string) => {
        if (!scenario.activeScenario) return;
        const originalRow = data.find((r) => r.id === rowId);
        const origRaw = originalRow ? originalRow[field] : null;
        const origVal = origRaw !== null && origRaw !== undefined ? String(Math.round(Number(origRaw) || 0)) : null;
        const newVal = value.trim() === '' ? null : String(Math.round(Number(value) || 0));
        scenario.pushUndoSnapshot(scenario.editedCells);
        const newEdited = new Map(scenario.editedCells);
        const sid = scenario.activeScenario.id;
        const isRevert = newVal === origVal || (newVal === '0' && origVal === null) || (newVal === null && origVal === null);
        if (isRevert) { newEdited.delete(`${rowId}-${field}`); await deleteScenarioEdit(sid, rowId, field); }
        else { newEdited.set(`${rowId}-${field}`, newVal ?? '0'); await saveScenarioEdit(sid, rowId, field, newVal ?? '0'); }
        const derived = computeDerivedEdits(newEdited, rowId, field, originalRow);
        if (derived) {
            if (derived.isOriginal) { newEdited.delete(`${rowId}-${derived.field}`); await deleteScenarioEdit(sid, rowId, derived.field); }
            else { newEdited.set(`${rowId}-${derived.field}`, derived.value); await saveScenarioEdit(sid, rowId, derived.field, derived.value); }
        }
        scenario.setEditedCells(newEdited);
        updateEditedProductsFlag(newEdited);
    };

    const handlePasteMultiple = async (edits: { rowId: number; field: string; value: string }[]) => {
        if (!scenario.activeScenario) return;
        scenario.pushUndoSnapshot(scenario.editedCells);
        const newEdited = new Map(scenario.editedCells);
        const toDelete: { rowId: number; field: string }[] = [];
        const sid = scenario.activeScenario.id;
        for (const {rowId, field, value} of edits) {
            const originalRow = data.find((r) => r.id === rowId);
            const origRaw = originalRow ? originalRow[field] : null;
            const origVal = origRaw !== null && origRaw !== undefined ? String(Math.round(Number(origRaw) || 0)) : null;
            const newVal = value.trim() === '' ? null : String(Math.round(Number(value) || 0));
            if (newVal === origVal || (newVal === '0' && origVal === null) || (newVal === null && origVal === null)) { newEdited.delete(`${rowId}-${field}`); toDelete.push({rowId, field}); }
            else { newEdited.set(`${rowId}-${field}`, newVal ?? '0'); }
            const derived = computeDerivedEdits(newEdited, rowId, field, originalRow);
            if (derived) newEdited.set(`${rowId}-${derived.field}`, derived.value);
        }
        scenario.setEditedCells(newEdited);
        updateEditedProductsFlag(newEdited);
        for (const {rowId, field} of toDelete) await deleteScenarioEdit(sid, rowId, field);
        for (const {rowId, field} of edits) {
            const val = newEdited.get(`${rowId}-${field}`);
            if (val !== undefined) {
                await saveScenarioEdit(sid, rowId, field, val);
                const sv = newEdited.get(`${rowId}-shipmentFact`); if (sv) await saveScenarioEdit(sid, rowId, 'shipmentFact', sv);
                const fv = newEdited.get(`${rowId}-freeCapacity`); if (fv) await saveScenarioEdit(sid, rowId, 'freeCapacity', fv);
            }
        }
    };

    const handleFillDown = async (rowIds: number[], field: string, value: string) => {
        if (!scenario.activeScenario) return;
        scenario.pushUndoSnapshot(scenario.editedCells);
        const newEdited = new Map(scenario.editedCells);
        const toDelete: { rowId: number; field: string }[] = [];
        const sid = scenario.activeScenario.id;
        for (const rowId of rowIds) {
            const originalRow = data.find((r) => r.id === rowId);
            const origRaw = originalRow ? originalRow[field] : null;
            const origVal = origRaw !== null && origRaw !== undefined ? String(Math.round(Number(origRaw) || 0)) : null;
            const newVal = String(Math.round(Number(value) || 0));
            if (newVal === origVal || (newVal === '0' && origVal === null)) { newEdited.delete(`${rowId}-${field}`); toDelete.push({rowId, field}); }
            else { newEdited.set(`${rowId}-${field}`, value); }
            const derived = computeDerivedEdits(newEdited, rowId, field, originalRow);
            if (derived) newEdited.set(`${rowId}-${derived.field}`, derived.value);
        }
        scenario.setEditedCells(newEdited);
        updateEditedProductsFlag(newEdited);
        for (const {rowId, field: f} of toDelete) await deleteScenarioEdit(sid, rowId, f);
        for (const rowId of rowIds) {
            const val = newEdited.get(`${rowId}-${field}`);
            if (val !== undefined) {
                await saveScenarioEdit(sid, rowId, field, val);
                const sv = newEdited.get(`${rowId}-shipmentFact`); if (sv) await saveScenarioEdit(sid, rowId, 'shipmentFact', sv);
                const fv = newEdited.get(`${rowId}-freeCapacity`); if (fv) await saveScenarioEdit(sid, rowId, 'freeCapacity', fv);
            }
        }
    };

    const handleSaveScenario = async () => {
        if (!scenario.activeScenario || !product) return;
        const fields = ['date', 'enterprise', 'product', 'expected', 'plan', 'fact', 'stage', 'tradeRemains', 'freeCapacity', 'parkVolume', 'railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact', 'shipmentFact', 'passport', 'passportForecast', 'unregisteredShipment', 'pourShipment', 'obr', 'shipmentPlan', 'railwayShipment', 'waterShipment', 'pipe', 'mnpp', 'autoShipment', 'autoShipmentFact'];
        const rows: { originalId: number; field: string; value: string }[] = [];
        displayData.forEach((row) => { fields.forEach((f) => { if (row[f] !== null && row[f] !== undefined) rows.push({originalId: row.id, field: f, value: String(row[f])}); }); });
        await saveSnapshot(scenario.activeScenario.id, product, rows);
        alert('Сохранено!');
    };

    const handleCreateScenario = async () => {
        if (!scenarioName.trim() || !scenarioAuthor.trim()) return;
        const sc = await createScenario({name: scenarioName, author: scenarioAuthor, enterprise, comment: scenarioComment, isDraft: creatingDraft});
        scenario.setScenarios([sc, ...scenario.scenarios]);
        scenario.setActiveScenario(sc);
        scenario.setIsEditing(true);
        scenario.setEditedProducts(new Set());
        scenario.undoStackRef.current = [];
        setShowScenarioModal(false);
        setScenarioName(''); setScenarioAuthor(''); setScenarioComment('');
    };

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const dataByProduct: Record<string, any[]> = {};
            if (scenario.activeScenario) {
                const scenarioData = await getScenarioData(scenario.activeScenario.id);
                const editsMap = new Map<number, Record<string, any>>();
                for (const edit of scenarioData) { if (!editsMap.has(edit.id)) editsMap.set(edit.id, {}); Object.entries(edit).forEach(([f, v]) => { if (f !== 'id' && v !== null && v !== undefined) editsMap.get(edit.id)![f] = v; }); }
                await Promise.all(products.map(async (p) => { const rows = await getProductData(enterprise, p); dataByProduct[p] = rows.map((row) => { const edits = editsMap.get(row.id); if (!edits) return row; const edited = {...row}; Object.entries(edits).forEach(([f, v]) => { edited[f] = Number(v) || v; }); return edited; }); }));
            } else {
                await Promise.all(products.map(async (p) => { dataByProduct[p] = await getProductData(enterprise, p); }));
            }
            const suffix = scenario.activeScenario ? `_${scenario.activeScenario.name}` : '';
            exportEnterpriseToExcel(products, dataByProduct, (p) => getColumns(enterprise, p), formatDate, `${enterprise}${suffix}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`);
        } finally { setIsExporting(false); }
    };

    const handleApprove = async () => { try { await voteApproval(enterprise, 'approved'); setApprovals(await getTodayApprovals(enterprise)); } catch {} };
    const handleRejectConfirm = async (comment: string) => { setShowRejectModal(false); try { await voteApproval(enterprise, 'rejected', comment); setApprovals(await getTodayApprovals(enterprise)); } catch {} };

    const handleSelectHistoryDate = (date: string) => { history.selectHistoryDate(date); scenario.resetScenarioState(); };
    const handleBackToOriginal = () => { scenario.handleBackToOriginal(); history.setSelectedHistoryDate(null); };

    /* ── RENDER ── */

    if (authError) return null;

    return (
        <div className={s.page}>
            <Header enterprise={enterprise} enterprises={enterprises} onEnterpriseChange={setEnterprise} onExport={handleExport} isExporting={isExporting}/>

            <div className={s.scenarioBar}>
                <div className={s.scenarioLeft}>
                    <CalendarDropdown
                        btnRef={history.calendarBtnRef}
                        isOpen={history.showCalendar}
                        onToggle={history.toggleCalendar}
                        dates={history.historyDates}
                        selectedDate={history.selectedHistoryDate}
                        onSelectDate={handleSelectHistoryDate}
                        onBackToLive={history.backToLive}
                        position={history.calendarPos}
                    />

                    <button className={`${s.scenarioBtn} ${!scenario.activeScenario && !history.selectedHistoryDate ? s.active : ''}`} onClick={handleBackToOriginal}>
                        {history.selectedHistoryDate ? `Архив: ${new Date(history.selectedHistoryDate).toLocaleDateString('ru-RU')}` : 'Оригинал'}
                    </button>

                    {!history.selectedHistoryDate && (
                        <>
                            <div className={s.divider}/>
                            <div className={s.barTabs}>
                                <button className={`${s.barTab} ${scenarioBarTab === 'scenarios' ? s.barTabActive : ''}`} onClick={() => setScenarioBarTab('scenarios')}>
                                    Сценарии{scenario.publicScenarios.length > 0 && <span className={s.barTabCount}>{scenario.publicScenarios.length}</span>}
                                </button>
                                <button className={`${s.barTab} ${scenarioBarTab === 'drafts' ? s.barTabActive : ''}`} onClick={() => setScenarioBarTab('drafts')}>
                                    Черновики{scenario.draftScenarios.length > 0 && <span className={s.barTabCount}>{scenario.draftScenarios.length}</span>}
                                </button>
                            </div>
                            <div className={s.divider}/>
                            {visibleList.length === 0
                                ? <span className={s.emptyHint}>{scenarioBarTab === 'scenarios' ? 'Нет сценариев' : 'Нет черновиков'}</span>
                                : visibleList.map((sc) => (
                                    <div key={sc.id} className={s.scenarioItem}>
                                        <button className={[s.scenarioBtn, scenario.activeScenario?.id === sc.id ? s.active : '', sc.isDraft ? s.draft : ''].filter(Boolean).join(' ')}
                                                onClick={() => scenario.handleSelectScenario(sc)} title={sc.comment || ''}>
                                            <span className={s.scenarioName}>{sc.name}</span>
                                            <span className={s.scenarioAuthor}>{sc.author}</span>
                                        </button>
                                        <button className={s.scenarioDelete} onClick={() => scenario.handleDeleteScenario(sc.id)}>×</button>
                                    </div>
                                ))}
                        </>
                    )}
                </div>

                <div className={s.scenarioRight}>
                    {approvals.length > 0 &&
                        <ApprovalDots approvals={approvals} currentUsername={currentUsername ?? null}
                                      isApprover={isApprover && !scenario.activeScenario} onApprove={handleApprove}
                                      onReject={() => setShowRejectModal(true)}/>}
                    {!history.selectedHistoryDate && scenario.activeScenario && (
                        <>
                            <button className={s.saveBtn} onClick={handleSaveScenario}>Сохранить</button>
                            {scenario.activeScenario.isDraft && isMyScenario &&
                                <button className={s.publishBtn} onClick={() => { scenario.handlePublish(); setScenarioBarTab('scenarios'); }}>Опубликовать</button>}
                            {!scenario.activeScenario.isDraft && isMyScenario &&
                                <button className={s.unpublishBtn} onClick={() => { scenario.handleUnpublish(); setScenarioBarTab('drafts'); }}>В черновик</button>}
                        </>
                    )}
                    {!history.selectedHistoryDate && (
                        <button className={s.createBtn} onClick={() => { setCreatingDraft(scenarioBarTab === 'drafts'); setShowScenarioModal(true); }}>
                            {scenarioBarTab === 'drafts' ? '+ Черновик' : '+ Сценарий'}
                        </button>
                    )}
                    <button className={s.refreshBtn} onClick={() => scenario.loadScenarios(currentUsername)} title="Обновить">
                        <RefreshIcon style={{fontSize: 'clamp(14px, 1.4vh, 20px)', color: 'inherit'}}/>
                    </button>
                </div>
            </div>

            {showRejectModal && <RejectModal enterprise={enterprise} onConfirm={handleRejectConfirm} onCancel={() => setShowRejectModal(false)}/>}

            {showScenarioModal && (
                <ScenarioModal
                    isDraft={creatingDraft}
                    name={scenarioName}
                    author={scenarioAuthor}
                    comment={scenarioComment}
                    onNameChange={setScenarioName}
                    onAuthorChange={setScenarioAuthor}
                    onCommentChange={setScenarioComment}
                    onCreate={handleCreateScenario}
                    onClose={() => setShowScenarioModal(false)}
                />
            )}

            {products.length > 0 &&
                <Tabs items={products} active={product} onSelect={setProduct} indicators={productIndicators}
                      editedProducts={scenario.activeScenario ? scenario.editedProducts : new Set()}/>}

            <div className={s.content}>
                {loading
                    ? <div className={s.loader}>Загрузка данных...</div>
                    : <DataTable columns={getColumns(enterprise, product)} data={displayData}
                                 originalData={scenario.activeScenario ? data : undefined} formatDate={formatDate}
                                 editable={scenario.isEditing && !history.selectedHistoryDate}
                                 onCellEdit={handleCellEdit} onFillDown={handleFillDown}
                                 onDeviationData={setDeviationData} onPasteMultiple={handlePasteMultiple}/>}
            </div>

            <div className={s.bottomStrip} onClick={() => setShowBottomPanel(!showBottomPanel)}>
                <span className={s.bottomStripIcon}>{showBottomPanel ? '▼' : '▲'}</span>
                <span>Сводка: План / Факт / Отклонения</span>
                {updateInfo?.['Обновлено'] && <span className={s.bottomStripDate}>Данные обновлены {updateInfo['Обновлено'][''] || Object.values(updateInfo['Обновлено'])[0]}</span>}
            </div>

            {showBottomPanel && <BottomPanel deviationData={deviationData} updateInfo={updateInfo}/>}
        </div>
    );
};

export default FactoryPage;
