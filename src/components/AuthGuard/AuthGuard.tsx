import React, { useEffect, useState } from 'react';
import { hasValidTokens } from '../../api/auth';

interface AuthGuardProps {
    children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const [isAuthed, setIsAuthed] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (hasValidTokens()) {
            setIsAuthed(true);
        }
        setChecking(false);
    }, []);

    if (checking) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: '16px',
            }}>
                Проверка авторизации...
            </div>
        );
    }

    if (!isAuthed) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                gap: '20px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'Segoe UI, sans-serif',
            }}>
                <div style={{ fontSize: '24px', fontWeight: 600 }}>
                    Требуется авторизация
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                   У вас нет доступа
                </div>
      {/*          <button
                    onClick={() => window.location.href = 'https://csc-idm.pro.lukoil.com/?env=Chess'}
                    style={{
                        padding: '12px 24px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                    }}
                >
                    Войти
                </button>*/}
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthGuard;
