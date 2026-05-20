// src/api/importApi.ts
import { api } from './auth';

// --- Типы (зеркало DTO с бэка) ---

export interface PreviewEdit {
    date: number;            // YYYYMMDD
    enterprise: string;
    product: string;         // имя в БД (Авиакеросины, а не ТС-1)
    field: string;           // railwayShipmentFact и т.п.
    value: number;
}

export interface PreviewParkVolume {
    enterprise: string;
    product: string;
    value: number;
}

export type UnrecognizedReason =
    | 'no_code'
    | 'unknown_product_id'
    | 'unknown_prefix'
    | 'ignored_prefix';

export interface PreviewUnrecognized {
    col: number;
    productLabel: string | null;
    metricLabel: string | null;
    reason: UnrecognizedReason;
    raw?: string;
}

export interface PreviewSummary {
    recognizedCols: number;
    unrecognizedCols: number;
    matchedProducts: string[];   // displayName, отсортировано
    editsCount: number;
    parkVolumesCount: number;
    dataRowsCount: number;
    dateRange: { from: number; to: number };
}

export interface ImportPreviewResponse {
    summary: PreviewSummary;
    edits: PreviewEdit[];
    parkVolumes: PreviewParkVolume[];
    unrecognized: PreviewUnrecognized[];
}

export interface ImportCommitRequest {
    scenarioName: string;
    enterprise: string;
    comment?: string;
    edits: PreviewEdit[];
    parkVolumes: PreviewParkVolume[];
}

export interface ImportCommitResponse {
    scenarioId: number;
    editsWritten: number;
}

// --- Вызовы ---

export const importPreview = async (file: File): Promise<ImportPreviewResponse> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
};

export const importCommit = async (
    payload: ImportCommitRequest,
): Promise<ImportCommitResponse> => {
    const { data } = await api.post('/import/commit', payload);
    return data;
};
