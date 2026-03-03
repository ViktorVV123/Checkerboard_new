import React from 'react';
import {useTheme} from '../../context/ThemeContext';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import * as s from './Header.module.scss';

const powerBiLinks: Record<string, string> = {
    'ВНП': 'https://csc-bi.pro.lukoil.com/BiReports/powerbi/%D0%95%D0%A6%D0%9C/Pererabotka/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0%20%D0%BF%D1%80%D0%BE%D0%B3%D0%BD%D0%BE%D0%B7%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D1%81%D0%B2%D0%BE%D0%B1%D0%BE%D0%B4%D0%BD%D0%BE%D0%B9%20%D0%B5%D0%BC%D0%BA%D0%BE%D1%81%D1%82%D0%B8%20(%D0%92%D0%9D%D0%9F)',
    'ННОС': 'https://csc-bi.pro.lukoil.com/BiReports/powerbi/%D0%95%D0%A6%D0%9C/Pererabotka/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0%20%D0%BF%D1%80%D0%BE%D0%B3%D0%BD%D0%BE%D0%B7%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D1%81%D0%B2%D0%BE%D0%B1%D0%BE%D0%B4%D0%BD%D0%BE%D0%B9%20%D0%B5%D0%BC%D0%BA%D0%BE%D1%81%D1%82%D0%B8%20(%D0%9D%D0%9D%D0%9E%D0%A1)',
    'ПНОС': 'https://csc-bi.pro.lukoil.com/BiReports/powerbi/%D0%95%D0%A6%D0%9C/Pererabotka/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0%20%D0%BF%D1%80%D0%BE%D0%B3%D0%BD%D0%BE%D0%B7%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D1%81%D0%B2%D0%BE%D0%B1%D0%BE%D0%B4%D0%BD%D0%BE%D0%B9%20%D0%B5%D0%BC%D0%BA%D0%BE%D1%81%D1%82%D0%B8%20(%D0%9F%D0%9D%D0%9E%D0%A1)',
};

interface HeaderProps {
    enterprise: string;
    enterprises: string[];
    onEnterpriseChange: (enterprise: string) => void;
}

const Header: React.FC<HeaderProps> = ({enterprise, enterprises, onEnterpriseChange}) => {
    const {theme, toggleTheme} = useTheme();

    return (
        <header className={s.header}>
            <div className={s.left}>
                <div className={s.titleBlock}>
                    <h1 className={s.title}>
                        Система прогнозирования свободной емкости
                        <span className={s.enterpriseName}>{enterprise}</span>
                    </h1>
                    <div className={s.indicators}>
                        <div className={s.indicator}>
                            <span className={`${s.dot} ${s.dotRed}`}></span>
                            <span className={s.indicatorText}>сут. хода &lt; 1 на ближ. 10 сут.</span>
                        </div>
                        <div className={s.indicator}>
                            <span className={`${s.dot} ${s.dotOrange}`}></span>
                            <span className={s.indicatorText}>сут. хода &lt; 1 на 10 сут и дальше</span>
                        </div>
                        <div className={s.indicator}>
                            <span className={`${s.dot} ${s.dotYellow}`}></span>
                            <span className={s.indicatorText}>остатки &lt; 0</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={s.right}>
                {powerBiLinks[enterprise] && (
                    <a
                        className={s.powerBiBtn}
                        href={powerBiLinks[enterprise]}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Открыть в Power BI"
                    >
                        <OpenInNewIcon style={{fontSize: 16}}/>
                        Power BI отчет
                    </a>
                )}

                <div className={s.selector}>
                    {enterprises.map((e) => (
                        <button
                            key={e}
                            className={`${s.selectorBtn} ${e === enterprise ? s.active : ''}`}
                            onClick={() => onEnterpriseChange(e)}
                        >
                            {e}
                        </button>
                    ))}
                </div>

                <button className={s.themeBtn} onClick={toggleTheme}>
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </div>
        </header>
    );
};

export default Header;
