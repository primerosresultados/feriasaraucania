import { z } from "zod";

export const CANONICAL_RECINTOS = ["TEMUCO", "FREIRE", "VICTORIA"] as const;

export const CANONICAL_SPECIES = [
    "NOVILLOS GORDOS",
    "VAQUILLAS GORDAS",
    "VACAS GORDAS",
    "NOVILLOS ENGORDA",
    "VAQUILLAS ENGORDA",
    "VACAS ENGORDA",
    "TERNEROS",
    "TERNERAS",
    "VACAS CON CRIAS",
    "TOROS",
    "BUEYES",
    "VACAS CARNAZA",
    "CABALLARES",
] as const;

export const LotSchema = z.object({
    numeroLote: z.number().int().nonnegative(),
    cantidad: z.number().int().nonnegative(),
    peso: z.number().nonnegative(),
    precio: z.number().nonnegative(),
    vendedor: z.string(),
    tipoLote: z.string(),
});

export const TipoLoteSummarySchema = z.object({
    descripcion: z.string(),
    cantidadtotal: z.number().nonnegative(),
    pesototal: z.number().nonnegative(),
    pptotal: z.number().nonnegative(),
    cantidad5pp: z.number().nonnegative().nullable(),
    peso5pp: z.number().nonnegative().nullable(),
    pp5pp: z.number().nonnegative().nullable(),
});

export const AuctionExtractionSchema = z.object({
    recinto: z.string(),
    fecha: z.string(),
    totalAnimales: z.number().int().nonnegative(),
    totalKilos: z.number().nonnegative(),
    totalVista: z.number().int().nonnegative().nullable(),
    summaries: z.array(TipoLoteSummarySchema),
    lots: z.array(LotSchema),
});

export type AuctionExtraction = z.infer<typeof AuctionExtractionSchema>;
