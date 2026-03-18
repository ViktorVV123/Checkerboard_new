// src/components/RejectModal/RejectModal.tsx
import React, { useState } from 'react';
import * as s from './RejectModal.module.scss';

interface RejectModalProps {
    enterprise: string;
    onConfirm: (comment: string) => void;
    onCancel: () => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ enterprise, onConfirm, onCancel }) => {
    const [comment, setComment] = useState('');

    return (
        <div className={s.overlay} onClick={onCancel}>
            <div className={s.modal} onClick={(e) => e.stopPropagation()}>
                <h3>Отклонить согласование — {enterprise}</h3>
                <textarea
                    className={s.textarea}
                    placeholder="Комментарий (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    autoFocus
                />
                <div className={s.buttons}>
                    <button className={s.cancelBtn} onClick={onCancel}>
                        Отмена
                    </button>
                    <button className={s.confirmBtn} onClick={() => onConfirm(comment)}>
                        Отклонить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RejectModal;
