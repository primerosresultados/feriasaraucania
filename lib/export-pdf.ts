"use client";

import jsPDF from "jspdf";
import "jspdf-autotable";
import { Auction, Lot, TipoLoteSummary } from "@/types";
import { sortSpecies } from "@/lib/utils";
import { LOGO_BASE64 } from "@/lib/logo-base64";

// Extend jsPDF type
declare module "jspdf" {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
        lastAutoTable: { finalY: number };
    }
}

// ═══════════════════════════════════════════════════════
// LAYOUT CONSTANTS — Single source of truth for all
// spacing, sizing, and color decisions in the PDF.
// ═══════════════════════════════════════════════════════

/** Page & margin — US Letter portrait */
const PAGE = {
    width: 215.9,        // US Letter portrait mm (8.5in)
    height: 279.4,       // US Letter portrait mm (11in)
    marginLeft: 10,
    marginRight: 10,
    /** Usable width inside margins */
    get usable() { return this.width - this.marginLeft - this.marginRight; },
} as const;

/** Vertical spacing tokens (mm) */
const SPACING = {
    afterHeader: 1.5,      // gap below header bar
    afterResumen: 1.5,     // gap below resumen+glossary row
    afterSectionTitle: 0.5,// gap below "DETALLE POR CATEGORÍAS" title
    cardRowGap: 2,         // vertical gap between rows of category cards
    beforeFooter: 1,       // gap before the footer bar
    beforeChart: 2,        // gap before the price history chart
    pageBreakMargin: 15,   // minimum space to keep before forcing a new page
} as const;

/** Heights of fixed-size sections (mm) */
const HEIGHTS = {
    header: 15,            // total header bar height (dark bg)
    headerAccentBar: 0.8,  // yellow accent line at bottom of header
    resumenRow: 14,        // height of resumen+glossary row
    sectionTitle: 5,       // "DETALLE POR CATEGORÍAS" block
    footer: 6,             // footer strip height
    cardTitle: 7,          // category card title (dark bar)
    cardSubHeader: 5,      // column labels row (Cant/Peso/Precio/Vend.)
    cardFooter: 5,         // subtotals row inside a card
    cardPadBottom: 0.8,    // padding below footer inside card
    cardRow: 4.6,          // line height per lot row
    stackedInnerGap: 1.5,  // vertical gap between two stacked mini-cards
    chartBase: 46,         // chart plot area base height (legend is inline on the right)
    chartLegendRowH: 3.5,  // height per row in vertical legend
    chartLegendW: 28,      // reserved width for right-side legend
    chartTitleH: 5,        // chart title area
    chartAxisLabelW: 14,   // left Y-axis label space
    chartBottomLabelH: 4,  // X-axis label area
    chartPadTop: 2,        // top padding inside chart
    chartPadRight: 4,      // right padding inside chart
    newPageHeader: 22,     // smaller header on continuation pages
} as const;

/** Card grid layout */
const CARD_GRID = {
    columns: 3,
    gap: 3,               // horizontal gap between cards
    get cardWidth() { return (PAGE.usable - this.gap * (this.columns - 1)) / this.columns; },
} as const;

/** Max lot rows per card. Floor = MAX_LOTS_PER_CARD; rows containing a group
 *  with a higher ppN (e.g. TEMUCO gordos = 13) lift the cap for that row.
 *  MAX_LOTS_FIRST_ROW is kept as the historical positional ceiling — currently
 *  matches the ppN ceiling, retained for easy revert to row-index logic. */
const MAX_LOTS_FIRST_ROW = 13;
const MAX_LOTS_PER_CARD = 5;
const maxLotsForRow = (rowCells: GridCell[]): number => {
    const ppNs = rowCells.flatMap(c =>
        c.kind === "single" ? [c.group.ppN] : [c.top.ppN, c.bottom.ppN]
    );
    return Math.max(MAX_LOTS_PER_CARD, ...ppNs);
};

/** Column width ratios inside a category card */
const CARD_COL_RATIOS = [0.12, 0.26, 0.32, 0.30] as const;

/** Logo dimensions */
const LOGO = {
    height: 12,
    aspectRatio: 1024 / 346, // original image dimensions
    get width() { return this.height * this.aspectRatio; },
} as const;

/** Border radius tokens */
const RADIUS = {
    card: 1.5,
    box: 2,
} as const;

// ─── Color Palette ───
const COLORS = {
    primary: [4, 20, 26] as [number, number, number],         // #04141A — Header dark
    primaryLight: [15, 52, 80] as [number, number, number],    // Lighter dark teal
    accent: [22, 163, 74] as [number, number, number],         // #16a34a — mid green (readable vs black)
    accentLight: [220, 252, 231] as [number, number, number],  // Pale tint of accent
    warmOrange: [249, 115, 22] as [number, number, number],    // Orange highlight
    text: [30, 41, 59] as [number, number, number],            // Slate-800
    textLight: [100, 116, 139] as [number, number, number],    // Slate-500
    textMuted: [148, 163, 184] as [number, number, number],    // Slate-400
    border: [226, 232, 240] as [number, number, number],       // Slate-200
    bgLight: [248, 250, 252] as [number, number, number],      // Slate-50
    bgCard: [241, 245, 249] as [number, number, number],       // Slate-100
    white: [255, 255, 255] as [number, number, number],
    gold: [22, 163, 74] as [number, number, number],           // Mapped to mid green #16a34a
    chartColors: [
        [234, 179, 8],     // Yellow/gold
        [59, 130, 246],    // Blue
        [4, 20, 26],       // Dark (#04141A)
        [139, 92, 246],    // Violet
        [236, 72, 153],    // Pink
        [6, 182, 212],     // Cyan
        [239, 68, 68],     // Red
        [249, 115, 22],    // Orange
        [99, 102, 241],    // Indigo
        [20, 184, 166],    // Teal
    ] as [number, number, number][],
};

