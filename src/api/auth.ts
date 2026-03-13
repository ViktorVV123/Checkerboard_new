import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosError,
    AxiosResponse,
} from 'axios';

/* ───────── 1. Cookie helpers ──────────────────────────────── */
const getCookie = (n: string): string | undefined => {
    const value = decodeURIComponent(
        document.cookie.replace(
            new RegExp(
                '(?:(?:^|.*;)\\s*' +
                n.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') +
                '\\s*=\\s*([^;]*).*$)|^.*$',
            ),
            '$1',
        ),
    );
    return value || undefined;
};

const setCookie = (n: string, v: string, days = 1) => {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${n}=${encodeURIComponent(v)}; expires=${exp}; path=/; SameSite=Strict`;
};

const deleteCookie = (n: string) => {
    document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
};

/* ───────── 2. URL и константы ────────────────────────────── */
const API_URL = 'http://localhost:3000';
const REFRESH_URL = `${API_URL}/auth/refresh`;
const IDM_URL = 'https://csc-idm.pro.lukoil.com/?env=Chess';

const isProdHost = window.location.hostname === 'checkerboard.pro.lukoil.com';

// DEV токен — только для локальной разработки
const DEV_ACCESS_TOKEN = 'dev-chess-portal-2026-secret';

/* ───────── 3. Читаем токены из URL (после IdM) ─────────── */
let tokensReceivedFromUrl = false;

(function readTokensFromUrl() {
    const search = new URLSearchParams(window.location.search);
    const encoded = search.get('ldapData');
    if (!encoded) return;

    try {
        const jsonStr = atob(decodeURIComponent(encoded));
        const j = JSON.parse(jsonStr);

        if (j.AccessId && j.RefreshId) {
            setCookie('accessToken', j.AccessId);
            setCookie('refreshToken', j.RefreshId);
            tokensReceivedFromUrl = true;
            console.log('[auth] Tokens received from URL');
        }

        search.delete('ldapData');
        const newQuery = search.toString();
        const newUrl =
            window.location.pathname +
            (newQuery ? `?${newQuery}` : '') +
            window.location.hash;
        window.history.replaceState({}, '', newUrl);
    } catch (e) {
        console.error('[auth] ldapData parse error:', e);
    }
})();

/* ───────── 4. In-memory токены ───────────────────────────── */
let memoryAccessToken = getCookie('accessToken') || '';
let memoryRefreshToken = getCookie('refreshToken') || '';

if (!isProdHost && !memoryAccessToken && DEV_ACCESS_TOKEN) {
    memoryAccessToken = DEV_ACCESS_TOKEN;
    console.log('[auth] Using DEV_ACCESS_TOKEN');
}

function syncTokensToCookie() {
    if (memoryAccessToken) setCookie('accessToken', memoryAccessToken);
    if (memoryRefreshToken) setCookie('refreshToken', memoryRefreshToken);
}

function updateTokens(access: string, refresh: string) {
    memoryAccessToken = access;
    memoryRefreshToken = refresh;
    syncTokensToCookie();
}

function clearTokens() {
    deleteCookie('accessToken');
    deleteCookie('refreshToken');
    memoryAccessToken = '';
    memoryRefreshToken = '';
}

function getAccessToken(): string {
    return memoryAccessToken;
}

/* ───────── 5. Редирект на IdM ────────────────────────────── */
let isRedirecting = false;

function goToIdm(): void {
    if (isRedirecting) return;
    isRedirecting = true;
    clearTokens();

    if (typeof window !== 'undefined' && document.body) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; color: white; font-size: 18px; font-family: sans-serif;
    `;
        overlay.innerHTML = '<div>Сессия истекла. Перенаправление на авторизацию...</div>';
        document.body.appendChild(overlay);
    }

    setTimeout(() => {
        window.location.href = IDM_URL;
    }, 300);
}

