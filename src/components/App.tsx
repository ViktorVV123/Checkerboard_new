import React from 'react';

import * as styles from './App.module.scss';
import {ThemeProvider} from "@/context/ThemeContext";
import FactoryPage from "@/pages/FactoryPage/FactoryPage";
import AuthGuard from "@/components/AuthGuard/AuthGuard";

export const App = () => {
    return (
        <ThemeProvider>
            <AuthGuard>
            <div className={styles.app}>
                <FactoryPage />
            </div>
            </AuthGuard>
        </ThemeProvider>
    );
};
