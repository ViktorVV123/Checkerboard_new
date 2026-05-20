/**
 * Продукты с "инвертированной" логикой остатков:
 * остатки растут от поставки (а не от выработки) и убывают переработкой
 * (а не отгрузкой).
 *  Формула: Остатки = вчера + |Поставка| - |Переработка|
 *
 * Также для этих продуктов railway/pipe/mnpp/water в БД могут лежать
 * с отрицательным знаком (как "расход") — в shipmentFact берём abs.
 */
const isInvertedProduct = (enterprise: string, product: string): boolean => {
    if (product === 'Нефть') return true; // нефть на любом заводе
    if (enterprise === 'ННОС' && product === 'ВГО') return true;
    return false;
};

/**
 * Продукты, у которых shipmentPlan ПЕРЕБИВАЕТ посчитанный shipmentFact
 * (так исторически работало для нефти/ВГО на ННОС: фактические каналы
 * могли быть пустыми, поэтому в "отгрузке" показывали плановое значение).
 *
 * Для Нефти ВНП это НЕ работает — там и shipmentFact (сумма Трубы),
 * и shipmentPlan существуют как разные сущности и не должны затирать
 * друг друга.
 */
const usesShipmentPlanAsFact = (enterprise: string, product: string): boolean => {
    if (enterprise === 'ННОС' && (product === 'Нефть' || product === 'ВГО')) return true;
    return false;
};

export const calculateRow = (row: any): any => {
    const calculated = { ...row };
    const calculatedFields: string[] = row.editedFields ? [...row.editedFields] : [];

    const inverted = isInvertedProduct(row.enterprise, row.product);
    const usePlanAsFact = usesShipmentPlanAsFact(row.enterprise, row.product);

    if (inverted) {
        // Суммируем каналы по модулю (Нефть может приходить с минусами в БД).
        const zhd = Math.abs(Number(calculated.railwayShipmentFact) || 0);
        const pipe = Math.abs(Number(calculated.pipeShipmentFact) || 0);
        const mnpp = Math.abs(Number(calculated.mnppShipmentFact) || 0);
        const water = Math.abs(Number(calculated.waterShipmentFact) || 0);

        let newShipmentFact = zhd + pipe + mnpp + water;

        // Только для ННОС: если есть shipmentPlan — он перебивает.
        // Для ВНП/Нефть shipmentPlan самостоятельный план, в shipmentFact не лезет.
        if (usePlanAsFact) {
            const shipmentPlan = Number(calculated.shipmentPlan) || 0;
            if (shipmentPlan !== 0) {
                newShipmentFact = Math.abs(shipmentPlan);
            }
        }

        const oldShipmentFact = Number(row.shipmentFact) || 0;
        calculated.shipmentFact = newShipmentFact;
        if (Math.round(newShipmentFact) !== Math.round(oldShipmentFact) && row.edited) {
            calculatedFields.push('shipmentFact');
        }
    } else {
        const zhd = Number(calculated.railwayShipmentFact) || 0;
        const pipe = Number(calculated.pipeShipmentFact) || 0;
        const mnpp = Number(calculated.mnppShipmentFact) || 0;
        const water = Number(calculated.waterShipmentFact) || 0;

        const newShipmentFact = zhd + pipe + mnpp + water;
        const oldShipmentFact = Number(row.shipmentFact) || 0;
        calculated.shipmentFact = newShipmentFact;
        if (Math.round(newShipmentFact) !== Math.round(oldShipmentFact) && row.edited) {
            calculatedFields.push('shipmentFact');
        }
    }

    calculated.editedFields = calculatedFields;
    return calculated;
};

