export interface ChessDataRow {
    id: number;
    date: number;
    enterprise: string;
    product: string;
    plan: number | null;
    fact: number | null;
    expected: number | null;
    stage: string | null;
    tradeRemains: number | null;
    freeCapacity: number | null;
    parkVolume: number | null;
    railwayShipment: string | null;
    waterShipment: string | null;
    pipe: string | null;
    mnpp: string | null;
    autoShipment: string | null;
    shipmentPlan: string | null;
    shipmentFact: string | null;
    passport: string | null;
    unregisteredShipment: number | null;
    pourShipment: number | null;
}
