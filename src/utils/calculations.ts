export const calculateRow = (row: any): any => {
    const calculated = { ...row };
    const calculatedFields: string[] = row.editedFields ? [...row.editedFields] : [];

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

    calculated.editedFields = calculatedFields;
    return calculated;
};

export const calculateAllRows = (
    rows: any[],
    isScenario: boolean = false,
    originalRows?: any[],
): any[] => {
    const processed = rows.map(calculateRow);

    // Считаем оригинальные значения для сравнения
    let originalCalculated: any[] = [];
    if (isScenario && originalRows) {
        originalCalculated = calculateAllRowsInternal(originalRows);
    }

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

        if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
            const tr = Number(row.tradeRemains);
            if (!isNaN(tr)) {
                lastKnownRemains = tr;
            }
        } else if (lastKnownRemains !== null) {
            const expected = Number(row.expected) || 0;
            const shipment = Number(processed[i].shipmentFact) || 0;
            const newRemains = lastKnownRemains - shipment + expected;

            processed[i].tradeRemains = newRemains;
            lastKnownRemains = newRemains;

            // Подсвечиваем только если отличается от оригинального расчёта
            if (isScenario && originalCalculated.length > 0) {
                const origRemains = Number(originalCalculated[i]?.tradeRemains) || 0;
                if (Math.round(newRemains) !== Math.round(origRemains)) {
                    if (!processed[i].editedFields) processed[i].editedFields = [];
                    processed[i].editedFields.push('tradeRemains');
                }
            }
        }
    }

    for (let i = 0; i < processed.length; i++) {
        const parkVolume = Number(processed[i].parkVolume) || 0;
        const tradeRemains = Number(processed[i].tradeRemains) || 0;
        const newFreeCapacity = parkVolume - tradeRemains;
        processed[i].freeCapacity = newFreeCapacity;

        // Подсвечиваем свободную емкость если отличается от оригинала
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

// Внутренний расчёт без подсветки — для получения оригинальных значений
function calculateAllRowsInternal(rows: any[]): any[] {
    const processed = rows.map((row) => ({ ...row }));

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

        const zhd = Number(row.railwayShipmentFact) || 0;
        const pipe = Number(row.pipeShipmentFact) || 0;
        const mnpp = Number(row.mnppShipmentFact) || 0;
        const water = Number(row.waterShipmentFact) || 0;
        processed[i].shipmentFact = zhd + pipe + mnpp + water;

        if (row.tradeRemains !== null && row.tradeRemains !== undefined) {
            const tr = Number(row.tradeRemains);
            if (!isNaN(tr)) {
                lastKnownRemains = tr;
            }
        } else if (lastKnownRemains !== null) {
            const expected = Number(row.expected) || 0;
            const shipment = Number(processed[i].shipmentFact) || 0;
            processed[i].tradeRemains = lastKnownRemains - shipment + expected;
            lastKnownRemains = processed[i].tradeRemains;
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
        const expected = Number(row.expected) || 0;
        const tradeRemains = Number(row.tradeRemains) || 0;

        // Остатки < 0 → жёлтый
        if (tradeRemains < 0) {
            hasNegativeRemains = true;
        }

        // Сут. хода = свободная емкость / выработка
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

    // Приоритет: красный > оранжевый > жёлтый
    if (hasLessThan1In10Days) return 'red';
    if (hasLessThan1After10Days) return 'orange';
    if (hasNegativeRemains) return 'yellow';
    return null;
};
