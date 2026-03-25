import React, {useEffect, useState, useRef, useCallback} from 'react';
import Header from '../../components/Header/Header';
import ApprovalDots from '../../components/ApprovalDots/ApprovalDots';
import RejectModal from '../../components/RejectModal/RejectModal';
import RefreshIcon from '@mui/icons-material/Refresh';

import * as s from './FactoryPage.module.scss';
import {getProductIndicator, IndicatorColor} from '@/utils/calculations';

import {ApprovalStatus, getTodayApprovals, voteApproval} from '@/api/approvalsApi';
import {
    createScenario, deleteScenario, deleteScenarioEdit,
    getEnterprises, getProductData, getProducts,
    getScenarioData, getScenarios, getUpdateInfo,
    publishScenario, saveScenarioEdit, saveSnapshot, unpublishScenario
} from '@/api/factoriesApi';
import {exportEnterpriseToExcel} from '@/utils/exportToExcel';
import DataTable, {DeviationData} from "@/components/DataTable/DataTable";
import Tabs from "@/components/Tabs/Tabs";

/** Парсит ключ "rowId-field", корректно обрабатывая отрицательные id.
 *  Пример: "-20260403-expected" → [-20260403, "expected"]
 *  Пример: "12345-shipmentFact" → [12345, "shipmentFact"]
 */
const parseEditKey = (key: string): [number, string] => {
    const lastDash = key.lastIndexOf('-');
    return [Number(key.slice(0, lastDash)), key.slice(lastDash + 1)];
};

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
const MAX_UNDO_STEPS = 50;

