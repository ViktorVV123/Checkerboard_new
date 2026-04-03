import React from 'react';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import * as s from '../../pages/FactoryPage/FactoryPage.module.scss';

interface CalendarDropdownProps {
    btnRef: React.RefObject<HTMLButtonElement>;
    isOpen: boolean;
    onToggle: () => void;
    dates: string[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
    onBackToLive: () => void;
    position: { top: number; left: number };
}

const CalendarDropdown: React.FC<CalendarDropdownProps> = ({
                                                               btnRef, isOpen, onToggle, dates, selectedDate,
                                                               onSelectDate, onBackToLive, position,
                                                           }) => (
    <div className={s.calendarWrapper}>
        <button ref={btnRef} className={s.calendarBtn} onClick={onToggle} title="История">
            <CalendarMonthIcon style={{ fontSize: 'clamp(14px, 1.4vh, 20px)' }} />
        </button>
        {isOpen && (
            <div className={s.calendarDropdown} style={{ position: 'fixed', top: position.top, left: position.left }}>
                <div className={s.calendarHeader}>История данных</div>
                {dates.length === 0
                    ? <div className={s.calendarEmpty}>Нет сохранённых данных</div>
                    : dates.map((date) => (
                        <button
                            key={date}
                            className={`${s.calendarDate} ${selectedDate === date ? s.calendarDateActive : ''}`}
                            onClick={() => onSelectDate(date)}
                        >
                            {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </button>
                    ))}
                {selectedDate && (
                    <button className={s.calendarLive} onClick={onBackToLive}>Вернуться к текущим</button>
                )}
            </div>
        )}
    </div>
);

export default CalendarDropdown;
