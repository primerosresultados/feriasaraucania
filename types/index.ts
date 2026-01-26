export interface Lot {
    numeroLote: number;
    cantidad: number;
    peso: number;
    precio: number;
    vendedor: string;
    tipoLote: string;
}

export interface Auction {
    id: string;
    recinto: string;
    fecha: string; // DD/MM/YY
    totalAnimales: number;
    totalKilos: number;
    lots: Lot[];
}

export interface Stats {
    avgPrice: number;
    maxPrice: number;
    minPrice: number;
    totalQuantity: number;
}
