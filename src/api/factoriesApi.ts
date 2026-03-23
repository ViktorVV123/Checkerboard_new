// src/api/factoriesApi.ts
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

export const getScenarios = async (enterprise: string, username?: string): Promise<any[]> => {
    const params = new URLSearchParams({ enterprise });
    if (username) params.append('username', username);
    const { data } = await api.get(`/scenarios?${params.toString()}`);
    return data;
};

export const createScenario = async (body: {
    name: string;
    author: string;
    enterprise: string;
    comment?: string;
    isDraft?: boolean;
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

export const publishScenario = async (id: number): Promise<any> => {
    const { data } = await api.post(`/scenarios/${id}/publish`);
    return data;
};

export const unpublishScenario = async (id: number): Promise<any> => {
    const { data } = await api.post(`/scenarios/${id}/unpublish`);
    return data;
};
export const getUpdateInfo = async (enterprise: string) => {
    const { data } = await api.get(`/factories/${encodeURIComponent(enterprise)}/update-info`);
    return data;
};