/** Species names - full names */
const SPECIES_NAMES: Record<string, string> = {
    "NOVILLOS GORDOS": "Novillos Gordos",
    "VAQUILLAS GORDAS": "Vaquillas Gordas",
    "VACAS GORDAS": "Vacas Gordas",
    "NOVILLOS ENGORDA": "Novillos Engorda",
    "VAQUILLAS ENGORDA": "Vaquillas Engorda",
    "VACAS ENGORDA": "Vacas Engorda",
    "TERNEROS": "Terneros",
    "TERNERAS": "Terneras",
    "VACAS CON CRIAS": "Vacas con Crías",
    "TOROS": "Toros",
    "BUEYES": "Bueyes",
    "VACAS CARNAZA": "Vacas Carnaza",
    "CABALLARES": "Caballares",
};

/** Fixed chart colors by species. Falls back to chartColors palette if not listed. */
function chartColorFor(category: string, fallbackIdx: number): [number, number, number] {
    const up = category.toUpperCase().trim();
    if (up === "NOVILLOS ENGORDA") return [59, 130, 246];   // Blue
    if (up === "VAQUILLAS ENGORDA") return [239, 68, 68];   // Red
    if (up === "TERNEROS") return [34, 197, 94];            // Green
    if (up === "TERNERAS") return [139, 92, 246];           // Purple
    return COLORS.chartColors[fallbackIdx % COLORS.chartColors.length] as [number, number, number];
}

/** Gordo categories that use top 13 for average — only applies in TEMUCO */
const TOP_13_CATEGORIES = ["NOVILLOS GORDOS", "VACAS GORDAS", "VAQUILLAS GORDAS"];

// ═══════════════════════════════════════════════════════
// HELPERS — Pure utility functions
// ═══════════════════════════════════════════════════════

function getSpeciesName(sp: string): string {
    return SPECIES_NAMES[sp.toUpperCase()] || sp;
}

function getInitials(v: string): string {
    if (!v || v === "__SUMMARY__") return "";
    const words = v.trim().split(/\s+/);
    let initials = "";
    for (let i = 0; i < Math.min(3, words.length); i++) {
        initials += words[i].charAt(0).toUpperCase();
    }
    return initials;
}

function formatDateLong(fecha: string): string {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const formatOne = (s: string): string => {
        const trimmed = s.trim();
        const sep = trimmed.includes("/") ? "/" : "-";
        const parts = trimmed.split(sep);
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            return `${day} de ${months[month]} ${year}`;
        }
        return trimmed;
    };
    const rangeParts = fecha.split(/\s*(?:→|->|—)\s*/).filter(p => /\d/.test(p));
    if (rangeParts.length === 2) {
        return `${formatOne(rangeParts[0])} al ${formatOne(rangeParts[1])}`;
    }
    return formatOne(fecha);
}

function parseDate(fecha: string): Date {
    const parts = fecha.split(/[\/\-]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
    }
    return new Date();
}

/** Compute the weighted average of the first N lots (sorted by price desc) */
function topNWeightedAvg(lots: Lot[], n: number): number {
    const topN = lots.slice(0, n);
    const totalW = topN.reduce((a, l) => a + l.peso, 0);
    const totalV = topN.reduce((a, l) => a + l.peso * l.precio, 0);
    return totalW > 0 ? totalV / totalW : 0;
}

// ═══════════════════════════════════════════════════════
// DRAWING PRIMITIVES
// ═══════════════════════════════════════════════════════

/** Draw a rounded rectangle with fill and optional stroke */
function roundRect(
    doc: jsPDF, x: number, y: number, w: number, h: number,
    r: number, fill: [number, number, number], stroke?: [number, number, number]
) {
    doc.setFillColor(...fill);
    if (stroke) {
        doc.setDrawColor(...stroke);
        doc.setLineWidth(0.3);
    }
    doc.roundedRect(x, y, w, h, r, r, stroke ? "FD" : "F");
}

// ═══════════════════════════════════════════════════════
// DATA TYPES
// ═══════════════════════════════════════════════════════

interface SpeciesGroup {
    name: string;
    shortName: string;
    lots: Lot[];
    summary?: TipoLoteSummary;
    totalCabezas: number;
    totalPeso: number;
    avgPrice: number;
    topPrice: number;
    /** Primeros Precios (PP) — top N lots by price */
    ppN: number;           // 5 or 13 depending on category
    ppCabezas: number;     // sum of cantidad from top N lots
    ppPeso: number;        // sum of peso from top N lots
    ppAvgPrice: number;    // weighted average price of top N lots
}

/**
 * Per-category trend data point: one entry per time period (auction date).
 * Each key in `categoryPrices` maps a species name to its weighted avg price.
 */
interface CategoryTrendPoint {
    label: string;          // X-axis label, e.g. "08/03" or "Ene 25"
    sortKey: number;        // for chronological sorting
    categoryPrices: Record<string, number>;  // species → weighted avg price
}

/** The full trend dataset returned by calculateCategoryTrendData */
interface CategoryTrendData {
    points: CategoryTrendPoint[];
    categories: string[];   // sorted list of species that appear in the data
}

// ═══════════════════════════════════════════════════════
// MEASUREMENT FUNCTIONS — calculate heights before render
// ═══════════════════════════════════════════════════════

/**
 * Measure the total height of a single category card.
 * This is used BEFORE rendering to determine uniform row heights.
 *
 * Card anatomy:
 *  ┌─ cardTitle ──────────────┐
 *  │  SubHeader (col labels)  │
 *  │  ─────────────────────── │
 *  │  lot row × N             │
 *  │  ─────────── (accent)    │
 *  │  PP row  (prim. precios) │
 *  │  GRAL row (totals)       │
 *  │  padBottom               │
 *  └──────────────────────────┘
 */
function measureCategoryCardHeight(group: SpeciesGroup, rowH: number = HEIGHTS.cardRow, maxLots: number = MAX_LOTS_PER_CARD): number {
    return (
        HEIGHTS.cardTitle +
        HEIGHTS.cardSubHeader +
        Math.min(group.lots.length, maxLots) * rowH +
        HEIGHTS.cardFooter * 2 +  // PP row + PR.GRAL row
        HEIGHTS.cardPadBottom
    );
}

// ═══════════════════════════════════════════════════════
// GRID CELL ABSTRACTION
// A cell occupies one slot in the 3-column grid. It is either a single
// category card or a stacked pair of two mini-cards (used to combine
// Vacas Carnaza + Caballares per reference design).
// ═══════════════════════════════════════════════════════

