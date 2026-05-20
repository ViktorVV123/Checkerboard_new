// src/components/ImportExcel/ImportExcelButton.tsx
import React, { useRef } from 'react';
import UploadIcon from '@mui/icons-material/Upload';
import * as s from './ImportExcelButton.module.scss';

interface Props {
    onFileSelected: (file: File) => void;
    isLoading?: boolean;
    disabled?: boolean;
}

const ImportExcelButton: React.FC<Props> = ({ onFileSelected, isLoading, disabled }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        if (isLoading || disabled) return;
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // сбрасываем значение, чтобы можно было выбрать тот же файл повторно
        e.target.value = '';
        if (file) onFileSelected(file);
    };

    return (
        <>
            <button
                className={s.importBtn}
                onClick={handleClick}
                disabled={isLoading || disabled}
                title="Загрузить шахматку из Excel (создаст черновик)"
            >
                <UploadIcon style={{ fontSize: 'clamp(12px, 1.2vh, 18px)' }} />
                {isLoading ? 'Загрузка...' : 'Загрузить'}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                onChange={handleChange}
                style={{ display: 'none' }}
            />
        </>
    );
};

export default ImportExcelButton;