export const calculateAllRows = (
    rows: any[],
    isScenario: boolean = false,
    originalRows?: any[],
): any[] => {
    const processed = rows.map(calculateRow);

    let originalCalculated: any[] = [];
    if (isScenario && originalRows) {
        originalCalculated = calculateAllRowsInternal(originalRows);
    }

    const inverted = processed.length > 0 &&
        isInvertedProduct(processed[0].enterprise, processed[0].product);

    let lastParkVolume = 0;
    let lastKnownRemains: number | null = null;

    for (let i = 0; i < processed.length; i++) {
        const row = processed[i];

        if (row.parkVolume !== null && row.parkVolume !== undefined) {
            const pv = Number(row.parkVolume);
            if (!isNaN(pv) && pv > 0) {
                lastParkVolume = pv;
            }
        }
        processed[i].parkVolume = lastParkVolume;

        // tradeRemains.
        //
        // Для ИНВЕРТИРОВАННЫХ продуктов (Нефть везде, ВГО на ННОС):
        //   Первое непустое значение (с самого верха) берём как СТАРТОВУЮ ТОЧКУ.
        //   Все следующие — пересчитываем формулой, ИГНОРИРУЯ значение из БД.
        //   Это нужно, потому что Остатки у этих продуктов — производное от
        //   Поставки и Переработки: меняешь канал — Остатки должны двинуться.
        //
        // Для обычных продуктов поведение прежнее: если значение из БД есть —
        // берём его как «факт»; пересчитываем только пустые ячейки цепочкой.
        if (inverted) {
            if (lastKnownRemains === null) {
                // первая встреченная заполненная строка — стартовая точка
                if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
                    const tr = Number(row.tradeRemains);
                    if (!isNaN(tr)) lastKnownRemains = tr;
                }
            } else {
                // стартовая точка уже была — всегда считаем формулой
                const expected = Math.abs(Number(row.expected) || 0);
                const shipment = Math.abs(Number(processed[i].shipmentFact) || 0);
                const newRemains = lastKnownRemains + shipment - expected;
                processed[i].tradeRemains = newRemains;
                lastKnownRemains = newRemains;

                if (isScenario && originalCalculated.length > 0) {
                    const origRemains = Number(originalCalculated[i]?.tradeRemains) || 0;
                    if (Math.round(newRemains) !== Math.round(origRemains)) {
                        if (!processed[i].editedFields) processed[i].editedFields = [];
                        processed[i].editedFields.push('tradeRemains');
                    }
                }
            }
        } else {
            if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
                const tr = Number(row.tradeRemains);
                if (!isNaN(tr)) {
                    lastKnownRemains = tr;
                }
            } else if (lastKnownRemains !== null) {
                const expected = Math.abs(Number(row.expected) || 0);
                const shipment = Math.abs(Number(processed[i].shipmentFact) || 0);
                // Обычные продукты: Остатки = вчера + Выработка - Отгрузка
                const newRemains = lastKnownRemains + expected - shipment;

                processed[i].tradeRemains = newRemains;
                lastKnownRemains = newRemains;

                if (isScenario && originalCalculated.length > 0) {
                    const origRemains = Number(originalCalculated[i]?.tradeRemains) || 0;
                    if (Math.round(newRemains) !== Math.round(origRemains)) {
                        if (!processed[i].editedFields) processed[i].editedFields = [];
                        processed[i].editedFields.push('tradeRemains');
                    }
                }
            }
        }
    }

    for (let i = 0; i < processed.length; i++) {
        const parkVolume = Number(processed[i].parkVolume) || 0;
        const tradeRemains = Number(processed[i].tradeRemains) || 0;
        const newFreeCapacity = parkVolume - tradeRemains;
        processed[i].freeCapacity = newFreeCapacity;

        if (isScenario && originalCalculated.length > 0) {
            const origFreeCapacity = Number(originalCalculated[i]?.freeCapacity) || 0;
            if (Math.round(newFreeCapacity) !== Math.round(origFreeCapacity)) {
                if (!processed[i].editedFields) processed[i].editedFields = [];
                if (!processed[i].editedFields.includes('freeCapacity')) {
                    processed[i].editedFields.push('freeCapacity');
                }
            }
        }
    }

    return processed;
};

