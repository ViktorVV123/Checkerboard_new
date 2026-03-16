import React, { useEffect, useState } from 'react';
import Header from '../../components/Header/Header';
import Tabs from '../../components/Tabs/Tabs';
import DataTable from '../../components/DataTable/DataTable';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    getEnterprises,
    getProducts,
    getProductData,
    getScenarios,
    createScenario,
    deleteScenario,
    saveScenarioEdit,
    saveSnapshot,
    getScenarioData,
    approveScenario,
} from '../../api/factoriesApi';
import * as s from './FactoryPage.module.scss';
import { getProductIndicator, IndicatorColor } from '@/utils/calculations';

const getColumns = (enterprise: string, product: string) => {
    const isNnosSpecial = enterprise === 'ННОС' && (product === 'Нефть' || product === 'ВГЛ');

    return [
        { key: 'date', label: 'Дата' },
        { key: 'expected', label: isNnosSpecial ? 'Переработка' : 'Выработка', color: 'blue' as const, editable: true },
        { key: 'shipmentFact', label: isNnosSpecial ? 'Поставка (всего)' : 'Отгрузка (всего)', absValue: isNnosSpecial },
        { key: 'railwayShipmentFact', label: 'ЖД', color: 'red' as const, editable: true, absValue: isNnosSpecial },
        { key: 'pipeShipmentFact', label: 'Труба', color: 'red' as const, editable: true, absValue: isNnosSpecial },
        { key: 'mnppShipmentFact', label: 'МНПП', color: 'red' as const, editable: true, absValue: isNnosSpecial },
        { key: 'waterShipmentFact', label: 'Вода', color: 'green' as const, editable: true, absValue: isNnosSpecial },
        { key: 'tradeRemains', label: 'Остатки (товар + компонент)' },
        { key: 'passport', label: 'Остатки (паспорт)' },
        { key: 'freeCapacity', label: 'Своб. емкость' },
        { key: 'unregisteredShipment', label: 'Неоформл. отгрузка' },
    ];
};

