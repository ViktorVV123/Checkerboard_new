import React from 'react';
import * as s from '../../pages/FactoryPage/FactoryPage.module.scss'; // или свой файл стилей
import { DeviationData } from '@/components/DataTable/DataTable';

interface BottomPanelProps {
    deviationData: DeviationData | null;
    updateInfo: Record<string, Record<string, string>> | null;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ deviationData, updateInfo }) => {
    if (!deviationData && !updateInfo) return null;

    return (
        <div className={s.bottomPanel}>

            {deviationData && (
                <div className={s.panelBlock}>
                    <div className={s.devSection}>
                        <div className={s.devSectionTitle}>Отгрузка</div>
                        <div className={s.devRow}>
                            <span
                                className={s.devFact}>{Math.round(deviationData.factShipment).toLocaleString('ru-RU')}</span>
                            <div className={s.devDetails}>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>План</span><span>{Math.round(deviationData.planShipment).toLocaleString('ru-RU')}</span>
                                </div>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>ОБР</span><span>{Math.round(deviationData.obrShipment).toLocaleString('ru-RU')}</span>
                                </div>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>Ожид</span><span>{Math.round(deviationData.ozhidShipment).toLocaleString('ru-RU')}</span>
                                </div>
                            </div>
                            <span
                                className={`${s.devDeviation} ${deviationData.ozhidShipment - deviationData.obrShipment >= 0 ? s.devPositive : s.devNegative}`}>
                                {Math.round(deviationData.ozhidShipment - deviationData.obrShipment).toLocaleString('ru-RU')}
                            </span>

                        </div>
                        <div className={s.devPark}><span
                            className={s.devLabel}>Парк</span><span>{Math.round(deviationData.parkVolume).toLocaleString('ru-RU')}</span>
                        </div>
                    </div>

                    <div className={s.devSection}>
                        <div className={s.devSectionTitle}>Выработка</div>
                        <div className={s.devRow}>

                            <span
                                className={s.devFact}>{Math.round(deviationData.factExpected).toLocaleString('ru-RU')}</span>
                            <div className={s.devDetails}>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>План</span><span>{Math.round(deviationData.planExpected).toLocaleString('ru-RU')}</span>
                                </div>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>ОБР</span><span>{Math.round(deviationData.obrExpected).toLocaleString('ru-RU')}</span>
                                </div>
                                <div className={s.devLine}><span
                                    className={s.devLabel}>Ожид</span><span>{Math.round(deviationData.ozhidExpected).toLocaleString('ru-RU')}</span>
                                </div>
                            </div>
                            <span
                                className={`${s.devDeviation} ${deviationData.ozhidExpected - deviationData.obrExpected >= 0 ? s.devPositive : s.devNegative}`}>
                                {Math.round(deviationData.ozhidExpected - deviationData.obrExpected).toLocaleString('ru-RU')}
                            </span>
                        </div>

                    </div>
                    {deviationData && (
                        <div className={s.panelBlock}>
                            <table className={s.totalsTable}>
                                <thead><tr><th></th><th>Выработка</th><th>Отгрузка</th><th>ЖД</th><th>Труба</th><th>МНПП</th><th>Вода</th></tr></thead>
                                <tbody>
                                <tr><td className={s.updateCategory}>План</td><td>{Math.round(deviationData.planExpected).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.planShipment).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.planRailway).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.planPipe).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.planMnpp).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.planWater).toLocaleString('ru-RU')}</td></tr>
                                <tr><td className={s.updateCategory}>ОБР</td><td>{Math.round(deviationData.obrTotal).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.obrShipment).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.obrRailway).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.obrPipe).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.obrMnpp).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.obrWater).toLocaleString('ru-RU')}</td></tr>
                                <tr><td className={s.updateCategory}>Ожид</td><td>{Math.round(deviationData.ozhidExpected).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.ozhidShipmentFact).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.ozhidRailway).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.ozhidPipe).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.ozhidMnpp).toLocaleString('ru-RU')}</td><td>{Math.round(deviationData.ozhidWater).toLocaleString('ru-RU')}</td></tr>

                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}



            {updateInfo && (
                <div className={s.panelBlockInfo}>
                    <div className={s.updateTitle}>Время обновления данных</div>
                    <table className={s.updateTable}>
                        <thead><tr><th></th><th>Произ-во</th><th>Отгрузка</th></tr></thead>
                        <tbody>
                        {['План', 'Факт', 'Ожид', 'ОБР'].filter((cat) => updateInfo[cat]).map((cat) => (
                            <tr key={cat}><td className={s.updateCategory}>{cat}</td><td>{updateInfo[cat]['Произ-во'] || '—'}</td><td>{updateInfo[cat]['Отгрузка'] || '—'}</td></tr>
                        ))}

                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BottomPanel;
