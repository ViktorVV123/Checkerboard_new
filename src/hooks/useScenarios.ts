import { useState, useRef, useCallback } from 'react';
import {
    getScenarios, createScenario, deleteScenario,
    getScenarioData, saveScenarioEdit, deleteScenarioEdit,
    saveSnapshot, publishScenario, unpublishScenario,
    getProductData,
} from '../api/factoriesApi';
import { getProductIndicator, IndicatorColor } from '../utils/calculations';

const parseEditKey = (key: string): [number, string] => {
    const lastDash = key.lastIndexOf('-');
    return [Number(key.slice(0, lastDash)), key.slice(lastDash + 1)];
};

const MAX_UNDO_STEPS = 50;

export const useScenarios = (
    enterprise: string,
    product: string,
    data: any[],
    products: string[],
    currentUsername: string | null | undefined,
    setProductIndicators: (fn: (prev: Record<string, IndicatorColor>) => Record<string, IndicatorColor>) => void,
) => {
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [activeScenario, setActiveScenario] = useState<any | null>(null);
    const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
    const [isEditing, setIsEditing] = useState(false);
    const [editedProducts, setEditedProducts] = useState<Set<string>>(new Set());
    const undoStackRef = useRef<Map<string, string>[]>([]);

    const activeScenarioRef = useRef(activeScenario);
    activeScenarioRef.current = activeScenario;
    const editedCellsRef = useRef(editedCells);
    editedCellsRef.current = editedCells;
    const dataRef = useRef(data);
    dataRef.current = data;
    const productRef = useRef(product);
    productRef.current = product;

    const publicScenarios = scenarios.filter((sc) => !sc.isDraft);
    const draftScenarios = scenarios.filter((sc) => sc.isDraft);

    const pushUndoSnapshot = useCallback((currentMap: Map<string, string>) => {
        const snapshot = new Map(currentMap);
        undoStackRef.current = [...undoStackRef.current.slice(-MAX_UNDO_STEPS + 1), snapshot];
    }, []);

    const loadScenarios = async (username?: string | null) => {
        if (!enterprise) return;
        setScenarios(await getScenarios(enterprise, username ?? undefined));
    };

    const detectEditedProducts = async (scenarioId: number, productList: string[], ent: string) => {
        const scenarioData = await getScenarioData(scenarioId);
        if (!scenarioData.length) { setEditedProducts(new Set()); return; }
        const editedIds = new Set(scenarioData.map((r: any) => Number(r.id)));
        const edited = new Set<string>();
        await Promise.all(productList.map(async (p) => {
            const rows = await getProductData(ent, p);
            if (rows.some((r) => r.id > 0 && editedIds.has(r.id))) edited.add(p);
        }));
        setEditedProducts(edited);
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
        })).then((entries) => setProductIndicators(() => Object.fromEntries(entries)));
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

    const handlePublish = async () => {
        if (!activeScenario) return;
        const updated = await publishScenario(activeScenario.id);
        setActiveScenario(updated);
        setScenarios((prev) => prev.map((sc) => sc.id === updated.id ? updated : sc));
    };

    const handleUnpublish = async () => {
        if (!activeScenario) return;
        const updated = await unpublishScenario(activeScenario.id);
        setActiveScenario(updated);
        setScenarios((prev) => prev.map((sc) => sc.id === updated.id ? updated : sc));
    };

    const resetScenarioState = () => {
        setActiveScenario(null);
        setEditedCells(new Map());
        setEditedProducts(new Set());
        undoStackRef.current = [];
        setIsEditing(false);
    };

    return {
        scenarios, setScenarios,
        activeScenario, setActiveScenario,
        editedCells, setEditedCells,
        isEditing, setIsEditing,
        editedProducts, setEditedProducts,
        publicScenarios, draftScenarios,
        undoStackRef, activeScenarioRef, editedCellsRef, dataRef, productRef,
        pushUndoSnapshot,
        loadScenarios, detectEditedProducts,
        handleSelectScenario, handleBackToOriginal, handleDeleteScenario,
        handlePublish, handleUnpublish,
        resetScenarioState, parseEditKey,
    };
};