function calculateAllRowsInternal(rows: any[]): any[] {
    const processed = rows.map((row) => ({ ...row }));

    const inverted = processed.length > 0 &&
        isInvertedProduct(processed[0].enterprise, processed[0].product);
    const usePlanAsFact = processed.length > 0 &&
        usesShipmentPlanAsFact(processed[0].enterprise, processed[0].product);

    let lastParkVolume = 0;
    let lastKnownRemains: number | null = null;

    for (let i = 0; i < processed.length; i++) {
        const row = processed[i];

        if (row.parkVolume !== null && row.parkVolume !== undefined) {
            const pv = Number(row.parkVolume);
            if (!isNaN(pv) && pv > 0) {
                lastParkVolume = pv;
            }
        }
        processed[i].parkVolume = lastParkVolume;

        if (inverted) {
            const zhd = Math.abs(Number(row.railwayShipmentFact) || 0);
            const pipe = Math.abs(Number(row.pipeShipmentFact) || 0);
            const mnpp = Math.abs(Number(row.mnppShipmentFact) || 0);
            const water = Math.abs(Number(row.waterShipmentFact) || 0);
            let sf = zhd + pipe + mnpp + water;

            if (usePlanAsFact) {
                const shipmentPlan = Number(row.shipmentPlan) || 0;
                if (shipmentPlan !== 0) sf = Math.abs(shipmentPlan);
            }
            processed[i].shipmentFact = sf;
        } else {
            const zhd = Number(row.railwayShipmentFact) || 0;
            const pipe = Number(row.pipeShipmentFact) || 0;
            const mnpp = Number(row.mnppShipmentFact) || 0;
            const water = Number(row.waterShipmentFact) || 0;
            processed[i].shipmentFact = zhd + pipe + mnpp + water;
        }

        if (inverted) {
            if (lastKnownRemains === null) {
                if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
                    const tr = Number(row.tradeRemains);
                    if (!isNaN(tr)) lastKnownRemains = tr;
                }
            } else {
                const expected = Math.abs(Number(row.expected) || 0);
                const shipment = Math.abs(Number(processed[i].shipmentFact) || 0);
                processed[i].tradeRemains = lastKnownRemains + shipment - expected;
                lastKnownRemains = processed[i].tradeRemains;
            }
        } else {
            if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
                const tr = Number(row.tradeRemains);
                if (!isNaN(tr)) {
                    lastKnownRemains = tr;
                }
            } else if (lastKnownRemains !== null) {
                const expected = Math.abs(Number(row.expected) || 0);
                const shipment = Math.abs(Number(processed[i].shipmentFact) || 0);
                processed[i].tradeRemains = lastKnownRemains + expected - shipment;
                lastKnownRemains = processed[i].tradeRemains;
            }
        }

        const pv = Number(processed[i].parkVolume) || 0;
        const tr = Number(processed[i].tradeRemains) || 0;
        processed[i].freeCapacity = pv - tr;
    }

    return processed;
}

export type IndicatorColor = 'red' | 'orange' | 'yellow' | null;

export const getProductIndicator = (rows: any[]): IndicatorColor => {
    const now = new Date();
    const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

    const processed = calculateAllRows(rows);

    let hasNegativeRemains = false;
    let hasLessThan1In10Days = false;
    let hasLessThan1After10Days = false;

    let dayIndex = 0;

    for (const row of processed) {
        const date = Number(row.date);
        if (date < today) continue;

        dayIndex++;
        const freeCapacity = Number(row.freeCapacity) || 0;
        const expected = Math.abs(Number(row.expected) || 0);
        const tradeRemains = Number(row.tradeRemains) || 0;

        if (tradeRemains < 0) {
            hasNegativeRemains = true;
        }

        if (expected > 0) {
            const daysLeft = freeCapacity / expected;
            if (daysLeft < 1) {
                if (dayIndex <= 10) {
                    hasLessThan1In10Days = true;
                } else {
                    hasLessThan1After10Days = true;
                }
            }
        }
    }

    if (hasLessThan1In10Days) return 'red';
    if (hasLessThan1After10Days) return 'orange';
    if (hasNegativeRemains) return 'yellow';
    return null;
};