type GridCell =
    | { kind: "single"; group: SpeciesGroup }
    | { kind: "stacked"; top: SpeciesGroup; bottom: SpeciesGroup };

function cellLotLines(c: GridCell, cap: number = MAX_LOTS_PER_CARD): number {
    return c.kind === "single"
        ? Math.min(c.group.lots.length, cap)
        : Math.min(c.top.lots.length, cap) + Math.min(c.bottom.lots.length, cap);
}

function cellExtraChrome(c: GridCell): number {
    const chromeOne = HEIGHTS.cardTitle + HEIGHTS.cardSubHeader + HEIGHTS.cardFooter * 2 + HEIGHTS.cardPadBottom;
    return c.kind === "single" ? chromeOne : chromeOne * 2 + HEIGHTS.stackedInnerGap;
}

function cellHeight(c: GridCell, rowH: number, cap: number = MAX_LOTS_PER_CARD): number {
    return cellLotLines(c, cap) * rowH + cellExtraChrome(c);
}

/**
 * Build grid cells — one cell per species group, no stacking.
 */
function buildGridCells(groups: SpeciesGroup[]): GridCell[] {
    return groups.map(g => ({ kind: "single", group: g } as GridCell));
}

/** Species that belong in the final row, in display order. */
const LAST_ROW_SPECIES = ["TOROS", "BUEYES", "VACAS CARNAZA", "CABALLARES"] as const;

/**
 * Group cells into rows. Toros, Bueyes, Vacas Carnaza and Caballares are
 * pulled out (in that order) to form the last row — up to 4 cards. The rest
 * are laid out in 3-column rows above.
 */
function buildRowLayouts(cells: GridCell[]): GridCell[][] {
    const lastRow: GridCell[] = [];
    for (const name of LAST_ROW_SPECIES) {
        const c = cells.find(c => c.kind === "single" && c.group.name === name);
        if (c) lastRow.push(c);
    }
    const rest = cells.filter(c => !lastRow.includes(c));

    const rows: GridCell[][] = [];
    for (let i = 0; i < rest.length; i += 3) rows.push(rest.slice(i, i + 3));
    if (lastRow.length > 0) rows.push(lastRow);
    return rows;
}

/**
 * Measure the height needed for the glossary box based on actual content.
 * Uses: title line + N glossary items × item height + padding.
 */
function measureGlossaryHeight(itemCount: number): number {
    const titlePad = 3;   // space above title baseline from box top
    const titleH = 3;     // title text height
    const itemH = 2.8;    // per glossary item line height
    const padBottom = 1.5;// padding below last item
    return titlePad + titleH + itemCount * itemH + padBottom;
}

// ═══════════════════════════════════════════════════════
// TREND DATA CALCULATION — Per-category, año móvil (rolling year)
// ═══════════════════════════════════════════════════════

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Build per-category price trend data from the LAST 3 MONTHS of auctions.
 * One chart point per auction date, labeled "DD-mmm" (e.g. "24-feb").
 * Computes a weighted average price for each cattle category.
 *
 * @param auctions  All available auctions to pull historical data from.
 * @param referenceDate  The date of the current auction (determines the
 *                       end of the 3-month window).
 * @param allowedCategories  If provided, only these categories (uppercase)
 *                           will be included in the chart.
 */
function calculateCategoryTrendData(
    auctions: Auction[],
    referenceDate?: Date,
    allowedCategories?: string[]
): CategoryTrendData {
    if (!auctions.length) return { points: [], categories: [] };

    // Last 3 months window ending at the reference date
    const refDate = referenceDate || parseDate(auctions[auctions.length - 1].fecha);
    const endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59);
    const startDate = new Date(refDate.getFullYear(), refDate.getMonth() - 3, refDate.getDate());

    const allowedSet = allowedCategories
        ? new Set(allowedCategories.map(c => c.toUpperCase()))
        : null;

    // Group by auction date (one point per auction) → per-species accumulators.
    // Use the XML-provided summary (pptotal = Promedio General of ALL animals)
    // when available, falling back to weighted avg of reported lots
    // (which are only the primeros precios) otherwise.
    const dayMap = new Map<string, {
        label: string;
        sortKey: number;
        species: Map<string, { totalWeight: number; totalValue: number; gralPrice?: number; gralWeight?: number }>;
    }>();

    auctions.forEach(a => {
        const d = parseDate(a.fecha);
        if (d < startDate || d > endDate) return;

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (!dayMap.has(key)) {
            const label = `${String(d.getDate()).padStart(2, '0')}-${MONTH_LABELS[d.getMonth()]}`;
            dayMap.set(key, {
                label,
                sortKey: d.getTime(),
                species: new Map(),
            });
        }
        const entry = dayMap.get(key)!;

        a.lots.forEach(lot => {
            if (lot.vendedor === "__SUMMARY__") return;
            const sp = lot.tipoLote.toUpperCase();
            if (allowedSet && !allowedSet.has(sp)) return;
            if (!entry.species.has(sp)) {
                entry.species.set(sp, { totalWeight: 0, totalValue: 0 });
            }
            const acc = entry.species.get(sp)!;
            acc.totalWeight += lot.peso;
            acc.totalValue += lot.peso * lot.precio;
        });

        // Some older auctions stash the per-species summary as a __SUMMARY__ lot
        // instead of populating a.summaries. Fall back to those so the chart's
        // Promedio General matches the listing's value.
        const summaries = (a.summaries && a.summaries.length > 0)
            ? a.summaries
            : a.lots.filter(l => l.vendedor === "__SUMMARY__").map(l => ({
                descripcion: l.tipoLote,
                cantidadtotal: l.cantidad,
                pesototal: l.peso,
                pptotal: l.precio,
            }));

        summaries.forEach(s => {
            const sp = s.descripcion.toUpperCase();
            if (allowedSet && !allowedSet.has(sp)) return;
            if (!s.pptotal || s.pptotal <= 0) return;
            if (!entry.species.has(sp)) {
                entry.species.set(sp, { totalWeight: 0, totalValue: 0 });
            }
            const acc = entry.species.get(sp)!;
            // Aggregate across auctions same day weighted by total weight
            const w = s.pesototal && s.pesototal > 0 ? s.pesototal : 1;
            acc.gralPrice = (acc.gralPrice ?? 0) + s.pptotal * w;
            acc.gralWeight = (acc.gralWeight ?? 0) + w;
        });
    });

    const sorted = Array.from(dayMap.entries())
        .sort((a, b) => a[1].sortKey - b[1].sortKey);

    const allCategories = new Set<string>();
    sorted.forEach(([, entry]) => {
        entry.species.forEach((_, sp) => allCategories.add(sp));
    });
    const categories = sortSpecies(Array.from(allCategories));

    const points: CategoryTrendPoint[] = sorted.map(([, entry]) => {
        const categoryPrices: Record<string, number> = {};
        entry.species.forEach((acc, sp) => {
            if (acc.gralWeight && acc.gralWeight > 0 && acc.gralPrice !== undefined) {
                // Promedio General from authoritative summary (all animals)
                categoryPrices[sp] = Math.round(acc.gralPrice / acc.gralWeight);
            } else if (acc.totalWeight > 0) {
                // Fallback: weighted avg of reported lots (primeros precios)
                categoryPrices[sp] = Math.round(acc.totalValue / acc.totalWeight);
            }
        });
        return {
            label: entry.label,
            sortKey: entry.sortKey,
            categoryPrices,
        };
    });

    return { points, categories };
}

