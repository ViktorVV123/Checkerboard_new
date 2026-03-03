const API_URL = 'https://checkerboard.pro.lukoil.com/api';

export const getEnterprises = async (): Promise<string[]> => {
    const res = await fetch(`${API_URL}/factories`);
    return res.json();
};

export const getProducts = async (enterprise: string): Promise<string[]> => {
    const res = await fetch(`${API_URL}/factories/${encodeURIComponent(enterprise)}/products`);
    return res.json();
};

export const getProductData = async (
    enterprise: string,
    product: string,
): Promise<any[]> => {
    const res = await fetch(
        `${API_URL}/factories/${encodeURIComponent(enterprise)}/products/${encodeURIComponent(product)}`,
    );
    return res.json();
};

// Сценарии
export const getScenarios = async (enterprise: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/scenarios?enterprise=${encodeURIComponent(enterprise)}`);
    return res.json();
};

export const createScenario = async (data: {
    name: string;
    author: string;
    enterprise: string;
    comment?: string;
}): Promise<any> => {
    const res = await fetch(`${API_URL}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const deleteScenario = async (id: number): Promise<void> => {
    await fetch(`${API_URL}/scenarios/${id}`, { method: 'DELETE' });
};

export const getScenarioEdits = async (scenarioId: number): Promise<any[]> => {
    const res = await fetch(`${API_URL}/scenarios/${scenarioId}/edits`);
    return res.json();
};

export const saveScenarioEdit = async (
    scenarioId: number,
    originalId: number,
    field: string,
    value: string,
): Promise<any> => {
    const res = await fetch(`${API_URL}/scenarios/${scenarioId}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalId, field, value }),
    });
    return res.json();
};

export const saveSnapshot = async (
    scenarioId: number,
    product: string,
    rows: { originalId: number; field: string; value: string }[],
): Promise<any> => {
    const res = await fetch(`${API_URL}/scenarios/${scenarioId}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, rows }),
    });
    return res.json();
};

export const getScenarioData = async (scenarioId: number): Promise<any[]> => {
    const res = await fetch(`${API_URL}/scenarios/${scenarioId}/data`);
    return res.json();
};
