import { api } from './auth';

export const getEnterprises = async (): Promise<string[]> => {
    const { data } = await api.get('/factories');
    return data;
};

export const getProducts = async (enterprise: string): Promise<string[]> => {
    const { data } = await api.get(`/factories/${encodeURIComponent(enterprise)}/products`);
    return data;
};

export const getProductData = async (enterprise: string, product: string): Promise<any[]> => {
    const { data } = await api.get(
        `/factories/${encodeURIComponent(enterprise)}/products/${encodeURIComponent(product)}`,
    );
    return data;
};

export const getScenarios = async (enterprise: string): Promise<any[]> => {
    const { data } = await api.get(`/scenarios?enterprise=${encodeURIComponent(enterprise)}`);
    return data;
};

export const createScenario = async (body: {
    name: string;
    author: string;
    enterprise: string;
    comment?: string;
}): Promise<any> => {
    const { data } = await api.post('/scenarios', body);
    return data;
};

export const deleteScenario = async (id: number): Promise<void> => {
    await api.delete(`/scenarios/${id}`);
};

export const getScenarioEdits = async (scenarioId: number): Promise<any[]> => {
    const { data } = await api.get(`/scenarios/${scenarioId}/edits`);
    return data;
};

export const saveScenarioEdit = async (
    scenarioId: number,
    originalId: number,
    field: string,
    value: string,
): Promise<any> => {
    const { data } = await api.post(`/scenarios/${scenarioId}/edits`, { originalId, field, value });
    return data;
};

export const saveSnapshot = async (
    scenarioId: number,
    product: string,
    rows: { originalId: number; field: string; value: string }[],
): Promise<any> => {
    const { data } = await api.post(`/scenarios/${scenarioId}/snapshot`, { product, rows });
    return data;
};

export const getScenarioData = async (scenarioId: number): Promise<any[]> => {
    const { data } = await api.get(`/scenarios/${scenarioId}/data`);
    return data;
};

export const approveScenario = async (id: number, approvedBy: string): Promise<any> => {
    const { data } = await api.post(`/scenarios/${id}/approve`, { approvedBy });
    return data;
};