/**
 * Measure the total height of the chart section (plot + legend).
 * Legend is laid out as a grid with up to 3 items per row.
 */
function measureChartSectionHeight(_categoryCount: number): number {
    // Legend is inline on the right — height is independent of category count
    return (
        HEIGHTS.chartTitleH +
        HEIGHTS.chartPadTop +
        HEIGHTS.chartBase +
        HEIGHTS.chartBottomLabelH +
        2 // bottom padding
    );
}

// ═══════════════════════════════════════════════════════
// SECTION RENDERERS — Each returns the final cursorY
// ═══════════════════════════════════════════════════════

/**
 * Render the main header bar (logo + recinto + date + accent strip).
 * Returns cursorY after the header + spacing.
 */
function renderHeader(doc: jsPDF, recintoName: string, fecha: string): number {
    const h = HEIGHTS.header;
    const pw = PAGE.width;
    const ml = PAGE.marginLeft;
    const mr = PAGE.marginRight;

    // Dark background
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pw, h, "F");

    const contentAreaH = h - HEIGHTS.headerAccentBar;
    const contentMidY = contentAreaH / 2;

    // ── Logo on the left, vertically centered ──
    const logoY = (contentAreaH - LOGO.height) / 2;
    try {
        doc.addImage(LOGO_BASE64, "PNG", ml, logoY, LOGO.width, LOGO.height);
    } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...COLORS.white);
        doc.text("FERIAS ARAUCANÍA", ml, contentMidY + 1);
    }

    // ── City + Date on the right, vertically centered ──
    const city = recintoName.toUpperCase();
    const dateText = formatDateLong(fecha).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(city, pw - mr, contentMidY - 1.2, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(dateText, pw - mr, contentMidY + 3.2, { align: "right" });

    // Yellow accent bar at the bottom of header
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, h - HEIGHTS.headerAccentBar, pw, HEIGHTS.headerAccentBar, "F");

    return h + SPACING.afterHeader;
}

/**
 * Render the "Resumen Totales" + "Glosario" side-by-side row.
 * Returns cursorY after the row + spacing.
 */
function renderSummaryAndGlossary(
    doc: jsPDF, y: number,
    totalAnimales: number
): number {
    const ml = PAGE.marginLeft;
    const uw = PAGE.usable;

    // Left box takes 35%, right box takes the rest, with a 3mm gap
    const gapBetween = 3;
    const resumenW = uw * 0.35;
    const glossaryW = uw - resumenW - gapBetween;

    // Glossary content
    const glossaryItems = [
        { key: "Cantidad:", desc: "Número de animales en el lote" },
        { key: "Peso:", desc: "Peso en Kg de todo el lote" },
        { key: "Precio:", desc: "Precio por kilo al que se transó el lote" },
        { key: "PP:", desc: "Totales de los primeros precios" },
        { key: "Gral:", desc: "Totales de todos los animales transados" },
    ];

    // Two-column glossary: col1 = Cantidad/Peso/Precio, col2 = PP/Gral
    const colItemsCount = Math.max(3, glossaryItems.length - 3); // 3 in each column max
    const glossaryH = measureGlossaryHeight(colItemsCount);
    const rowH = Math.max(HEIGHTS.resumenRow, glossaryH);

    // ── Left: Animales Transados (no title, centered label + value) ──
    roundRect(doc, ml, y, resumenW, rowH, RADIUS.box, COLORS.white, COLORS.border);

    // Accent bar at top
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y, resumenW, 1.5, "F");

    // Label (left) + value (right) vertically centered
    const midY = y + rowH / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Animales Transados", ml + 4, midY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.accent);
    doc.text(totalAnimales.toLocaleString("es-CL"), ml + resumenW - 4, midY, { align: "right" });

    // ── Right: Glossary (two columns) ──
    const glossaryX = ml + resumenW + gapBetween;
    roundRect(doc, glossaryX, y, glossaryW, rowH, RADIUS.box, COLORS.bgLight, COLORS.border);

    // Glossary title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primaryLight);
    const glossaryTitleY = y + 4;
    doc.text("Glosario", glossaryX + 4, glossaryTitleY);

    // Split items into two columns
    const col1Items = glossaryItems.slice(0, 3);
    const col2Items = glossaryItems.slice(3);
    const firstItemY = glossaryTitleY + 3;
    const itemLineH = 2.8;
    const col2X = glossaryX + glossaryW / 2;

    const drawCol = (items: typeof glossaryItems, startX: number, keyOffset: number) => {
        items.forEach((item, i) => {
            const gy = firstItemY + i * itemLineH;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.setTextColor(...COLORS.primary);
            doc.text(item.key, startX, gy);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(...COLORS.textLight);
            doc.text(item.desc, startX + keyOffset, gy);
        });
    };

    drawCol(col1Items, glossaryX + 4, 16);
    drawCol(col2Items, col2X, 12);

    return y + rowH + SPACING.afterResumen;
}

