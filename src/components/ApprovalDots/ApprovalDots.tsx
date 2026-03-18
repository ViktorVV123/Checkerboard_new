// src/components/ApprovalDots/ApprovalDots.tsx
import React, { useState } from 'react';
import * as s from './ApprovalDots.module.scss';
import { ApprovalStatus } from '../../api/approvalsApi';

interface ApprovalDotsProps {
    approvals: ApprovalStatus[];
    currentUsername: string | null;
    isApprover: boolean;
    onApprove: () => void;
    onReject: () => void;
}

const ApprovalDots: React.FC<ApprovalDotsProps> = ({
                                                       approvals,
                                                       currentUsername,
                                                       isApprover,
                                                       onApprove,
                                                       onReject,
                                                   }) => {
    const [tooltip, setTooltip] = useState<string | null>(null);

    const myVote = approvals.find((a) => a.username === currentUsername);

    return (
        <div className={s.wrapper}>
            {/* Кружки */}
            <div className={s.dots}>
                {approvals.map((a) => (
                    <div
                        key={a.username}
                        className={`${s.dot} ${
                            a.status === 'approved'
                                ? s.approved
                                : a.status === 'rejected'
                                    ? s.rejected
                                    : s.pending
                        }`}
                        onMouseEnter={() =>
                            setTooltip(
                                `${a.fullName}${a.comment ? `: ${a.comment}` : ''}`,
                            )
                        }
                        onMouseLeave={() => setTooltip(null)}
                    />
                ))}
            </div>

            {/* Тултип */}
            {tooltip && <div className={s.tooltip}>{tooltip}</div>}

            {/* Кнопки — только для согласующего */}
            {isApprover && (
                <div className={s.buttons}>
                    <button
                        className={`${s.btn} ${s.approveBtn} ${myVote?.status === 'approved' ? s.active : ''}`}
                        onClick={onApprove}
                        title="Согласовать"
                    >
                        ✓ Согласовать
                    </button>
                    <button
                        className={`${s.btn} ${s.rejectBtn} ${myVote?.status === 'rejected' ? s.active : ''}`}
                        onClick={onReject}
                        title="Отклонить"
                    >
                        ✕ Отклонить
                    </button>
                </div>
            )}
        </div>
    );
};

export default ApprovalDots;
