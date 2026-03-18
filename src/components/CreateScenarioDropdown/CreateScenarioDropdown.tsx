// src/components/CreateScenarioDropdown/CreateScenarioDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import * as s from './CreateScenarioDropdown.module.scss';

interface CreateScenarioDropdownProps {
    onCreateScenario: () => void;
    onCreateDraft: () => void;
}

const CreateScenarioDropdown: React.FC<CreateScenarioDropdownProps> = ({
                                                                           onCreateScenario,
                                                                           onCreateDraft,
                                                                       }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className={s.wrapper} ref={ref}>
            <div className={s.btnGroup}>
                <button
                    className={s.mainBtn}
                    onClick={() => { onCreateScenario(); setOpen(false); }}
                >
                    Создать сценарий
                </button>
                <button
                    className={s.arrowBtn}
                    onClick={() => setOpen((v) => !v)}
                    title="Варианты создания"
                >
                    ▾
                </button>
            </div>

            {open && (
                <div className={s.dropdown}>
                    <button
                        className={s.dropItem}
                        onClick={() => { onCreateScenario(); setOpen(false); }}
                    >
                        <span className={s.itemIcon}>📋</span>
                        <div className={s.itemText}>
                            <span className={s.itemTitle}>Сценарий</span>
                            <span className={s.itemDesc}>Виден всем пользователям</span>
                        </div>
                    </button>
                    <button
                        className={s.dropItem}
                        onClick={() => { onCreateDraft(); setOpen(false); }}
                    >
                        <span className={s.itemIcon}>✏️</span>
                        <div className={s.itemText}>
                            <span className={s.itemTitle}>Черновик</span>
                            <span className={s.itemDesc}>Виден только вам</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

export default CreateScenarioDropdown;