const formatDate = (dateNum: number): string => {
    const str = String(dateNum);
    const month = str.slice(4, 6);
    const day = str.slice(6, 8);
    const months = [
        '', 'янв', 'фев', 'мар', 'апр', 'май', 'июн',
        'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
    ];
    return `${parseInt(day)}.${months[parseInt(month)]}`;
};

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
    const [showScenarioModal, setShowScenarioModal] = useState(false);
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioAuthor, setScenarioAuthor] = useState('');
    const [scenarioComment, setScenarioComment] = useState('');
    const [createFromApproved, setCreateFromApproved] = useState(false);

    const [productIndicators, setProductIndicators] = useState<Record<string, IndicatorColor>>({});

    const loadScenarios = async () => {
        if (!enterprise) return;
        try {
            const list = await getScenarios(enterprise);
            setScenarios(list);
        } catch (err: any) {
            if (err?.response?.status === 401) setAuthError(true);
        }
    };

    const displayData = data.map((row) => {
        const editedRow = { ...row };
        let hasEdits = false;
        const editedFields: string[] = [];

        editedCells.forEach((value, key) => {
            const [rowId, field] = key.split('-');
            if (Number(rowId) === row.id) {
                editedRow[field] = Number(value) || value;
                editedFields.push(field);
                hasEdits = true;
            }
        });

        return { ...editedRow, edited: hasEdits, editedFields };
    });

    useEffect(() => {
        if (!enterprise || products.length === 0) return;

        const loadIndicators = async () => {
            try {
                const indicators: Record<string, IndicatorColor> = {};
                await Promise.all(
                    products.map(async (p) => {
                        const rows = await getProductData(enterprise, p);
                        indicators[p] = getProductIndicator(rows);
                    }),
                );
                setProductIndicators(indicators);
            } catch (err: any) {
                if (err?.response?.status === 401) setAuthError(true);
            }
        };

        loadIndicators();
    }, [enterprise, products]);

    useEffect(() => {
        if (!activeScenario || !product || data.length === 0) return;

        const indicator = getProductIndicator(displayData);
        setProductIndicators((prev) => {
            if (prev[product] === indicator) return prev;
            return { ...prev, [product]: indicator };
        });
    }, [editedCells]);

    useEffect(() => {
        getEnterprises()
            .then((list) => {
                setEnterprises(list);
                if (list.length > 0) setEnterprise(list[0]);
            })
            .catch((err: any) => {
                if (err?.response?.status === 401) setAuthError(true);
            });
    }, []);

    useEffect(() => {
        if (!enterprise) return;
        getProducts(enterprise)
            .then((list) => {
                setProducts(list);
                if (list.length > 0) setProduct(list[0]);
            })
            .catch((err: any) => {
                if (err?.response?.status === 401) setAuthError(true);
            });
        loadScenarios();
        setActiveScenario(null);
        setEditedCells(new Map());
        setIsEditing(false);
    }, [enterprise]);

    useEffect(() => {
        if (!enterprise || !product) return;
        setLoading(true);
        getProductData(enterprise, product)
            .then((rows) => {
                setData(rows);
                setLoading(false);
            })
            .catch((err: any) => {
                if (err?.response?.status === 401) setAuthError(true);
                setLoading(false);
            });
    }, [enterprise, product]);

    useEffect(() => {
        if (!activeScenario || !data.length) return;
        loadScenarioEdits(activeScenario.id);
    }, [activeScenario, data, product]);

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
                                const originalRow = data.find((r) => r.id === row.id);
                                const originalValue = originalRow
                                    ? String(Math.round(Number(originalRow[field]) || 0))
                                    : '0';
                                const savedValue = String(Math.round(Number(value) || 0));
                                if (savedValue !== originalValue) {
                                    newEdited.set(`${row.id}-${field}`, String(value));
                                }
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
        } catch (err: any) {
            if (err?.response?.status === 401) setAuthError(true);
        }
    };

    const handleCellEdit = async (rowId: number, field: string, value: string) => {
        if (!activeScenario) return;
        const key = `${rowId}-${field}`;

        const originalRow = data.find((r) => r.id === rowId);
        const originalValue = originalRow ? String(Math.round(Number(originalRow[field]) || 0)) : '0';
        const newValue = String(Math.round(Number(value) || 0));

        if (newValue === originalValue) {
            const newEdited = new Map(editedCells);
            newEdited.delete(key);
            setEditedCells(newEdited);
            return;
        }

        const newEdited = new Map(editedCells);
        newEdited.set(key, value);

        await saveScenarioEdit(activeScenario.id, rowId, field, value);

        const currentRow = { ...originalRow };
        newEdited.forEach((val, k) => {
            const [rId, f] = k.split('-');
            if (Number(rId) === rowId) {
                currentRow[f] = Number(val);
            }
        });

        const shipmentFields = ['railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact'];
        if (shipmentFields.includes(field)) {
            const zhd = Number(currentRow.railwayShipmentFact) || 0;
            const pipe = Number(currentRow.pipeShipmentFact) || 0;
            const mnpp = Number(currentRow.mnppShipmentFact) || 0;
            const water = Number(currentRow.waterShipmentFact) || 0;
            const total = zhd + pipe + mnpp + water;

            newEdited.set(`${rowId}-shipmentFact`, String(total));
            await saveScenarioEdit(activeScenario.id, rowId, 'shipmentFact', String(total));
        }

        const freeCapacityFields = ['tradeRemains', 'parkVolume'];
        if (freeCapacityFields.includes(field)) {
            const parkVolume = Number(currentRow.parkVolume) || 0;
            const tradeRemains = Number(currentRow.tradeRemains) || 0;
            const freeCapacity = parkVolume - tradeRemains;

            newEdited.set(`${rowId}-freeCapacity`, String(freeCapacity));
            await saveScenarioEdit(activeScenario.id, rowId, 'freeCapacity', String(freeCapacity));
        }

        setEditedCells(newEdited);
    };

    const getSnapshotFields = () => [
        'date', 'enterprise', 'product', 'expected', 'plan', 'fact',
        'stage', 'tradeRemains', 'freeCapacity', 'parkVolume',
        'railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact',
        'waterShipmentFact', 'shipmentFact', 'passport', 'passportForecast',
        'unregisteredShipment', 'pourShipment', 'obr',
        'shipmentPlan', 'railwayShipment', 'waterShipment', 'pipe',
        'mnpp', 'autoShipment', 'autoShipmentFact',
    ];

    const handleSaveScenario = async () => {
        if (!activeScenario || !product) return;

        const fields = getSnapshotFields();
        const rows: { originalId: number; field: string; value: string }[] = [];

        displayData.forEach((row) => {
            fields.forEach((field) => {
                if (row[field] !== null && row[field] !== undefined) {
                    rows.push({
                        originalId: row.id,
                        field,
                        value: String(row[field]),
                    });
                }
            });
        });

        await saveSnapshot(activeScenario.id, product, rows);
        alert('Сценарий сохранён!');
    };

    const handleCreateScenario = async () => {
        if (!scenarioName.trim() || !scenarioAuthor.trim()) return;

        const scenario = await createScenario({
            name: scenarioName,
            author: scenarioAuthor,
            enterprise,
            comment: scenarioComment,
        });

        // Если создаём от утверждённого — копируем его данные
        if (createFromApproved) {
            const approvedScenario = scenarios.find((sc) => sc.approved);
            if (approvedScenario) {
                const approvedData = await getScenarioData(approvedScenario.id);
                if (approvedData.length > 0) {
                    const rows: { originalId: number; field: string; value: string }[] = [];
                    approvedData.forEach((row) => {
                        Object.entries(row).forEach(([field, value]) => {
                            if (field !== 'id' && value !== null && value !== undefined) {
                                rows.push({
                                    originalId: row.id,
                                    field,
                                    value: String(value),
                                });
                            }
                        });
                    });
                    await saveSnapshot(scenario.id, product, rows);
                }
            }
        }

        setScenarios([scenario, ...scenarios]);
        setActiveScenario(scenario);
        setIsEditing(true);
        setShowScenarioModal(false);
        setScenarioName('');
        setScenarioAuthor('');
        setScenarioComment('');
        setCreateFromApproved(false);
    };

    const handleDeleteScenario = async (id: number) => {
        await deleteScenario(id);
        setScenarios(scenarios.filter((sc) => sc.id !== id));
        if (activeScenario?.id === id) {
            setActiveScenario(null);
            setEditedCells(new Map());
            setIsEditing(false);
        }
    };

    const handleSelectScenario = (scenario: any) => {
        setActiveScenario(scenario);
        setIsEditing(!scenario.approved);
    };

    const handleBackToOriginal = () => {
        setActiveScenario(null);
        setEditedCells(new Map());
        setIsEditing(false);

        if (enterprise && products.length > 0) {
            const loadIndicators = async () => {
                const indicators: Record<string, IndicatorColor> = {};
                await Promise.all(
                    products.map(async (p) => {
                        const rows = await getProductData(enterprise, p);
                        indicators[p] = getProductIndicator(rows);
                    }),
                );
                setProductIndicators(indicators);
            };
            loadIndicators();
        }
    };

    const handleApproveScenario = async () => {
        if (!activeScenario || !product) return;

        const confirmApprove = window.confirm(
            `Утвердить сценарий "${activeScenario.name}"? Все текущие данные будут сохранены.`
        );
        if (!confirmApprove) return;

        const fields = getSnapshotFields();
        const rows: { originalId: number; field: string; value: string }[] = [];
        displayData.forEach((row) => {
            fields.forEach((field) => {
                if (row[field] !== null && row[field] !== undefined) {
                    rows.push({
                        originalId: row.id,
                        field,
                        value: String(row[field]),
                    });
                }
            });
        });

        await saveSnapshot(activeScenario.id, product, rows);

        const approved = await approveScenario(activeScenario.id, 'user');
        setScenarios((prev) =>
            prev.map((sc) => ({
                ...sc,
                approved: sc.id === approved.id,
                approvedAt: sc.id === approved.id ? approved.approvedAt : null,
                approvedBy: sc.id === approved.id ? approved.approvedBy : null,
            }))
        );
        setActiveScenario(approved);
        setIsEditing(false);
    };

    const handleFillDown = async (rowIds: number[], field: string, value: string) => {
        if (!activeScenario) return;

        const newEdited = new Map(editedCells);

        for (const rowId of rowIds) {
            const originalRow = data.find((r) => r.id === rowId);
            const originalValue = originalRow ? String(Math.round(Number(originalRow[field]) || 0)) : '0';
            const newValue = String(Math.round(Number(value) || 0));

            if (newValue === originalValue) {
                newEdited.delete(`${rowId}-${field}`);
                continue;
            }

            newEdited.set(`${rowId}-${field}`, value);

            const shipmentFields = ['railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact', 'waterShipmentFact'];
            if (shipmentFields.includes(field)) {
                const currentRow = { ...originalRow };
                newEdited.forEach((val, k) => {
                    const [rId, f] = k.split('-');
                    if (Number(rId) === rowId) {
                        currentRow[f] = Number(val);
                    }
                });

                const zhd = Number(currentRow.railwayShipmentFact) || 0;
                const pipe = Number(currentRow.pipeShipmentFact) || 0;
                const mnpp = Number(currentRow.mnppShipmentFact) || 0;
                const water = Number(currentRow.waterShipmentFact) || 0;
                const total = zhd + pipe + mnpp + water;

                newEdited.set(`${rowId}-shipmentFact`, String(total));
            }

            const freeCapacityFields = ['tradeRemains', 'parkVolume'];
            if (freeCapacityFields.includes(field)) {
                const currentRow = { ...originalRow };
                newEdited.forEach((val, k) => {
                    const [rId, f] = k.split('-');
                    if (Number(rId) === rowId) {
                        currentRow[f] = Number(val);
                    }
                });

                const parkVolume = Number(currentRow.parkVolume) || 0;
                const tradeRemains = Number(currentRow.tradeRemains) || 0;
                newEdited.set(`${rowId}-freeCapacity`, String(parkVolume - tradeRemains));
            }
        }

        setEditedCells(newEdited);

        for (const rowId of rowIds) {
            const val = newEdited.get(`${rowId}-${field}`);
            if (val !== undefined) {
                await saveScenarioEdit(activeScenario.id, rowId, field, val);

                const shipmentVal = newEdited.get(`${rowId}-shipmentFact`);
                if (shipmentVal !== undefined) {
                    await saveScenarioEdit(activeScenario.id, rowId, 'shipmentFact', shipmentVal);
                }

                const freeCapVal = newEdited.get(`${rowId}-freeCapacity`);
                if (freeCapVal !== undefined) {
                    await saveScenarioEdit(activeScenario.id, rowId, 'freeCapacity', freeCapVal);
                }
            }
        }
    };

    if (authError) {
        return null;
    }

    const closeModal = () => {
        setShowScenarioModal(false);
        setCreateFromApproved(false);
    };

    return (
        <div className={s.page}>
            <Header
                enterprise={enterprise}
                enterprises={enterprises}
                onEnterpriseChange={setEnterprise}
            />

            <div className={s.scenarioBar}>
                <div className={s.scenarioLeft}>
                    <button
                        className={`${s.scenarioBtn} ${!activeScenario ? s.active : ''}`}
                        onClick={handleBackToOriginal}
                    >
                        Оригинал
                    </button>
                    {[...scenarios]
                        .sort((a, b) => (b.approved ? 1 : 0) - (a.approved ? 1 : 0))
                        .map((sc) => (
                            <div key={sc.id} className={s.scenarioItem}>
                                <button
                                    className={`${s.scenarioBtn} ${activeScenario?.id === sc.id ? s.active : ''} ${sc.approved ? s.approved : ''}`}
                                    onClick={() => handleSelectScenario(sc)}
                                    title={sc.comment || ''}
                                >
                                    <span className={s.scenarioName}>
                                        {sc.approved && '✓ '}{sc.name}
                                    </span>
                                    <span className={s.scenarioAuthor}>{sc.author}</span>
                                </button>
                                <button
                                    className={s.scenarioDelete}
                                    onClick={() => handleDeleteScenario(sc.id)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                </div>
                <div className={s.scenarioRight}>
                    {activeScenario && !activeScenario.approved && (
                        <>
                            <button className={s.saveBtn} onClick={handleSaveScenario}>
                                Сохранить
                            </button>
                            <button className={s.approveBtn} onClick={handleApproveScenario}>
                                Утвердить
                            </button>
                        </>
                    )}
                    {activeScenario && activeScenario.approved && (
                        <span className={s.approvedBadge}>Утверждён</span>
                    )}
                    <button className={s.createBtn} onClick={() => setShowScenarioModal(true)}>
                        Создать сценарий
                    </button>
                    <button className={s.refreshBtn} onClick={loadScenarios} title="Обновить список сценариев">
                        <RefreshIcon style={{ fontSize: 18, color: 'inherit' }} />
                    </button>
                </div>
            </div>

            {showScenarioModal && (
                <div className={s.modal} onClick={closeModal}>
                    <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Новый сценарий</h3>
                        <input
                            className={s.modalInput}
                            placeholder="Название сценария"
                            value={scenarioName}
                            onChange={(e) => setScenarioName(e.target.value)}
                            autoFocus
                        />
                        <input
                            className={s.modalInput}
                            placeholder="Автор"
                            value={scenarioAuthor}
                            onChange={(e) => setScenarioAuthor(e.target.value)}
                            style={{ marginTop: '8px' }}
                        />
                        <textarea
                            className={s.modalTextarea}
                            placeholder="Комментарий (необязательно)"
                            value={scenarioComment}
                            onChange={(e) => setScenarioComment(e.target.value)}
                            rows={3}
                            style={{ marginTop: '8px' }}
                        />
                        {scenarios.some((sc) => sc.approved) && (
                            <label className={s.checkboxLabel} style={{ marginTop: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={createFromApproved}
                                    onChange={(e) => setCreateFromApproved(e.target.checked)}
                                />
                                <span>Создать на основе утверждённого сценария</span>
                            </label>
                        )}
                        <div className={s.modalButtons}>
                            <button className={s.modalCancel} onClick={closeModal}>
                                Отмена
                            </button>
                            <button className={s.modalSave} onClick={handleCreateScenario}>
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {products.length > 0 && (
                <Tabs
                    items={products}
                    active={product}
                    onSelect={setProduct}
                    indicators={productIndicators}
                />
            )}

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
                    />
                )}
            </div>
        </div>
    );
};

export default FactoryPage;
