import React from 'react';
import * as s from '../../pages/FactoryPage/FactoryPage.module.scss';

interface ScenarioModalProps {
    isDraft: boolean;
    name: string;
    author: string;
    comment: string;
    onNameChange: (v: string) => void;
    onAuthorChange: (v: string) => void;
    onCommentChange: (v: string) => void;
    onCreate: () => void;
    onClose: () => void;
}

const ScenarioModal: React.FC<ScenarioModalProps> = ({
                                                         isDraft, name, author, comment,
                                                         onNameChange, onAuthorChange, onCommentChange,
                                                         onCreate, onClose,
                                                     }) => (
    <div className={s.modal} onClick={onClose}>
        <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>{isDraft ? 'Новый черновик' : 'Новый сценарий'}</h3>
            {isDraft && <p className={s.draftHint}>Черновик виден только вам. После публикации станет доступен всем.</p>}
            <input className={s.modalInput} placeholder="Название" value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus />
            <input className={s.modalInput} placeholder="Автор" value={author} onChange={(e) => onAuthorChange(e.target.value)} style={{ marginTop: '8px' }} />
            <textarea className={s.modalTextarea} placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => onCommentChange(e.target.value)} rows={3} style={{ marginTop: '8px' }} />
            <div className={s.modalButtons}>
                <button className={s.modalCancel} onClick={onClose}>Отмена</button>
                <button className={s.modalSave} onClick={onCreate}>{isDraft ? 'Создать черновик' : 'Создать'}</button>
            </div>
        </div>
    </div>
);

export default ScenarioModal;