/**
 * Render the "DETALLE POR CATEGORÍAS" section title with underline.
 * Returns cursorY after the title + spacing.
 */
function renderSectionTitle(doc: jsPDF, y: number, title: string): number {
    const ml = PAGE.marginLeft;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text(title, ml, y + 5);

    // Accent underline
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y + 7, 45, 0.8, "F");

    return y + HEIGHTS.sectionTitle + SPACING.afterSectionTitle;
}

/**
 * Render a single category card at a given position with a given height.
 * The card is rendered to `forcedHeight` regardless of its content height,
 * ensuring all cards in a row are the same height.
 */
function renderCategoryCard(
    doc: jsPDF,
    group: SpeciesGroup,
    x: number, y: number,
    width: number, forcedHeight: number,
    rowH: number = HEIGHTS.cardRow,
    maxLots: number = MAX_LOTS_PER_CARD
): void {
    const sw = CARD_COL_RATIOS.map(r => width * r);

    // Outer card container (uses forcedHeight for uniform row height)
    roundRect(doc, x, y, width, forcedHeight, RADIUS.card, COLORS.white, COLORS.border);

    // ── Title bar (dark background, white text) ──
    roundRect(doc, x, y, width, HEIGHTS.cardTitle, 1, COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(group.shortName, x + width / 2, y + HEIGHTS.cardTitle / 2 + 1.4, { align: "center" });

    // ── Sub-header (column labels) — smaller to give room to lot rows ──
    const subY = y + HEIGHTS.cardTitle + 0.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.textLight);

    doc.text("Cant", x + sw[0] - 0.5, subY + 2.8, { align: "right" });
    doc.text("Peso Kg", x + sw[0] + sw[1] - 1, subY + 2.8, { align: "right" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] - 1, subY + 2.8, { align: "right" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] - 0.5, subY + 2.8, { align: "right" });

    // Separator line below sub-header
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    const sepLineY = subY + 3.5;
    doc.line(x, sepLineY, x + width, sepLineY);

    // ── Lot rows ──
    let rowY = sepLineY + 2;
    const lineH = rowH;

    const rowFontSize = 7.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(rowFontSize);
    doc.setTextColor(...COLORS.text);

    group.lots.slice(0, maxLots).forEach((lot, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
            doc.setFillColor(...COLORS.bgLight);
            doc.rect(x, rowY - 2.2, width, lineH, "F");
        }

        let sx = x;
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(rowFontSize);
        doc.text(lot.cantidad.toString(), sx + sw[0] - 0.5, rowY, { align: "right" });
        sx += sw[0];

        doc.text(Math.round(lot.peso).toLocaleString("es-CL"), sx + sw[1] - 1, rowY, { align: "right" });
        sx += sw[1];

        doc.setFont("helvetica", "normal");
        doc.text(Math.round(lot.precio).toLocaleString("es-CL"), sx + sw[2] - 1, rowY, { align: "right" });
        sx += sw[2];

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(rowFontSize);
        doc.text(getInitials(lot.vendedor), sx + sw[3] - 0.5, rowY, { align: "right" });

        rowY += lineH;
    });

    // ── Footer: PP row + PR.GRAL row — pinned to bottom of the card ──
    if (group.lots.length > 0) {
        // PP row sits above PR.GRAL row
        const ppY = y + forcedHeight - HEIGHTS.cardPadBottom - HEIGHTS.cardFooter * 2;
        const gralY = y + forcedHeight - HEIGHTS.cardPadBottom - HEIGHTS.cardFooter;

        // ── PP row (Primeros Precios) ──
        // Accent line above PP row
        doc.setDrawColor(...COLORS.accent);
        doc.setLineWidth(0.3);
        doc.line(x, ppY, x + width, ppY);

        const ppTextY = ppY + 3.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.primary);

        let ppSx = x;
        doc.text(group.ppCabezas.toString(), ppSx + sw[0] - 0.5, ppTextY, { align: "right" });
        ppSx += sw[0];
        doc.text(Math.round(group.ppPeso).toLocaleString("es-CL"), ppSx + sw[1] - 1, ppTextY, { align: "right" });
        ppSx += sw[1];
        doc.setTextColor(...COLORS.accent);
        doc.text(Math.round(group.ppAvgPrice).toLocaleString("es-CL"), ppSx + sw[2] - 1, ppTextY, { align: "right" });
        ppSx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(6);
        doc.text(`PR. ${group.ppN} P.P.`, ppSx + sw[3] - 0.5, ppTextY, { align: "right" });

        // ── PR.GRAL row (totals) ──
        // Subtle separator between PP and GRAL
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.15);
        doc.line(x, gralY, x + width, gralY);

        const gralTextY = gralY + 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.primary);

        let sx = x;
        doc.text(group.totalCabezas.toString(), sx + sw[0] - 0.5, gralTextY, { align: "right" });
        sx += sw[0];
        doc.text(Math.round(group.totalPeso).toLocaleString("es-CL"), sx + sw[1] - 1, gralTextY, { align: "right" });
        sx += sw[1];
        doc.setTextColor(239, 68, 68);
        doc.text(Math.round(group.avgPrice).toLocaleString("es-CL"), sx + sw[2] - 1, gralTextY, { align: "right" });
        sx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("PR.GRAL.", sx + sw[3] - 0.5, gralTextY, { align: "right" });
    }
}

/**
 * Render all category cards in a grid layout. Within each row,
 * all cards share the same height (the maximum of that row).
 * Returns cursorY after all rows.
 */
