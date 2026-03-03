// src/index.tsx
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {App} from "@/components/App";
import './global.scss';

const root = document.getElementById('root');
if (!root) {
    throw new Error('root not found');
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <App/>,
    }
]);

createRoot(root).render(
    <RouterProvider router={router}/>
);