const FactoryPage: React.FC = () => {
    const [enterprises, setEnterprises] = useState<string[]>([]);
    const [enterprise, setEnterprise] = useState<string>('');
    const [products, setProducts] = useState<string[]>([]);
    const [product, setProduct] = useState<string>('');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [activeScenario, setActiveScenario] = useState<any | null>(null);
    const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
    const [isEditing, setIsEditing] = useState(false);
    const undoStackRef = useRef<Map<string, string>[]>([]);
    const [scenarioBarTab, setScenarioBarTab] = useState<ScenarioBarTab>('scenarios');
    const [showScenarioModal, setShowScenarioModal] = useState(false);
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioAuthor, setScenarioAuthor] = useState('');
    const [scenarioComment, setScenarioComment] = useState('');
    const [productIndicators, setProductIndicators] = useState<Record<string, IndicatorColor>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [approvals, setApprovals] = useState<ApprovalStatus[]>([]);
    const [currentUsername, setCurrentUsername] = useState<string | null | undefined>(undefined);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [editedProducts, setEditedProducts] = useState<Set<string>>(new Set());
    const [updateInfo, setUpdateInfo] = useState<Record<string, Record<string, string>> | null>(null);
    const [deviationData, setDeviationData] = useState<DeviationData | null>(null);
    const [showBottomPanel, setShowBottomPanel] = useState(false);

    const activeScenarioRef = useRef(activeScenario);
    activeScenarioRef.current = activeScenario;
    const editedCellsRef = useRef(editedCells);
    editedCellsRef.current = editedCells;
    const dataRef = useRef(data);
    dataRef.current = data;
    const productRef = useRef(product);
    productRef.current = product;

    useEffect(() => {
        import('../../api/auth').then(({api}) => {
            api.post('/auth/verify')
                .then((res) => {
                    const user = res.data?.User || res.data;
                    setCurrentUsername(user?.username || null);
                })
                .catch(() => setCurrentUsername(null));
        });
    }, []);

    const pushUndoSnapshot = useCallback((currentMap: Map<string, string>) => {
        const snapshot = new Map(currentMap);
        undoStackRef.current = [...undoStackRef.current.slice(-MAX_UNDO_STEPS + 1), snapshot];
    }, []);

    const syncDiffToDB = useCallback(async (prevMap: Map<string, string>, nextMap: Map<string, string>, scenarioId: number, originalData: any[]) => {
        const allKeys = new Set<string>(Array.from(prevMap.keys()).concat(Array.from(nextMap.keys())));
        for (const key of Array.from(allKeys)) {
            const [rowId, field] = parseEditKey(key);
            const prevVal = prevMap.get(key);
            const nextVal = nextMap.get(key);
            if (prevVal === nextVal) continue;
            if (nextVal !== undefined) {
                await saveScenarioEdit(scenarioId, rowId, field, nextVal);
            } else {
                const origRow = originalData.find((r) => r.id === rowId);
                await saveScenarioEdit(scenarioId, rowId, field, origRow ? String(origRow[field] ?? '0') : '0');
            }
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return;
            if (!activeScenarioRef.current || undoStackRef.current.length === 0) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            const prevSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
            undoStackRef.current = undoStackRef.current.slice(0, -1);
            setEditedCells(new Map(prevSnapshot));
            await syncDiffToDB(editedCellsRef.current, prevSnapshot, activeScenarioRef.current.id, dataRef.current);

            // Обновляем editedProducts после отката
            // После setEditedCells и syncDiffToDB:
            const currentData = dataRef.current;
            const currentProduct = productRef.current;
            const hasEdits = Array.from(prevSnapshot.keys()).some((k) => {
                const [rId] = parseEditKey(k);
                return currentData.some((r) => r.id === rId);
            });
            setEditedProducts((prev) => {
                const next = new Set(prev);
                if (hasEdits) {
                    next.add(currentProduct);
                } else {
                    next.delete(currentProduct);
                }
                return next;
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [syncDiffToDB]);

    const loadApprovals = async (ent: string) => {
        try {
            setApprovals(await getTodayApprovals(ent));
        } catch {
        }
    };
    const isApprover = enterprise ? (APPROVERS_BY_ENTERPRISE[enterprise] || []).includes(currentUsername || '') : false;
    const handleApprove = async () => {
        try {
            await voteApproval(enterprise, 'approved');
            await loadApprovals(enterprise);
        } catch (err) {
            console.error(err);
        }
    };
    const handleRejectConfirm = async (comment: string) => {
        setShowRejectModal(false);
        try {
            await voteApproval(enterprise, 'rejected', comment);
            await loadApprovals(enterprise);
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const dataByProduct: Record<string, any[]> = {};
            await Promise.all(products.map(async (p) => {
                dataByProduct[p] = await getProductData(enterprise, p);
            }));
            exportEnterpriseToExcel(products, dataByProduct, (p) => getColumns(enterprise, p), formatDate, `${enterprise}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`);
        } finally {
            setIsExporting(false);
        }
    };

    const loadScenarios = async (username: string | null | undefined = currentUsername) => {
        if (!enterprise) return;
        try {
            setScenarios(await getScenarios(enterprise, username ?? undefined));
        } catch (err: any) {
            if (err?.response?.status === 401) setAuthError(true);
        }
    };

    const detectEditedProducts = async (scenarioId: number, productList: string[], ent: string) => {
        try {
            const scenarioData = await getScenarioData(scenarioId);
            if (!scenarioData.length) {
                setEditedProducts(new Set());
                return;
            }
            const editedIds = new Set(scenarioData.map((r: any) => Number(r.id)));
            const edited = new Set<string>();
            await Promise.all(productList.map(async (p) => {
                const rows = await getProductData(ent, p);
                // Проверяем только реальные строки (положительные id)
                if (rows.some((r) => r.id > 0 && editedIds.has(r.id))) edited.add(p);
            }));
            setEditedProducts(edited);
        } catch {
        }
    };

    const publicScenarios = scenarios.filter((sc) => !sc.isDraft);
    const draftScenarios = scenarios.filter((sc) => sc.isDraft);

    const displayData = data.map((row) => {
        const editedRow = {...row};
        let hasEdits = false;
        const editedFields: string[] = [];
        editedCells.forEach((value, key) => {
            const [rowId, field] = parseEditKey(key);
            if (rowId === row.id) {
                editedRow[field] = Number(value) || value;
                editedFields.push(field);
                hasEdits = true;
            }
        });
        return {...editedRow, edited: hasEdits, editedFields};
    });

    useEffect(() => {
        if (!enterprise || products.length === 0) return;
        (async () => {
            try {
                const ind: Record<string, IndicatorColor> = {};
                await Promise.all(products.map(async (p) => {
                    ind[p] = getProductIndicator(await getProductData(enterprise, p));
                }));
                setProductIndicators(ind);
            } catch (err: any) {
                if (err?.response?.status === 401) setAuthError(true);
            }
        })();
    }, [enterprise, products]);
    useEffect(() => {
        if (!activeScenario || !product || data.length === 0) return;
        const indicator = getProductIndicator(displayData);
        setProductIndicators((prev) => prev[product] === indicator ? prev : {...prev, [product]: indicator});
    }, [editedCells]);
    useEffect(() => {
        getEnterprises().then((list) => {
            setEnterprises(list);
            if (list.length > 0) setEnterprise(list[0]);
        }).catch((err: any) => {
            if (err?.response?.status === 401) setAuthError(true);
        });
    }, []);
    useEffect(() => {
        if (!enterprise || currentUsername === undefined) return;
        getProducts(enterprise).then((list) => {
            setProducts(list);
            if (list.length > 0) setProduct(list[0]);
        }).catch((err: any) => {
            if (err?.response?.status === 401) setAuthError(true);
        });
        loadScenarios(currentUsername);
        setActiveScenario(null);
        setEditedCells(new Map());
        setEditedProducts(new Set());
        undoStackRef.current = [];
        setIsEditing(false);
    }, [enterprise, currentUsername]);
    useEffect(() => {
        if (!enterprise) return;
        loadApprovals(enterprise);
        const interval = setInterval(() => loadApprovals(enterprise), 25000);
        return () => clearInterval(interval);
    }, [enterprise]);
    useEffect(() => {
        if (!enterprise || !product) return;
        setLoading(true);
        getProductData(enterprise, product).then((rows) => {
            setData(rows);
            setLoading(false);
        }).catch((err: any) => {
            if (err?.response?.status === 401) setAuthError(true);
            setLoading(false);
        });
    }, [enterprise, product]);
    useEffect(() => {
        if (!activeScenario || !data.length) return;
        loadScenarioEdits(activeScenario.id);
    }, [activeScenario, data, product]);
    useEffect(() => {
        if (!enterprise) return;
        getUpdateInfo(enterprise).then(setUpdateInfo).catch(() => setUpdateInfo(null));
    }, [enterprise]);

    const loadScenarioEdits = async (scenarioId: number) => {
        try {
            const scenarioData = await getScenarioData(scenarioId);
            if (scenarioData.length > 0) {
                const currentIds = new Set(data.map((r) => r.id));
                const relevantRows = scenarioData.filter((r) => currentIds.has(r.id));
                if (relevantRows.length > 0) {
                    const newEdited = new Map<string, string>();
                    relevantRows.forEach((row) => {
                        Object.entries(row).forEach(([field, value]) => {
                            if (field !== 'id' && value !== null && value !== undefined) {
                                const orig = data.find((r) => r.id === row.id);
                                const origRaw = orig ? orig[field] : null;
                                const origVal = origRaw !== null && origRaw !== undefined
                                    ? String(Math.round(Number(origRaw) || 0))
                                    : null;
                                const savedVal = String(Math.round(Number(value) || 0));
                                // Если оригинал null и сохранённое "0" — не считаем правкой
                                if (origVal === null && savedVal === '0') return;
                                if (savedVal !== (origVal ?? '')) newEdited.set(`${row.id}-${field}`, String(value));
                            }
                        });
                    });
                    setEditedCells(newEdited);
                } else {
                    setEditedCells(new Map());
                }
            } else {
                setEditedCells(new Map());
            }
            undoStackRef.current = [];
        } catch (err: any) {
            if (err?.response?.status === 401) setAuthError(true);
        }
    };

    const handleCellEdit = async (rowId: number, field: string, value: string) => {
        if (!activeScenario) return;
        const originalRow = data.find((r) => r.id === rowId);
        const origRaw = originalRow ? originalRow[field] : null;
        const origVal = origRaw !== null && origRaw !== undefined
            ? String(Math.round(Number(origRaw) || 0))
            : null;
        const newVal = value.trim() === '' ? null : String(Math.round(Number(value) || 0));

        pushUndoSnapshot(editedCells);
        const newEdited = new Map(editedCells);

        // Если оба null или оба одинаковые числа — удаляем правку
        if (newVal === origVal || (newVal === '0' && origVal === null) || (newVal === null && origVal === null)) {
            newEdited.delete(`${rowId}-${field}`);
            setEditedCells(newEdited);
            // Удаляем правку из БД чтобы при перезагрузке не подсвечивалось
            await deleteScenarioEdit(activeScenario.id, rowId, field);
            // Обновляем editedProducts
            const hasEditsForProduct = Array.from(newEdited.keys()).some((k) => {
                const [rId] = parseEditKey(k);
                return data.some((r) => r.id === rId);
            });
            setEditedProducts((prev) => {
                const next = new Set(prev);
                if (hasEditsForProduct) {
                    next.add(product);
                } else {
                    next.delete(product);
                }
                return next;
            });
            return;
        }

        const saveValue = newVal ?? '0';
        newEdited.set(`${rowId}-${field}`, saveValue);
        await saveScenarioEdit(activeScenario.id, rowId, field, saveValue);

        const currentRow = {...(originalRow || {})};
        newEdited.forEach((val, k) => {
            const [rId, f] = parseEditKey(k);
            if (rId === rowId) currentRow[f] = Number(val);
        });

        const shipmentFields = ['railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact'];
        if (shipmentFields.includes(field)) {
            const total = (Number(currentRow.railwayShipmentFact) || 0) + (Number(currentRow.pipeShipmentFact) || 0) + (Number(currentRow.mnppShipmentFact) || 0) + (Number(currentRow.waterShipmentFact) || 0);
            newEdited.set(`${rowId}-shipmentFact`, String(total));
            await saveScenarioEdit(activeScenario.id, rowId, 'shipmentFact', String(total));
        }
        if (['tradeRemains', 'parkVolume'].includes(field)) {
            const fc = (Number(currentRow.parkVolume) || 0) - (Number(currentRow.tradeRemains) || 0);
            newEdited.set(`${rowId}-freeCapacity`, String(fc));
            await saveScenarioEdit(activeScenario.id, rowId, 'freeCapacity', String(fc));
        }
        setEditedCells(newEdited);
        const hasEditsForProduct = Array.from(newEdited.keys()).some((k) => {
            const [rId] = parseEditKey(k);
            return data.some((r) => r.id === rId);
        });
        setEditedProducts((prev) => {
            const next = new Set(prev);
            if (hasEditsForProduct) {
                next.add(product);
            } else {
                next.delete(product);
            }
            return next;
        });
    };

    const handleSaveScenario = async () => {
        if (!activeScenario || !product) return;
        const fields = ['date', 'enterprise', 'product', 'expected', 'plan', 'fact', 'stage', 'tradeRemains', 'freeCapacity', 'parkVolume', 'railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact', 'shipmentFact', 'passport', 'passportForecast', 'unregisteredShipment', 'pourShipment', 'obr', 'shipmentPlan', 'railwayShipment', 'waterShipment', 'pipe', 'mnpp', 'autoShipment', 'autoShipmentFact'];
        const rows: { originalId: number; field: string; value: string }[] = [];
        displayData.forEach((row) => {
            fields.forEach((field) => {
                if (row[field] !== null && row[field] !== undefined) rows.push({
                    originalId: row.id,
                    field,
                    value: String(row[field])
                });
            });
        });
        await saveSnapshot(activeScenario.id, product, rows);
        alert('Сохранено!');
    };

    const handleCreateScenario = async () => {
        if (!scenarioName.trim() || !scenarioAuthor.trim()) return;
        const scenario = await createScenario({
            name: scenarioName,
            author: scenarioAuthor,
            enterprise,
            comment: scenarioComment,
            isDraft: creatingDraft
        });
        setScenarios([scenario, ...scenarios]);
        setActiveScenario(scenario);
        setIsEditing(true);
        setEditedProducts(new Set());
        undoStackRef.current = [];
        setShowScenarioModal(false);
        setScenarioName('');
        setScenarioAuthor('');
        setScenarioComment('');
    };

    const handleDeleteScenario = async (id: number) => {
        await deleteScenario(id);
        setScenarios(scenarios.filter((sc) => sc.id !== id));
        if (activeScenario?.id === id) {
            setActiveScenario(null);
            setEditedCells(new Map());
            setEditedProducts(new Set());
            undoStackRef.current = [];
            setIsEditing(false);
        }
    };
    const handleSelectScenario = (scenario: any) => {
        setActiveScenario(scenario);
        setIsEditing(true);
        setEditedProducts(new Set());
        undoStackRef.current = [];
        if (products.length > 0) detectEditedProducts(scenario.id, products, enterprise);
    };
    const handleBackToOriginal = () => {
        setActiveScenario(null);
        setEditedCells(new Map());
        setEditedProducts(new Set());
        undoStackRef.current = [];
        setIsEditing(false);
        Promise.all(products.map(async (p) => {
            const rows = await getProductData(enterprise, p);
            return [p, getProductIndicator(rows)] as [string, IndicatorColor];
        })).then((entries) => setProductIndicators(Object.fromEntries(entries)));
    };
    const handlePublish = async () => {
        if (!activeScenario) return;
        const updated = await publishScenario(activeScenario.id);
        setActiveScenario(updated);
        setScenarios((prev) => prev.map((sc) => sc.id === updated.id ? updated : sc));
        setScenarioBarTab('scenarios');
    };
    const handleUnpublish = async () => {
        if (!activeScenario) return;
        const updated = await unpublishScenario(activeScenario.id);
        setActiveScenario(updated);
        setScenarios((prev) => prev.map((sc) => sc.id === updated.id ? updated : sc));
        setScenarioBarTab('drafts');
    };

    const handleFillDown = async (rowIds: number[], field: string, value: string) => {
        if (!activeScenario) return;
        pushUndoSnapshot(editedCells);
        const newEdited = new Map(editedCells);
        for (const rowId of rowIds) {
            const originalRow = data.find((r) => r.id === rowId);
            const origRaw = originalRow ? originalRow[field] : null;
            const origVal = origRaw !== null && origRaw !== undefined ? String(Math.round(Number(origRaw) || 0)) : null;
            const newVal = String(Math.round(Number(value) || 0));
            if (newVal === origVal || (newVal === '0' && origVal === null)) {
                newEdited.delete(`${rowId}-${field}`);
                continue;
            }
            newEdited.set(`${rowId}-${field}`, value);
            const shipmentFields = ['railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact'];
            if (shipmentFields.includes(field)) {
                const cr = {...(originalRow || {})};
                newEdited.forEach((val, k) => {
                    const [rId, f] = parseEditKey(k);
                    if (rId === rowId) cr[f] = Number(val);
                });
                newEdited.set(`${rowId}-shipmentFact`, String((Number(cr.railwayShipmentFact) || 0) + (Number(cr.pipeShipmentFact) || 0) + (Number(cr.mnppShipmentFact) || 0) + (Number(cr.waterShipmentFact) || 0)));
            }
            if (['tradeRemains', 'parkVolume'].includes(field)) {
                const cr = {...(originalRow || {})};
                newEdited.forEach((val, k) => {
                    const [rId, f] = parseEditKey(k);
                    if (rId === rowId) cr[f] = Number(val);
                });
                newEdited.set(`${rowId}-freeCapacity`, String((Number(cr.parkVolume) || 0) - (Number(cr.tradeRemains) || 0)));
            }
        }
        setEditedCells(newEdited);
        // Проверяем остались ли правки для текущего продукта
        const hasEditsForProduct = Array.from(newEdited.keys()).some((k) => {
            const [rId] = parseEditKey(k);
            return data.some((r) => r.id === rId);
        });
        setEditedProducts((prev) => {
            const next = new Set(prev);
            if (hasEditsForProduct) {
                next.add(product);
            } else {
                next.delete(product);
            }
            return next;
        });
        for (const rowId of rowIds) {
            const val = newEdited.get(`${rowId}-${field}`);
            if (val !== undefined) {
                await saveScenarioEdit(activeScenario.id, rowId, field, val);
                const sv = newEdited.get(`${rowId}-shipmentFact`);
                if (sv) await saveScenarioEdit(activeScenario.id, rowId, 'shipmentFact', sv);
                const fv = newEdited.get(`${rowId}-freeCapacity`);
                if (fv) await saveScenarioEdit(activeScenario.id, rowId, 'freeCapacity', fv);
            }
        }
    };

    if (authError) return null;
    const isMyScenario = activeScenario?.createdBy === currentUsername;
    const visibleList = scenarioBarTab === 'scenarios' ? publicScenarios : draftScenarios;

    return (
        <div className={s.page}>
            <Header enterprise={enterprise} enterprises={enterprises} onEnterpriseChange={setEnterprise}
                    onExport={handleExport} isExporting={isExporting}/>

            <div className={s.scenarioBar}>
                <div className={s.scenarioLeft}>
                    <button className={`${s.scenarioBtn} ${!activeScenario ? s.active : ''}`}
                            onClick={handleBackToOriginal}>Оригинал
                    </button>
                    <div className={s.divider}/>
                    <div className={s.barTabs}>
                        <button className={`${s.barTab} ${scenarioBarTab === 'scenarios' ? s.barTabActive : ''}`}
                                onClick={() => setScenarioBarTab('scenarios')}>Сценарии{publicScenarios.length > 0 &&
                            <span className={s.barTabCount}>{publicScenarios.length}</span>}</button>
                        <button className={`${s.barTab} ${scenarioBarTab === 'drafts' ? s.barTabActive : ''}`}
                                onClick={() => setScenarioBarTab('drafts')}>Черновики{draftScenarios.length > 0 &&
                            <span className={s.barTabCount}>{draftScenarios.length}</span>}</button>
                    </div>
                    <div className={s.divider}/>
                    {visibleList.length === 0 ? (<span
                        className={s.emptyHint}>{scenarioBarTab === 'scenarios' ? 'Нет сценариев' : 'Нет черновиков'}</span>) : visibleList.map((sc) => (
                        <div key={sc.id} className={s.scenarioItem}>
                            <button
                                className={[s.scenarioBtn, activeScenario?.id === sc.id ? s.active : '', sc.isDraft ? s.draft : ''].filter(Boolean).join(' ')}
                                onClick={() => handleSelectScenario(sc)} title={sc.comment || ''}>
                                <span className={s.scenarioName}>{sc.name}</span><span
                                className={s.scenarioAuthor}>{sc.author}</span>
                            </button>
                            <button className={s.scenarioDelete} onClick={() => handleDeleteScenario(sc.id)}>×</button>
                        </div>
                    ))}
                </div>
                <div className={s.scenarioRight}>
                    {approvals.length > 0 &&
                        <ApprovalDots approvals={approvals} currentUsername={currentUsername ?? null}
                                      isApprover={isApprover && !activeScenario} onApprove={handleApprove}
                                      onReject={() => setShowRejectModal(true)}/>}
                    {activeScenario && (<>
                        <button className={s.saveBtn} onClick={handleSaveScenario}>Сохранить</button>
                        {activeScenario.isDraft && isMyScenario &&
                            <button className={s.publishBtn} onClick={handlePublish}>Опубликовать</button>}
                        {!activeScenario.isDraft && isMyScenario &&
                            <button className={s.unpublishBtn} onClick={handleUnpublish}>В черновик</button>}
                    </>)}
                    <button className={s.createBtn} onClick={() => {
                        setCreatingDraft(scenarioBarTab === 'drafts');
                        setShowScenarioModal(true);
                    }}>{scenarioBarTab === 'drafts' ? '+ Черновик' : '+ Сценарий'}</button>
                    <button className={s.refreshBtn} onClick={() => loadScenarios()} title="Обновить"><RefreshIcon
                        style={{fontSize: 'clamp(14px, 1.4vh, 20px)', color: 'inherit'}}/></button>
                </div>
            </div>

            {showRejectModal && <RejectModal enterprise={enterprise} onConfirm={handleRejectConfirm}
                                             onCancel={() => setShowRejectModal(false)}/>}

            {showScenarioModal && (
                <div className={s.modal} onClick={() => setShowScenarioModal(false)}>
                    <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>{creatingDraft ? 'Новый черновик' : 'Новый сценарий'}</h3>
                        {creatingDraft &&
                            <p className={s.draftHint}>Черновик виден только вам. После публикации станет доступен
                                всем.</p>}
                        <input className={s.modalInput} placeholder="Название" value={scenarioName}
                               onChange={(e) => setScenarioName(e.target.value)} autoFocus/>
                        <input className={s.modalInput} placeholder="Автор" value={scenarioAuthor}
                               onChange={(e) => setScenarioAuthor(e.target.value)} style={{marginTop: '8px'}}/>
                        <textarea className={s.modalTextarea} placeholder="Комментарий (необязательно)"
                                  value={scenarioComment} onChange={(e) => setScenarioComment(e.target.value)} rows={3}
                                  style={{marginTop: '8px'}}/>
                        <div className={s.modalButtons}>
                            <button className={s.modalCancel} onClick={() => setShowScenarioModal(false)}>Отмена
                            </button>
                            <button className={s.modalSave}
                                    onClick={handleCreateScenario}>{creatingDraft ? 'Создать черновик' : 'Создать'}</button>
                        </div>
                    </div>
                </div>
            )}

            {products.length > 0 &&
                <Tabs items={products} active={product} onSelect={setProduct} indicators={productIndicators}
                      editedProducts={activeScenario ? editedProducts : new Set()}/>}

            <div className={s.content}>
                {loading ? (
                    <div className={s.loader}>Загрузка данных...</div>
                ) : (
                    <DataTable
                        columns={getColumns(enterprise, product)}
                        data={displayData}
                        originalData={activeScenario ? data : undefined}
                        formatDate={formatDate}
                        editable={isEditing}
                        onCellEdit={handleCellEdit}
                        onFillDown={handleFillDown}
                        onDeviationData={setDeviationData}
                    />
                )}
            </div>

            <div className={s.bottomStrip} onClick={() => setShowBottomPanel(!showBottomPanel)}>
                <span className={s.bottomStripIcon}>{showBottomPanel ? '▼' : '▲'}</span>
                <span>Сводка: План / Факт / Отклонения</span>
                {updateInfo?.['Обновлено'] && (
                    <span className={s.bottomStripDate}>
                        Данные обновлены {updateInfo['Обновлено'][''] || Object.values(updateInfo['Обновлено'])[0]}
                    </span>
                )}
            </div>

            {showBottomPanel && (
                <div className={s.bottomPanel}>
                    {deviationData && (
                        <div className={s.panelBlock}>
                            <table className={s.totalsTable}>
                                <thead>
                                <tr>
                                    <th></th>
                                    <th>Выработка</th>
                                    <th>Отгрузка</th>
                                    <th>ЖД</th>
                                    <th>Труба</th>
                                    <th>МНПП</th>
                                    <th>Вода</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td className={s.updateCategory}>План</td>
                                    <td>{Math.round(deviationData.planExpected).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.planShipment).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.planRailway).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.planPipe).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.planMnpp).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.planWater).toLocaleString('ru-RU')}</td>
                                </tr>
                                <tr>
                                    <td className={s.updateCategory}>ОБР</td>
                                    <td>{Math.round(deviationData.obrTotal).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.obrShipment).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.obrRailway).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.obrPipe).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.obrMnpp).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.obrWater).toLocaleString('ru-RU')}</td>
                                </tr>
                                <tr>
                                    <td className={s.updateCategory}>Ожид</td>
                                    <td>{Math.round(deviationData.ozhidExpected).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.ozhidShipmentFact).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.ozhidRailway).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.ozhidPipe).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.ozhidMnpp).toLocaleString('ru-RU')}</td>
                                    <td>{Math.round(deviationData.ozhidWater).toLocaleString('ru-RU')}</td>
                                </tr>
                                <tr>
                                    <td className={s.updateCategory}>Парк</td>
                                    <td>{Math.round(deviationData.parkVolume).toLocaleString('ru-RU')}</td>
                                    <td colSpan={5}></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {deviationData && (
                        <div className={s.panelBlock}>
                            <div className={s.devSection}>
                                <div className={s.devSectionTitle}>Отгрузка</div>
                                <div className={s.devRow}>
                                    <span
                                        className={s.devFact}>{Math.round(deviationData.factShipment).toLocaleString('ru-RU')}</span>
                                    <div className={s.devDetails}>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>План</span><span>{Math.round(deviationData.planShipment).toLocaleString('ru-RU')}</span>
                                        </div>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>ОБР</span><span>{Math.round(deviationData.obrShipment).toLocaleString('ru-RU')}</span>
                                        </div>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>Ожид</span><span>{Math.round(deviationData.ozhidShipment).toLocaleString('ru-RU')}</span>
                                        </div>
                                    </div>
                                    <span
                                        className={`${s.devDeviation} ${deviationData.ozhidShipment - deviationData.obrShipment >= 0 ? s.devPositive : s.devNegative}`}>
                                        {Math.round(deviationData.ozhidShipment - deviationData.obrShipment).toLocaleString('ru-RU')}
                                    </span>
                                </div>
                            </div>
                            <div className={s.devSection}>
                                <div className={s.devSectionTitle}>Выработка</div>
                                <div className={s.devRow}>
                                    <span
                                        className={s.devFact}>{Math.round(deviationData.factExpected).toLocaleString('ru-RU')}</span>
                                    <div className={s.devDetails}>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>План</span><span>{Math.round(deviationData.planExpected).toLocaleString('ru-RU')}</span>
                                        </div>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>ОБР</span><span>{Math.round(deviationData.obrExpected).toLocaleString('ru-RU')}</span>
                                        </div>
                                        <div className={s.devLine}><span
                                            className={s.devLabel}>Ожид</span><span>{Math.round(deviationData.ozhidExpected).toLocaleString('ru-RU')}</span>
                                        </div>
                                    </div>
                                    <span
                                        className={`${s.devDeviation} ${deviationData.ozhidExpected - deviationData.obrExpected >= 0 ? s.devPositive : s.devNegative}`}>
                                        {Math.round(deviationData.ozhidExpected - deviationData.obrExpected).toLocaleString('ru-RU')}
                                    </span>
                                </div>
                            </div>
                            <div className={s.devPark}>
                                <span className={s.devLabel}>Парк</span>
                                <span>{Math.round(deviationData.parkVolume).toLocaleString('ru-RU')}</span>
                            </div>
                        </div>
                    )}
                    {updateInfo && (
                        <div className={s.panelBlock}>
                            <div className={s.updateTitle}>Время обновления данных</div>
                            <table className={s.updateTable}>
                                <thead>
                                <tr>
                                    <th></th>
                                    <th>Произ-во</th>
                                    <th>Отгрузка</th>
                                </tr>
                                </thead>
                                <tbody>
                                {['План', 'Факт', 'Ожид', 'ОБР'].filter((cat) => updateInfo[cat]).map((cat) => (
                                    <tr key={cat}>
                                        <td className={s.updateCategory}>{cat}</td>
                                        <td>{updateInfo[cat]['Произ-во'] || '—'}</td>
                                        <td>{updateInfo[cat]['Отгрузка'] || '—'}</td>
                                    </tr>
                                ))}
                                {updateInfo['Обновлено'] && (
                                    <tr className={s.updateUpdatedRow}>
                                        <td colSpan={3}>Данные
                                            обновлены {updateInfo['Обновлено'][''] || Object.values(updateInfo['Обновлено'])[0]}</td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FactoryPage;
