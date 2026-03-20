import React, { useEffect, useState } from 'react';
import { api, hasValidTokens, forceReauth } from '../../api/auth';

type AuthState = 'checking' | 'authed' | 'forbidden';

interface AuthGuardProps {
    children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const [state, setState] = useState<AuthState>('checking');

    useEffect(() => {
        if (!hasValidTokens()) {
            forceReauth();
            return;
        }

        api.post('/auth/verify')
            .then(() => setState('authed'))
            .catch((err) => {
                const status = err?.response?.status;
                if (status === 403) {
                    setState('forbidden');
                }
                // 401 — auth.ts interceptor сам делает refresh → redirect на IdM
            });
    }, []);

    if (state === 'checking') {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100dvh', background: 'var(--bg-primary)',
                color: 'var(--text-secondary)', fontSize: 'var(--ui-font)',
            }}>
                Проверка авторизации...
            </div>
        );
    }

    if (state === 'forbidden') {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100dvh', gap: '20px',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                fontFamily: 'Segoe UI, sans-serif',
            }}>
                <div style={{ fontSize: 'clamp(16px, 2vh, 24px)', fontWeight: 600 }}>Требуется авторизация</div>
                <div style={{ fontSize: 'var(--ui-font)', color: 'var(--text-secondary)' }}>У вас нет доступа</div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthGuard;
