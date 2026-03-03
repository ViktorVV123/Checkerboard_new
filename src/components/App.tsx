import React from 'react';

import * as styles from './App.module.scss';
import {ThemeProvider} from "@/context/ThemeContext";
import FactoryPage from "@/pages/FactoryPage/FactoryPage";

export const App = () => {
    return (
        <ThemeProvider>
            <div className={styles.app}>
                <FactoryPage />
            </div>
        </ThemeProvider>
    );
};
