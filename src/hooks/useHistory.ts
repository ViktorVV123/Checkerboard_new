import { useState, useEffect, useRef, useCallback } from 'react';
import { getHistoryDates, getHistorySnapshot } from '../api/factoriesApi';

export const useHistory = () => {
    const [historyDates, setHistoryDates] = useState<string[]>([]);
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarBtnRef = useRef<HTMLButtonElement>(null);
    const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        getHistoryDates().then(setHistoryDates).catch(() => {});
    }, []);

    const toggleCalendar = useCallback(() => {
        if (!showCalendar && calendarBtnRef.current) {
            const rect = calendarBtnRef.current.getBoundingClientRect();
            setCalendarPos({ top: rect.bottom + 4, left: rect.left });
        }
        setShowCalendar(!showCalendar);
    }, [showCalendar]);

    const selectHistoryDate = useCallback((date: string) => {
        setSelectedHistoryDate(date);
        setShowCalendar(false);
    }, []);

    const backToLive = useCallback(() => {
        setSelectedHistoryDate(null);
        setShowCalendar(false);
    }, []);

    return {
        historyDates,
        selectedHistoryDate,
        showCalendar,
        calendarBtnRef,
        calendarPos,
        toggleCalendar,
        selectHistoryDate,
        backToLive,
        setSelectedHistoryDate,
    };
};