function renderCategoryGrid(doc: jsPDF, rowLayouts: GridCell[][], startY: number, rowH: number = HEIGHTS.cardRow): number {
    let y = startY;
    const ml = PAGE.marginLeft;
    const gap = CARD_GRID.gap;

    for (let rowIdx = 0; rowIdx < rowLayouts.length; rowIdx++) {
        const rowCells = rowLayouts[rowIdx];
        const cap = maxLotsForRow(rowCells);
        const cols = rowCells.length;
        const cw = (PAGE.usable - gap * (cols - 1)) / cols;

        // Measure all cells in this row
        const heights = rowCells.map(c => cellHeight(c, rowH, cap));
        const maxH = Math.max(...heights);

        // Render each cell with the uniform maxH
        rowCells.forEach((c, ci) => {
            const cx = ml + ci * (cw + gap);
            if (c.kind === "single") {
                renderCategoryCard(doc, c.group, cx, y, cw, maxH, rowH, cap);
            } else {
                // Stacked cell: split the vertical space between top and bottom.
                // Each mini-card takes its natural height; any slack is pushed
                // into the bottom card so both footers stay pinned.
                const topNatural = measureCategoryCardHeight(c.top, rowH);
                const gapInner = HEIGHTS.stackedInnerGap;
                const bottomH = maxH - topNatural - gapInner;
                renderCategoryCard(doc, c.top, cx, y, cw, topNatural, rowH);
                renderCategoryCard(doc, c.bottom, cx, y + topNatural + gapInner, cw, bottomH, rowH);
            }
        });

        y += maxH + SPACING.cardRowGap;
    }

    return y;
}

/**
 * Render the info band: Sr.Cliente legend (left) + totals box (right).
 * Sits between the last row of cards and the chart.
 * Returns cursorY after the band.
 */
function renderInfoBand(
    doc: jsPDF,
    y: number,
    totalAnimales: number,
    totalVista: number | undefined
): number {
    const ml = PAGE.marginLeft;
    const uw = PAGE.usable;
    const bandH = 13;
    const gap = 3;

    const leftW = uw * 0.66;
    const rightW = uw - leftW - gap;
    const rightX = ml + leftW + gap;

    // ── Left: Sr. Cliente legend ──
    roundRect(doc, ml, y, leftW, bandH, RADIUS.box, COLORS.white, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.primary);
    doc.text("Sr. Cliente:", ml + 3, y + 4.3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...COLORS.text);
    const legend =
        "Visite nuestra página web, desde donde podrá obtener los precios actualizados " +
        "al minuto de cierre de cada Remate y otros temas de interés.";
    const legendLines = doc.splitTextToSize(legend, leftW - 22);
    doc.text(legendLines, ml + 20, y + 4.3);

    // Website link, prominent
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text("www.feriasaraucania.cl", ml + leftW / 2, y + bandH - 2.5, { align: "center" });

    // ── Right: totals box ──
    roundRect(doc, rightX, y, rightW, bandH, RADIUS.box, COLORS.white, COLORS.primary);

    // Total Transado (centered vertically in the box)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.primary);
    doc.text("Total Transado", rightX + 4, y + bandH / 2 + 1.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.accent);
    doc.text(totalAnimales.toLocaleString("es-CL"), rightX + rightW - 3, y + bandH / 2 + 1.5, { align: "right" });

    return y + bandH;
}

/**
 * Render the footer strip.
 * Returns cursorY after the footer.
 */
function renderFooter(doc: jsPDF, y: number, totalAnimales: number): number {
    const pw = PAGE.width;
    const ml = PAGE.marginLeft;
    const mr = PAGE.marginRight;
    const fh = HEIGHTS.footer;

    doc.setFillColor(...COLORS.bgCard);
    doc.rect(0, y, pw, fh, "F");

    // Top accent line
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, y, pw, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.text("www.feriasaraucania.cl", ml, y + fh / 2 + 1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text(
        `Total: ${totalAnimales.toLocaleString("es-CL")} cabezas`,
        pw - mr, y + fh / 2 + 1, { align: "right" }
    );

    return y + fh;
}

/**
 * Render a continuation-page header (smaller, simpler).
 * Returns cursorY after the header.
 */
function renderNewPageHeader(doc: jsPDF, recintoName: string, fecha: string): number {
    const pw = PAGE.width;
    const h = HEIGHTS.newPageHeader;

    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pw, h, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(
        `${recintoName.toUpperCase()}  |  ${formatDateLong(fecha).toUpperCase()}`,
        pw / 2, h / 2 + 1, { align: "center" }
    );

    // Accent bar
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, h - 1, pw, 1, "F");

    return h + 4;
}

/**
 * Render a multi-category price trend line chart.
 * Each cattle category gets its own color-coded line.
 * The legend is laid out as a clean grid below the chart area.
 *
 * Returns cursorY after the full chart section (plot + legend).
 */
