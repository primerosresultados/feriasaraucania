export interface Lot {
    numeroLote: number;
    cantidad: number;
    peso: number;
    precio: number;
    vendedor: string;
    tipoLote: string;
}

// Pre-computed summary per tipo de lote from the source XML
// The XML only lists top items per type, not all, so these
// pre-computed values are the authoritative source for averages.
export interface TipoLoteSummary {
    descripcion: string;
    cantidadtotal: number;
    pesototal: number;
    pptotal: number; // Precio promedio general (all animals)
}

export interface Auction {
    id: string;
    recinto: string;
    fecha: string; // DD/MM/YY
    totalAnimales: number;
    totalKilos: number;
    lots: Lot[];
    summaries?: TipoLoteSummary[]; // Optional for backward compat with old data
}

export interface Stats {
    avgPrice: number;
    maxPrice: number;
    minPrice: number;
    totalQuantity: number;
}
