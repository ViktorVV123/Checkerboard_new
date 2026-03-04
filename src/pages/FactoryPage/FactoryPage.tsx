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
} from '../../api/factoriesApi';
import * as s from './FactoryPage.module.scss';
import {getProductIndicator, IndicatorColor} from "@/utils/calculations";



const COLUMNS = [
    { key: 'date', label: 'Дата' },
    { key: 'expected', label: 'Выработка', color: 'blue' as const, editable: true },
    { key: 'shipmentFact', label: 'Отгрузка (всего)' },
    { key: 'railwayShipmentFact', label: 'ЖД', color: 'red' as const, editable: true },
    { key: 'pipeShipmentFact', label: 'Труба', color: 'red' as const, editable: true },
    { key: 'mnppShipmentFact', label: 'МНПП', color: 'red' as const, editable: true },
    { key: 'waterShipmentFact', label: 'Вода', color: 'green' as const, editable: true },
    { key: 'tradeRemains', label: 'Остатки (товар + компонент)' },
    { key: 'passport', label: 'Остатки (паспорт)' },
    { key: 'freeCapacity', label: 'Своб. емкость' },
    { key: 'unregisteredShipment', label: 'Неоформл. отгрузка' },
];

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

    // Сценарии
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [activeScenario, setActiveScenario] = useState<any | null>(null);
    const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
    const [isEditing, setIsEditing] = useState(false);
    const [showScenarioModal, setShowScenarioModal] = useState(false);
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioAuthor, setScenarioAuthor] = useState('');
    const [scenarioComment, setScenarioComment] = useState('');

    const [productIndicators, setProductIndicators] = useState<Record<string, IndicatorColor>>({});

    const loadScenarios = async () => {
        if (!enterprise) return;
        const list = await getScenarios(enterprise);
        setScenarios(list);
    };

    useEffect(() => {
        if (!enterprise || products.length === 0) return;

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
    }, [enterprise, products]);

    useEffect(() => {
        getEnterprises().then((list) => {
            setEnterprises(list);
            if (list.length > 0) setEnterprise(list[0]);
        });
    }, []);

    useEffect(() => {
        if (!enterprise) return;
        getProducts(enterprise).then((list) => {
            setProducts(list);
            if (list.length > 0) setProduct(list[0]);
        });
        loadScenarios();
        setActiveScenario(null);
        setEditedCells(new Map());
        setIsEditing(false);
    }, [enterprise]);

    useEffect(() => {
        if (!enterprise || !product) return;
        setLoading(true);
        getProductData(enterprise, product).then((rows) => {
            setData(rows);
            setLoading(false);
        });
    }, [enterprise, product]);

    // При переключении сценария или продукта — загружаем данные сценария
    useEffect(() => {
        if (!activeScenario || !data.length) return;
        loadScenarioEdits(activeScenario.id);
    }, [activeScenario, data, product]);

    const loadScenarioEdits = async (scenarioId: number) => {
        const scenarioData = await getScenarioData(scenarioId);

        if (scenarioData.length > 0) {
            // Фильтруем по текущему продукту — ищем по originalId из наших данных
            const currentIds = new Set(data.map((r) => r.id));
            const relevantRows = scenarioData.filter((r) => currentIds.has(r.id));

            if (relevantRows.length > 0) {
                const newEdited = new Map<string, string>();
                relevantRows.forEach((row) => {
                    Object.entries(row).forEach(([field, value]) => {
                        if (field !== 'id' && value !== null && value !== undefined) {
                            // Сравниваем с оригиналом — подсвечиваем только изменённые
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
    };

    const handleCellEdit = async (rowId: number, field: string, value: string) => {
        if (!activeScenario) return;
        const key = `${rowId}-${field}`;

        const originalRow = data.find((r) => r.id === rowId);
        const originalValue = originalRow ? String(Math.round(Number(originalRow[field]) || 0)) : '0';
        const newValue = String(Math.round(Number(value) || 0));

        // Если значение не изменилось — убираем подсветку
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

    const handleSaveScenario = async () => {
        if (!activeScenario || !product) return;

        const fields = [
            'date', 'enterprise', 'product', 'expected', 'plan', 'fact',
            'stage', 'tradeRemains', 'freeCapacity', 'parkVolume',
            'railwayShipmentFact', 'pipeShipmentFact', 'mnppShipmentFact',
            'waterShipmentFact', 'shipmentFact', 'passport', 'passportForecast',
            'unregisteredShipment', 'pourShipment', 'obr',
            'shipmentPlan', 'railwayShipment', 'waterShipment', 'pipe',
            'mnpp', 'autoShipment', 'autoShipmentFact',
        ];

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
        setScenarios([scenario, ...scenarios]);
        setActiveScenario(scenario);
        setIsEditing(true);
        setShowScenarioModal(false);
        setScenarioName('');
        setScenarioAuthor('');
        setScenarioComment('');
    };

    const handleDeleteScenario = async (id: number) => {
        await deleteScenario(id);
        setScenarios(scenarios.filter((s) => s.id !== id));
        if (activeScenario?.id === id) {
            setActiveScenario(null);
            setEditedCells(new Map());
            setIsEditing(false);
        }
    };

    const handleSelectScenario = (scenario: any) => {
        setActiveScenario(scenario);
        setIsEditing(true);
    };

    const handleBackToOriginal = () => {
        setActiveScenario(null);
        setEditedCells(new Map());
        setIsEditing(false);
    };

    // Применяем правки к данным для отображения
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

            // Пересчёт отгрузки
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

            // Пересчёт свободной емкости
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

        // Сохраняем все на сервер
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

    return (
        <div className={s.page}>
            <Header
                enterprise={enterprise}
                enterprises={enterprises}
                onEnterpriseChange={setEnterprise}
            />

            {/* Панель сценариев */}
            <div className={s.scenarioBar}>
                <div className={s.scenarioLeft}>
                    <button
                        className={`${s.scenarioBtn} ${!activeScenario ? s.active : ''}`}
                        onClick={handleBackToOriginal}
                    >
                        Оригинал
                    </button>
                    {scenarios.map((sc) => (
                        <div key={sc.id} className={s.scenarioItem}>
                            <button
                                className={`${s.scenarioBtn} ${activeScenario?.id === sc.id ? s.active : ''}`}
                                onClick={() => handleSelectScenario(sc)}
                                title={sc.comment || ''}
                            >
                                <span className={s.scenarioName}>{sc.name}</span>
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
                    {activeScenario && (
                        <button className={s.saveBtn} onClick={handleSaveScenario}>
                            Сохранить
                        </button>
                    )}
                    <button className={s.refreshBtn} onClick={loadScenarios} title="Обновить список сценариев">
                        <RefreshIcon style={{ fontSize: 18, color: 'inherit' }} />
                    </button>
                    <button className={s.createBtn} onClick={() => setShowScenarioModal(true)}>
                        + Создать сценарий
                    </button>
                </div>
            </div>

            {/* Модалка создания сценария */}
            {showScenarioModal && (
                <div className={s.modal} onClick={() => setShowScenarioModal(false)}>
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
                        <div className={s.modalButtons}>
                            <button className={s.modalCancel} onClick={() => setShowScenarioModal(false)}>
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
                        columns={COLUMNS}
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