function renderPriceTrendChart(
    doc: jsPDF,
    trendData: CategoryTrendData,
    y: number
): number {
    const ml = PAGE.marginLeft;
    const uw = PAGE.usable;
    const { points, categories } = trendData;

    if (points.length < 2 || categories.length === 0) {
        return y;
    }

    const totalH = measureChartSectionHeight(categories.length);

    // ── Chart plot area dimensions ──
    const chartAreaX = ml + HEIGHTS.chartAxisLabelW;
    const chartAreaY = y + HEIGHTS.chartTitleH + HEIGHTS.chartPadTop;
    const chartAreaW = uw - HEIGHTS.chartAxisLabelW - HEIGHTS.chartLegendW - HEIGHTS.chartPadRight;
    const chartAreaH = HEIGHTS.chartBase;

    // ── Background & border (full section) ──
    roundRect(doc, ml, y, uw, totalH, RADIUS.box, COLORS.white, COLORS.border);

    // ── Title ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text(
        "Promedios Precios Últimas Semanas",
        ml + uw / 2, y + HEIGHTS.chartTitleH / 2 + 2,
        { align: "center" }
    );

    // ── Calculate Y-axis scale from ALL category prices across all points ──
    let globalMin = Infinity;
    let globalMax = -Infinity;
    points.forEach(pt => {
        Object.values(pt.categoryPrices).forEach(price => {
            if (price > 0) {
                if (price < globalMin) globalMin = price;
                if (price > globalMax) globalMax = price;
            }
        });
    });
    if (!isFinite(globalMin)) globalMin = 0;
    if (!isFinite(globalMax)) globalMax = 1000;

    const priceRange = globalMax - globalMin || 1;
    const yPad = priceRange * 0.22; // breathing room above/below the data

    // Adaptive tick step targeting ~8 grid lines so labels never collide.
    const niceSteps = [100, 200, 250, 500, 1000, 2000, 2500, 5000];
    const targetTicks = 8;
    const paddedRange = priceRange + yPad * 2;
    const tickStep =
        niceSteps.find(s => paddedRange / s <= targetTicks) ?? 5000;

    const yMin = Math.floor((globalMin - yPad) / tickStep) * tickStep;
    const yMax = Math.ceil((globalMax + yPad) / tickStep) * tickStep;
    const yRange = yMax - yMin || 1;

    /** Convert a price value to a Y pixel position */
    const priceToY = (price: number): number => {
        const normalized = (price - yMin) / yRange;
        return chartAreaY + chartAreaH - normalized * chartAreaH;
    };

    // ── Horizontal grid lines aligned to tickStep ──
    const gridLines = Math.max(1, Math.round(yRange / tickStep));
    for (let i = 0; i <= gridLines; i++) {
        const val = yMin + i * tickStep;
        const gy = priceToY(val);

        // Grid line
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.15);
        doc.line(chartAreaX, gy, chartAreaX + chartAreaW, gy);

        // Y-axis label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.textLight);
        doc.text(
            val.toLocaleString("es-CL"),
            chartAreaX - 1.5, gy + 0.8,
            { align: "right" }
        );
    }

    // ── X-axis labels + subtle vertical grid ──
    // Inset so data points don't sit flush against the Y-axis / right edge
    const xInset = chartAreaW * 0.04;
    const xPlotW = chartAreaW - xInset * 2;
    const xStep = xPlotW / (points.length - 1 || 1);

    points.forEach((pt, i) => {
        const px = chartAreaX + xInset + i * xStep;

        // Vertical grid line (very subtle)
        doc.setDrawColor(240, 242, 245);
        doc.setLineWidth(0.1);
        doc.line(px, chartAreaY, px, chartAreaY + chartAreaH);

        // X-axis label (DD-mmm)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.textLight);
        doc.text(pt.label, px, chartAreaY + chartAreaH + 3, { align: "center" });
    });

    // ── Draw lines — one per category ──
    categories.forEach((cat, catIdx) => {
        const color = chartColorFor(cat, catIdx);

        // Collect data points for this category (only where it has data)
        const catPoints: { x: number; y: number; price: number }[] = [];
        points.forEach((pt, i) => {
            const price = pt.categoryPrices[cat];
            if (price && price > 0) {
                catPoints.push({
                    x: chartAreaX + xInset + i * xStep,
                    y: priceToY(price),
                    price,
                });
            }
        });

        if (catPoints.length < 2) return; // need at least 2 points for a line

        // Draw connecting lines
        doc.setDrawColor(...color);
        doc.setLineWidth(0.5);
        for (let i = 0; i < catPoints.length - 1; i++) {
            doc.line(
                catPoints[i].x, catPoints[i].y,
                catPoints[i + 1].x, catPoints[i + 1].y
            );
        }

        // Draw data point markers
        catPoints.forEach(p => {
            // White halo
            doc.setFillColor(...COLORS.white);
            doc.circle(p.x, p.y, 1.0, "F");
            // Colored dot
            doc.setFillColor(...color);
            doc.circle(p.x, p.y, 0.6, "F");
        });
    });

    // ── Vertical legend on the right ──
    renderChartLegend(doc, categories, chartAreaX + chartAreaW + 3, chartAreaY, chartAreaH);

    return y + totalH;
}

/**
 * Render a vertical legend on the right side of the chart plot area.
 * Each entry: color swatch line + dot + species short name.
 */
function renderChartLegend(
    doc: jsPDF,
    categories: string[],
    xLeft: number,
    yTop: number,
    plotH: number
): void {
    const rowH = HEIGHTS.chartLegendRowH;
    const totalRows = categories.length;
    const totalH = totalRows * rowH;
    // Center the legend vertically against the plot area
    const startY = yTop + Math.max(0, (plotH - totalH) / 2) + rowH / 2;

    categories.forEach((cat, idx) => {
        const color = chartColorFor(cat, idx);
        const ly = startY + idx * rowH;

        // Color swatch — small line segment
        doc.setDrawColor(...color);
        doc.setLineWidth(0.8);
        doc.line(xLeft, ly, xLeft + 5, ly);

        // Dot on the line
        doc.setFillColor(...color);
        doc.circle(xLeft + 2.5, ly, 0.9, "F");

        // Category name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.text);
        doc.text(getSpeciesName(cat), xLeft + 7, ly + 1);
    });
}

// ═══════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════

/**
 * Generate and download a PDF report for an auction.
 * The page height adapts dynamically to fit all content.
 */
