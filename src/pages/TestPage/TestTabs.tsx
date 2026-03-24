import React from 'react';
import * as s from './TestTabs.module.scss';

interface TabsProps {
    items: string[];
    active: string;
    onSelect: (item: string) => void;
    indicators?: Record<string, 'red' | 'orange' | 'yellow' | null>;
    editedProducts?: Set<string>;
}

const TestTabs: React.FC<TabsProps> = ({ items, active, onSelect, indicators, editedProducts }) => {
    const getDotClass = (color: string | null | undefined): string => {
        if (color === 'red') return s.dotRed;
        if (color === 'orange') return s.dotOrange;
        if (color === 'yellow') return s.dotYellow;
        return '';
    };

    return (
        <div className={s.tabs}>
            {items.map((item) => {
                const color = indicators?.[item];
                const isEdited = editedProducts?.has(item);
                return (
                    <button
                        key={item}
                        className={[
                            s.item,
                            item === active ? s.active : '',
                            isEdited ? s.edited : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onSelect(item)}
                    >
                        {item}
                        {color && <span className={`${s.dot} ${getDotClass(color)}`}></span>}
                    </button>
                );
            })}
        </div>
    );
};

export default TestTabs;
