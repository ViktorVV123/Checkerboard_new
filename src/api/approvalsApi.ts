// src/api/approvalsApi.ts
import { api } from './auth';

export interface ApprovalStatus {
    username: string;
    fullName: string;
    status: 'approved' | 'rejected' | null;
    comment: string | null;
    updatedAt: string | null;
}

export const getTodayApprovals = async (enterprise: string): Promise<ApprovalStatus[]> => {
    const { data } = await api.get(`/approvals?enterprise=${encodeURIComponent(enterprise)}`);
    return data;
};

export const voteApproval = async (
    enterprise: string,
    status: 'approved' | 'rejected',
    comment?: string,
): Promise<void> => {
    await api.post('/approvals', { enterprise, status, comment });
};
