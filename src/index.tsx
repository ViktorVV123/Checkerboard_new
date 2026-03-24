import React from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {App} from "@/components/App";
import {ThemeProvider} from "@/context/ThemeContext";
import AuthGuard from "@/components/AuthGuard/AuthGuard";
import './global.scss';

const TestPage = React.lazy(() => import('@/pages/TestPage/TestPage'));

const root = document.getElementById('root');
if (!root) {
    throw new Error('root not found');
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <App/>,
    },
    {
        path: '/test',
        element: (
            <ThemeProvider>
                <AuthGuard>
                    <div style={{
                        height: '100dvh',
                        width: '100%',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-primary)',
                    }}>
                        <React.Suspense fallback={<div>Загрузка...</div>}>
                            <TestPage />
                        </React.Suspense>
                    </div>
                </AuthGuard>
            </ThemeProvider>
        ),
    },
]);

createRoot(root).render(
    <RouterProvider router={router}/>
);