export function downloadAuctionPDF(params: {
    auction: Auction;
    recintoName: string;
    fecha: string;
    allAuctions?: Auction[];
}): void {
    const { auction, recintoName, fecha, allAuctions } = params;

    // ─── Build species groups first (needed for chart category whitelist) ───
    const speciesMap = new Map<string, Lot[]>();
    auction.lots.forEach(lot => {
        if (lot.vendedor === "__SUMMARY__") return;
        const key = lot.tipoLote.toUpperCase();
        if (!speciesMap.has(key)) speciesMap.set(key, []);
        speciesMap.get(key)!.push(lot);
    });

    const speciesKeys = sortSpecies(Array.from(speciesMap.keys()));

    // Filter chart data to the emitting sucursal only
    const recintoKey = recintoName.toUpperCase().trim();
    const scopedAuctions = (allAuctions || [auction]).filter(
        a => a.recinto.toUpperCase().trim() === recintoKey
    );

    // Reference date = latest auction for this sucursal (fecha may be a range)
    const auctionDate = scopedAuctions.length > 0
        ? scopedAuctions.reduce((m, a) => {
            const d = parseDate(a.fecha);
            return d > m ? d : m;
        }, new Date(0))
        : parseDate(fecha);

    // Chart categories per recinto (defined by business rules)
    const CHART_CATEGORIES_BY_RECINTO: Record<string, string[]> = {
        TEMUCO: ["NOVILLOS GORDOS", "VAQUILLAS GORDAS", "VACAS GORDAS"],
        FREIRE: ["NOVILLOS ENGORDA", "VAQUILLAS ENGORDA", "TERNEROS", "TERNERAS"],
        VICTORIA: ["NOVILLOS ENGORDA", "VAQUILLAS ENGORDA", "TERNEROS", "TERNERAS"],
    };
    const PREFERRED_CHART_CATEGORIES = CHART_CATEGORIES_BY_RECINTO[recintoKey]
        ?? ["NOVILLOS ENGORDA", "VAQUILLAS ENGORDA", "TERNEROS", "TERNERAS"];

    const trendData = calculateCategoryTrendData(
        scopedAuctions.length > 0 ? scopedAuctions : [auction],
        auctionDate,
        PREFERRED_CHART_CATEGORIES
    );
    const hasChartData = trendData.points.length >= 2 && trendData.categories.length > 0;

    // ─── Build species groups from pre-computed map ───
    const groups: SpeciesGroup[] = speciesKeys.map(sp => {
        const lots = (speciesMap.get(sp) || []).sort((a, b) => b.precio - a.precio);
        const summary = (auction.summaries || []).find(s => s.descripcion.toUpperCase() === sp.toUpperCase());
        const totalCabezas = summary?.cantidadtotal ?? lots.reduce((a, l) => a + l.cantidad, 0);
        const totalPeso = summary?.pesototal ?? lots.reduce((a, l) => a + l.peso, 0);
        const totalValue = lots.reduce((a, l) => a + l.peso * l.precio, 0);
        const totalW = lots.reduce((a, l) => a + l.peso, 0);
        const avgPrice = summary?.pptotal ?? (totalW > 0 ? totalValue / totalW : 0);
        const topPrice = lots.length > 0 ? lots[0].precio : 0;

        // PP (Primeros Precios): top 13 for gordos only in TEMUCO, top 5 everywhere else
        const ppN = recintoKey === "TEMUCO" && TOP_13_CATEGORIES.includes(sp) ? 13 : 5;
        const topNLots = lots.slice(0, ppN);
        const ppCabezas = topNLots.reduce((a, l) => a + l.cantidad, 0);
        const ppPeso = topNLots.reduce((a, l) => a + l.peso, 0);
        const ppTotalValue = topNLots.reduce((a, l) => a + l.peso * l.precio, 0);
        const ppAvgPrice = ppPeso > 0 ? ppTotalValue / ppPeso : 0;

        return { name: sp, shortName: getSpeciesName(sp), lots, summary, totalCabezas, totalPeso, avgPrice, topPrice, ppN, ppCabezas, ppPeso, ppAvgPrice };
    }).filter(g => g.totalCabezas > 0);

    // Global stats
    const totalAnimales = auction.totalAnimales || groups.reduce((a, g) => a + g.totalCabezas, 0);

    // ─── Create PDF in US Letter format ───
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
    });

    // ─── Build grid cells (merges Vacas Carnaza + Caballares into a stacked cell) ───
    const cells = buildGridCells(groups);
    const rowLayouts = buildRowLayouts(cells);
    const rowCount = rowLayouts.length;

    const chartH = hasChartData ? measureChartSectionHeight(trendData.categories.length) + SPACING.beforeChart : 0;
    const infoBandH = 13;
    const infoBandGap = 2;

    // Fixed overhead (no more resumen+glossary section, no section title, no footer)
    const fixedOverhead =
        HEIGHTS.header + SPACING.afterHeader +
        rowCount * SPACING.cardRowGap +
        infoBandH + infoBandGap +
        chartH;

    // Solve for a uniform rowH that fits all rows on one page.
    // Each row's max-height cell determines that row's height; we want:
    //   sum_over_rows( max_cell_in_row( lotLines * rowH + extraChrome ) ) ≤ available
    // Iterate a few times since the winning cell may change with rowH.
    const available = PAGE.height - fixedOverhead;
    const naturalRowH: number = HEIGHTS.cardRow;
    const hardMinRowH = 2.2;
    let cardRowH: number = naturalRowH;
    for (let iter = 0; iter < 6; iter++) {
        // For this rowH, compute the total used. If it fits, we're done.
        let used = 0;
        for (let ri = 0; ri < rowLayouts.length; ri++) {
            const cap = maxLotsForRow(rowLayouts[ri]);
            used += Math.max(...rowLayouts[ri].map(c => cellHeight(c, cardRowH, cap)));
        }
        if (used <= available) break;
        // Scale down proportionally by the lot-line contribution.
        // Compute sum of max-cell lotLines per row (approx — re-tested next iter).
        let lotContribution = 0;
        let chromeContribution = 0;
        for (let ri = 0; ri < rowLayouts.length; ri++) {
            const cap = maxLotsForRow(rowLayouts[ri]);
            const row = rowLayouts[ri];
            // find the winning cell at current rowH, then use its breakdown
            let winner = row[0];
            let winnerH = cellHeight(winner, cardRowH, cap);
            for (const c of row) {
                const h = cellHeight(c, cardRowH, cap);
                if (h > winnerH) { winner = c; winnerH = h; }
            }
            lotContribution += cellLotLines(winner, cap);
            chromeContribution += cellExtraChrome(winner);
        }
        if (lotContribution <= 0) break;
        const target = available - chromeContribution;
        cardRowH = Math.max(hardMinRowH, target / lotContribution);
        if (cardRowH >= naturalRowH) { cardRowH = naturalRowH; break; }
    }
    cardRowH = Math.max(hardMinRowH, Math.min(naturalRowH, cardRowH));

    // ════════════════════════════════════════════
    // RENDER PIPELINE — each function returns cursorY
    // ════════════════════════════════════════════

    let cursorY = 0;

    // 1. Header
    cursorY = renderHeader(doc, recintoName, fecha);

    // 2. Category cards grid
    cursorY = renderCategoryGrid(doc, rowLayouts, cursorY, cardRowH);

    // 3. Info band: Sr. Cliente legend + totals
    cursorY += infoBandGap;
    cursorY = renderInfoBand(doc, cursorY, totalAnimales, auction.totalVista);

    // 4. Price trend chart (multi-category)
    if (hasChartData) {
        cursorY += SPACING.beforeChart;
        cursorY = renderPriceTrendChart(doc, trendData, cursorY);
    }

    // ─── Save ───
    const fechaClean = fecha.replace(/\//g, "-");
    doc.save(`Informe_${recintoName}_${fechaClean}.pdf`);
}
