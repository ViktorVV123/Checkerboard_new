// src/utils/excelSchema.ts
//
// КОПИЯ файла backEnd/src/shared/excel-schema.ts.
// Нужна на фронте для отображения превью (показать пользователю
// человекочитаемые displayName вместо dbProduct типа "Авиакеросины").
//
// ⚠️ При изменении словаря — обновить оба файла.

export const PREFIX_TO_FIELD: Record<string, string> = {
    '3': 'railwayShipmentFact',
    '1': 'waterShipmentFact',
    '2': 'pipeShipmentFact',
    '5': 'mnppShipmentFact',
    '203': 'expected',
    '201': 'expected',
    '505': 'tradeRemains',
};

export const PRODUCT_ID_TO_DB: Record<
    string,
    { enterprise: string; dbProduct: string; displayName: string }
> = {
    '2054':    { enterprise: 'ВНП', dbProduct: 'Нефть',        displayName: 'Нефть' },
    '1480873': { enterprise: 'ВНП', dbProduct: 'Мазут',        displayName: 'Мазут' },
    '1481031': { enterprise: 'ВНП', dbProduct: 'ВГО',          displayName: 'ВГО' },
    '3006993': { enterprise: 'ВНП', dbProduct: 'ДТ сорт',      displayName: 'ДТ сорт' },
    '1629478': { enterprise: 'ВНП', dbProduct: 'ТБЛ',          displayName: 'ТБЛ' },
    '12020':   { enterprise: 'ВНП', dbProduct: 'Нафта',        displayName: 'Нафта' },
    '1740109': { enterprise: 'ВНП', dbProduct: 'АИ-92',        displayName: 'АИ-92' },
    '2150510': { enterprise: 'ВНП', dbProduct: 'АИ-95',        displayName: 'АИ-95' },
    '1318':    { enterprise: 'ВНП', dbProduct: 'Авиакеросины', displayName: 'ТС-1' },
};

/** Человекочитаемое имя для поля БД (для UI превью). */
export const FIELD_LABELS: Record<string, string> = {
    expected: 'Выработка',
    tradeRemains: 'Накопление',
    parkVolume: 'Объём парка',
    railwayShipmentFact: 'ЖД',
    waterShipmentFact: 'Вода',
    pipeShipmentFact: 'Труба',
    mnppShipmentFact: 'МНПП',
};

/** dbProduct → displayName (для отрисовки превью). */
export const dbProductToDisplay = (dbProduct: string): string => {
    const entry = Object.values(PRODUCT_ID_TO_DB).find((x) => x.dbProduct === dbProduct);
    return entry?.displayName ?? dbProduct;
};

/** Только эти заводы поддерживают импорт сейчас. */
export const IMPORT_SUPPORTED_ENTERPRISES = ['ВНП'] as const;
export const isImportSupported = (enterprise: string): boolean =>
    (IMPORT_SUPPORTED_ENTERPRISES as readonly string[]).includes(enterprise);
