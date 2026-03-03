import React from 'react';
import * as s from './Tabs.module.scss';

interface TabsProps {
    items: string[];
    active: string;
    onSelect: (item: string) => void;
    indicators?: Record<string, 'red' | 'orange' | 'yellow' | null>;
}

const Tabs: React.FC<TabsProps> = ({ items, active, onSelect, indicators }) => {
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
                return (
                    <button
                        key={item}
                        className={`${s.item} ${item === active ? s.active : ''}`}
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

export default Tabs;