function handleSessionExpired(reason: string): void {
    if (isProdHost) {
        goToIdm();
    } else {
        console.error(`[auth] Session expired: ${reason}`);
        clearTokens();

        if (typeof window !== 'undefined' && document.body && !document.getElementById('auth-expired-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'auth-expired-overlay';
            overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(139, 0, 0, 0.95);
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 20px;
        z-index: 99999; color: white; font-size: 18px; font-family: sans-serif;
      `;
            overlay.innerHTML = `
        <div style="font-size: 24px; font-weight: bold;">Сессия истекла</div>
        <div>Причина: ${reason}</div>
        <div style="font-size: 14px; opacity: 0.8;">DEV MODE: На проде будет редирект на IdM</div>
        <button onclick="location.reload()" style="
          padding: 12px 24px; font-size: 16px; cursor: pointer;
          background: white; color: black; border: none; border-radius: 4px;
        ">Обновить страницу</button>
      `;
            document.body.appendChild(overlay);
        }
    }
}

/* ───────── 6. Начальная проверка ─────────────────────────── */
if (isProdHost && !tokensReceivedFromUrl && !memoryAccessToken) {
    setTimeout(() => {
        if (!memoryAccessToken && !isRedirecting) {
            handleSessionExpired('NO_ACCESS_TOKEN_ON_START');
        }
    }, 50);
}

/* ───────── 7. Axios instance ─────────────────────────────── */
export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

/* ───────── 8. Refresh logic ──────────────────────────────── */
let refreshPromise: Promise<string> | null = null;
let refreshFailCount = 0;
const MAX_REFRESH_FAILS = 2;

async function doRefresh(): Promise<string> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const currentRefresh = memoryRefreshToken;

        if (!currentRefresh) {
            throw new Error('NO_REFRESH_TOKEN');
        }

        try {
            const { data } = await axios.post<{ AccessId: string; RefreshId: string }>(
                REFRESH_URL,
                undefined,
                {
                    params: { refresh_id: currentRefresh },
                    headers: { accept: 'application/json' },
                    timeout: 15000,
                },
            );

            if (!data.AccessId || !data.RefreshId) {
                throw new Error('INVALID_REFRESH_RESPONSE');
            }

            updateTokens(data.AccessId, data.RefreshId);
            refreshFailCount = 0;
            return data.AccessId;
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 400 || status === 401 || status === 403) {
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }
            throw new Error('REFRESH_FAILED');
        }
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

/* ───────── 9. Request interceptor ────────────────────────── */
api.interceptors.request.use((cfg) => {
    const token = getAccessToken();
    if (token) {
        if (!cfg.headers) (cfg as any).headers = {};
        (cfg.headers as any)['access-id'] = token;
    }
    return cfg;
});

/* ───────── 10. Response interceptor ──────────────────────── */
type QueueItem = {
    resolve: (token: string) => void;
    reject: (error: any) => void;
};
let failedQueue: QueueItem[] = [];

function processQueue(error: any, token: string | null = null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else if (token) resolve(token);
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (res: AxiosResponse) => res,

    async (err: AxiosError) => {
        const { response, config } = err;

        if (!response || response.status !== 401 || !config) {
            return Promise.reject(err);
        }

        const originalRequest = config as AxiosRequestConfig & {
            _retry?: boolean;
            _retryCount?: number;
        };

        const retryCount = originalRequest._retryCount ?? 0;
        if (retryCount >= 2) {
            handleSessionExpired('MAX_RETRY_COUNT_REACHED');
            return Promise.reject(err);
        }

        if (originalRequest._retry) {
            refreshFailCount++;
            if (refreshFailCount >= MAX_REFRESH_FAILS) {
                handleSessionExpired('TOO_MANY_REFRESH_FAILURES');
                return Promise.reject(err);
            }
        }

        originalRequest._retry = true;
        originalRequest._retryCount = retryCount + 1;

        if (refreshPromise) {
            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (newToken: string) => {
                        if (originalRequest.headers) {
                            (originalRequest.headers as any)['access-id'] = newToken;
                        }
                        resolve(api(originalRequest));
                    },
                    reject,
                });
            });
        }

        try {
            const newToken = await doRefresh();
            processQueue(null, newToken);

            if (originalRequest.headers) {
                (originalRequest.headers as any)['access-id'] = newToken;
            }
            return api(originalRequest);
        } catch (refreshError: any) {
            processQueue(refreshError, null);

            const errorType = refreshError?.message;
            if (['NO_REFRESH_TOKEN', 'REFRESH_TOKEN_EXPIRED', 'INVALID_REFRESH_RESPONSE'].includes(errorType)) {
                handleSessionExpired(errorType);
            }
            return Promise.reject(refreshError);
        }
    },
);

/* ───────── 11. Exports ───────────────────────────────────── */
export { goToIdm as forceReauth };
export { handleSessionExpired };

export function hasValidTokens(): boolean {
    return !!memoryAccessToken && memoryAccessToken.length > 10;
}

/* ───────── 12. Debug (dev only) ──────────────────────────── */
(window as any).__auth = {
    getAccessToken: () => memoryAccessToken,
    getRefreshToken: () => memoryRefreshToken,
    setDevToken: (token: string) => {
        if (isProdHost) return;
        memoryAccessToken = token;
        syncTokensToCookie();
    },
    setDevTokens: (access: string, refresh: string) => {
        if (isProdHost) return;
        updateTokens(access, refresh);
    },
    clearTokens,
    getState: () => ({
        memoryAccessToken: memoryAccessToken ? memoryAccessToken.slice(0, 30) + '...' : '(empty)',
        memoryRefreshToken: memoryRefreshToken ? memoryRefreshToken.slice(0, 30) + '...' : '(empty)',
        isRefreshing: !!refreshPromise,
        queueLength: failedQueue.length,
        isProdHost,
    }),
};
