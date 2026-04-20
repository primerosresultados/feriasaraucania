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
    cardFooter: 4.8,       // subtotals row inside a card
    cardPadBottom: 1.0,    // padding below footer inside card
    cardRow: 4,            // line height per lot row
    chartBase: 28,         // chart plot area base height (without legend)
    chartLegendRowH: 3.5,  // height per row in chart legend grid
    chartTitleH: 5,        // chart title area
    chartAxisLabelW: 14,   // left Y-axis label space
    chartBottomLabelH: 6,  // X-axis label area
    chartPadTop: 2,        // top padding inside chart
    chartPadRight: 4,      // right padding inside chart
    newPageHeader: 22,     // smaller header on continuation pages
} as const;

/** Card grid layout */
const CARD_GRID = {
    columns: 4,
    gap: 2,               // horizontal gap between cards
    get cardWidth() { return (PAGE.usable - this.gap * (this.columns - 1)) / this.columns; },
} as const;

/** Column width ratios inside a category card */
const CARD_COL_RATIOS = [0.12, 0.26, 0.32, 0.30] as const;

/** Logo dimensions */
const LOGO = {
    height: 7,
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
    accent: [234, 179, 8] as [number, number, number],         // Yellow/gold
    accentLight: [254, 243, 199] as [number, number, number],  // Light yellow bg
    warmOrange: [249, 115, 22] as [number, number, number],    // Orange highlight
    text: [30, 41, 59] as [number, number, number],            // Slate-800
    textLight: [100, 116, 139] as [number, number, number],    // Slate-500
    textMuted: [148, 163, 184] as [number, number, number],    // Slate-400
    border: [226, 232, 240] as [number, number, number],       // Slate-200
    bgLight: [248, 250, 252] as [number, number, number],      // Slate-50
    bgCard: [241, 245, 249] as [number, number, number],       // Slate-100
    white: [255, 255, 255] as [number, number, number],
    gold: [234, 179, 8] as [number, number, number],           // Amber/gold
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

/** Categories that use top 13 for average (gordos) */
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
    const sep = fecha.includes("/") ? "/" : "-";
    const parts = fecha.split(sep);
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return `${day} de ${months[month]} ${year}`;
    }
    return fecha;
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
function measureCategoryCardHeight(group: SpeciesGroup, rowH: number = HEIGHTS.cardRow): number {
    return (
        HEIGHTS.cardTitle +
        HEIGHTS.cardSubHeader +
        group.lots.length * rowH +
        HEIGHTS.cardFooter * 2 +  // PP row + PR.GRAL row
        HEIGHTS.cardPadBottom
    );
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

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Build per-category price trend data using a rolling year (año móvil).
 * Groups auctions by month and computes weighted average price for each
 * cattle category per month.
 *
 * The rolling year goes from the same month last year up to (and including)
 * the current auction month. For example, if the auction date is March 2026,
 * the chart shows Apr 2025 → Mar 2026.
 *
 * @param auctions  All available auctions to pull historical data from.
 * @param referenceDate  The date of the current auction (determines the
 *                       rolling year window).
 * @param allowedCategories  If provided, only these categories (uppercase)
 *                           will be included in the chart. This ensures
 *                           the chart matches the categories shown in the
 *                           PDF tables.
 */
function calculateCategoryTrendData(
    auctions: Auction[],
    referenceDate?: Date,
    allowedCategories?: string[]
): CategoryTrendData {
    if (!auctions.length) return { points: [], categories: [] };

    // Determine the rolling year window
    const refDate = referenceDate || parseDate(auctions[auctions.length - 1].fecha);
    const endYear = refDate.getFullYear();
    const endMonth = refDate.getMonth(); // 0-indexed

    // Start: same month, previous year + 1 month (so we get 12 months total)
    // e.g. ref = Mar 2026 → start = Apr 2025  (12 months: Apr..Mar)
    const startDate = new Date(endYear - 1, endMonth + 1, 1);
    const endDate = new Date(endYear, endMonth + 1, 0, 23, 59, 59); // last day of ref month

    // Allowed categories set for filtering
    const allowedSet = allowedCategories
        ? new Set(allowedCategories.map(c => c.toUpperCase()))
        : null;

    // Group by month → per-species accumulators
    const monthMap = new Map<string, {
        label: string;
        sortKey: number;
        species: Map<string, { totalWeight: number; totalValue: number }>;
    }>();

    auctions.forEach(a => {
        const d = parseDate(a.fecha);
        // Filter auctions outside the rolling year window
        if (d < startDate || d > endDate) return;

        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
            const label = `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
            monthMap.set(monthKey, {
                label,
                sortKey: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
                species: new Map(),
            });
        }
        const entry = monthMap.get(monthKey)!;

        a.lots.forEach(lot => {
            if (lot.vendedor === "__SUMMARY__") return;
            const sp = lot.tipoLote.toUpperCase();
            // Skip categories not in the allowed list
            if (allowedSet && !allowedSet.has(sp)) return;
            if (!entry.species.has(sp)) {
                entry.species.set(sp, { totalWeight: 0, totalValue: 0 });
            }
            const acc = entry.species.get(sp)!;
            acc.totalWeight += lot.peso;
            acc.totalValue += lot.peso * lot.precio;
        });
    });

    // Sort by month chronologically
    const sorted = Array.from(monthMap.entries())
        .sort((a, b) => a[1].sortKey - b[1].sortKey);

    // Collect all categories that appear in the data
    const allCategories = new Set<string>();
    sorted.forEach(([, entry]) => {
        entry.species.forEach((_, sp) => allCategories.add(sp));
    });
    const categories = sortSpecies(Array.from(allCategories));

    // Build points
    const points: CategoryTrendPoint[] = sorted.map(([, entry]) => {
        const categoryPrices: Record<string, number> = {};
        entry.species.forEach((acc, sp) => {
            if (acc.totalWeight > 0) {
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
function measureChartSectionHeight(categoryCount: number): number {
    const legendCols = 4;
    const legendRows = Math.ceil(categoryCount / legendCols);
    const legendH = legendRows * HEIGHTS.chartLegendRowH + 4; // +4 for padding
    return (
        HEIGHTS.chartTitleH +
        HEIGHTS.chartPadTop +
        HEIGHTS.chartBase +
        HEIGHTS.chartBottomLabelH +
        legendH
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

    // Dark background
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pw, h, "F");

    // Logo — vertically centered in the top portion
    const logoAreaTop = 0;
    const logoAreaBottom = h - HEIGHTS.headerAccentBar;
    const logoAreaH = logoAreaBottom - logoAreaTop;
    // We split the area: logo takes top ~60%, text takes bottom ~40%
    const textBlockH = 4; // approximate height of the city|date text line
    const combinedH = LOGO.height + 1.5 + textBlockH; // logo + gap + text
    const blockStartY = logoAreaTop + (logoAreaH - combinedH) / 2;

    const logoX = (pw - LOGO.width) / 2;
    const logoY = blockStartY;
    try {
        doc.addImage(LOGO_BASE64, "PNG", logoX, logoY, LOGO.width, LOGO.height);
    } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.white);
        doc.text("GRUPO ARAUCANÍA", pw / 2, logoY + LOGO.height / 2, { align: "center" });
    }

    // City | Date text
    const city = recintoName.toUpperCase();
    const dateText = formatDateLong(fecha).toUpperCase();
    const textY = logoY + LOGO.height + 1.5 + textBlockH / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${city}  |  ${dateText}`, pw / 2, textY, { align: "center" });

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
    rowH: number = HEIGHTS.cardRow
): void {
    const sw = CARD_COL_RATIOS.map(r => width * r);

    // Outer card container (uses forcedHeight for uniform row height)
    roundRect(doc, x, y, width, forcedHeight, RADIUS.card, COLORS.white, COLORS.border);

    // ── Title bar (dark) ──
    roundRect(doc, x, y, width, HEIGHTS.cardTitle, 1, COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(group.shortName, x + width / 2, y + 4.7, { align: "center" });

    // ── Sub-header (column labels) ──
    const subY = y + HEIGHTS.cardTitle + 0.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.textLight);

    doc.text("Cant", x + sw[0] / 2, subY + 2.5, { align: "center" });
    doc.text("Peso Kg", x + sw[0] + sw[1] / 2, subY + 2.5, { align: "center" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] / 2, subY + 2.5, { align: "center" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] - 0.5, subY + 2.5, { align: "right" });

    // Separator line below sub-header
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    const sepLineY = subY + 3.5;
    doc.line(x, sepLineY, x + width, sepLineY);

    // ── Lot rows ──
    let rowY = sepLineY + 2;
    const lineH = rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.text);

    group.lots.forEach((lot, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
            doc.setFillColor(...COLORS.bgLight);
            doc.rect(x, rowY - 1.8, width, lineH, "F");
        }

        let sx = x;
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text(lot.cantidad.toString(), sx + sw[0] - 0.5, rowY, { align: "right" });
        sx += sw[0];

        doc.text(Math.round(lot.peso).toLocaleString("es-CL"), sx + sw[1] - 1, rowY, { align: "right" });
        sx += sw[1];

        doc.setFont("helvetica", "bold");
        doc.text(Math.round(lot.precio).toLocaleString("es-CL"), sx + sw[2] - 1, rowY, { align: "right" });
        sx += sw[2];

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(5);
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.primary);

        let ppSx = x;
        doc.text(group.ppCabezas.toString(), ppSx + sw[0] - 0.5, ppTextY, { align: "right" });
        ppSx += sw[0];
        doc.text(Math.round(group.ppPeso).toLocaleString("es-CL"), ppSx + sw[1] - 1, ppTextY, { align: "right" });
        ppSx += sw[1];
        doc.setTextColor(...COLORS.warmOrange);
        doc.text(Math.round(group.ppAvgPrice).toLocaleString("es-CL"), ppSx + sw[2] - 1, ppTextY, { align: "right" });
        ppSx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(5);
        doc.text(`PR. ${group.ppN} P.P.`, ppSx + sw[3] - 0.5, ppTextY, { align: "right" });

        // ── PR.GRAL row (totals) ──
        // Subtle separator between PP and GRAL
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.15);
        doc.line(x, gralY, x + width, gralY);

        const gralTextY = gralY + 3.5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.primary);

        let sx = x;
        doc.text(group.totalCabezas.toString(), sx + sw[0] - 0.5, gralTextY, { align: "right" });
        sx += sw[0];
        doc.text(Math.round(group.totalPeso).toLocaleString("es-CL"), sx + sw[1] - 1, gralTextY, { align: "right" });
        sx += sw[1];
        doc.setTextColor(...COLORS.accent);
        doc.text(Math.round(group.avgPrice).toLocaleString("es-CL"), sx + sw[2] - 1, gralTextY, { align: "right" });
        sx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(5);
        doc.text("PR.GRAL.", sx + sw[3] - 0.5, gralTextY, { align: "right" });
    }
}

/**
 * Render all category cards in a grid layout. Within each row,
 * all cards share the same height (the maximum of that row).
 * Returns cursorY after all rows.
 */
function renderCategoryGrid(doc: jsPDF, groups: SpeciesGroup[], startY: number, rowH: number = HEIGHTS.cardRow): number {
    let y = startY;
    const ml = PAGE.marginLeft;
    const gap = CARD_GRID.gap;

    // First row: 3 columns filling full width; following rows: 4 columns.
    let idx = 0;
    let isFirstRow = true;
    while (idx < groups.length) {
        const rowCols = isFirstRow ? 3 : CARD_GRID.columns;
        const rowGroups = groups.slice(idx, idx + rowCols);
        const rowCw = (PAGE.usable - gap * (rowCols - 1)) / rowCols;

        // Measure all cards in this row
        const heights = rowGroups.map(g => measureCategoryCardHeight(g, rowH));
        const maxH = Math.max(...heights);

        // Render each card with the uniform maxH
        rowGroups.forEach((g, ci) => {
            const cx = ml + ci * (rowCw + gap);
            renderCategoryCard(doc, g, cx, y, rowCw, maxH, rowH);
        });

        y += maxH + SPACING.cardRowGap;
        idx += rowCols;
        isFirstRow = false;
    }

    return y;
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
    const chartAreaW = uw - HEIGHTS.chartAxisLabelW - HEIGHTS.chartPadRight;
    const chartAreaH = HEIGHTS.chartBase;

    // ── Background & border (full section) ──
    roundRect(doc, ml, y, uw, totalH, RADIUS.box, COLORS.white, COLORS.border);

    // ── Title ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text(
        "EVOLUCIÓN DE PRECIOS ÚLTIMOS 12 MESES",
        ml + uw / 2, y + HEIGHTS.chartTitleH / 2 + 2,
        { align: "center" }
    );

    // Accent underline
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml + uw / 2 - 30, y + HEIGHTS.chartTitleH - 0.5, 60, 0.6, "F");

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
    const yPad = priceRange * 0.12; // 12% padding
    const yMin = Math.floor((globalMin - yPad) / 100) * 100;
    const yMax = Math.ceil((globalMax + yPad) / 100) * 100;
    const yRange = yMax - yMin || 1;

    /** Convert a price value to a Y pixel position */
    const priceToY = (price: number): number => {
        const normalized = (price - yMin) / yRange;
        return chartAreaY + chartAreaH - normalized * chartAreaH;
    };

    // ── Horizontal grid lines ──
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const gy = chartAreaY + chartAreaH - (i / gridLines) * chartAreaH;

        // Grid line
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.15);
        doc.line(chartAreaX, gy, chartAreaX + chartAreaW, gy);

        // Y-axis label
        const val = yMin + (i / gridLines) * yRange;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.5);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(
            Math.round(val).toLocaleString("es-CL"),
            chartAreaX - 2, gy + 0.8,
            { align: "right" }
        );
    }

    // ── X-axis labels + subtle vertical grid ──
    const xStep = chartAreaW / (points.length - 1 || 1);

    points.forEach((pt, i) => {
        const px = chartAreaX + i * xStep;

        // Vertical grid line (very subtle)
        doc.setDrawColor(240, 242, 245);
        doc.setLineWidth(0.1);
        doc.line(px, chartAreaY, px, chartAreaY + chartAreaH);

        // X-axis label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(pt.label, px, chartAreaY + chartAreaH + 4, { align: "center" });
    });

    // ── Draw lines — one per category ──
    categories.forEach((cat, catIdx) => {
        const color = COLORS.chartColors[catIdx % COLORS.chartColors.length] as [number, number, number];

        // Collect data points for this category (only where it has data)
        const catPoints: { x: number; y: number; price: number }[] = [];
        points.forEach((pt, i) => {
            const price = pt.categoryPrices[cat];
            if (price && price > 0) {
                catPoints.push({
                    x: chartAreaX + i * xStep,
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

    // ── Legend grid below the chart ──
    renderChartLegend(doc, categories, ml, y, uw, totalH);

    return y + totalH;
}

/**
 * Render the chart legend as a clean grid of color swatches + labels.
 * Positioned at the bottom of the chart section container.
 */
function renderChartLegend(
    doc: jsPDF,
    categories: string[],
    containerX: number,
    containerY: number,
    containerW: number,
    containerH: number
): void {
    const legendCols = 4;
    const legendRows = Math.ceil(categories.length / legendCols);
    const legendTotalH = legendRows * HEIGHTS.chartLegendRowH;

    // Position legend at bottom of the container, with some padding
    const legendStartY = containerY + containerH - legendTotalH - 2;

    // Subtle separator line above legend
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.15);
    doc.line(
        containerX + 4, legendStartY - 2,
        containerX + containerW - 4, legendStartY - 2
    );

    const colW = (containerW - 8) / legendCols; // 4mm padding each side
    const startX = containerX + 4;

    categories.forEach((cat, idx) => {
        const col = idx % legendCols;
        const row = Math.floor(idx / legendCols);
        const color = COLORS.chartColors[idx % COLORS.chartColors.length] as [number, number, number];

        const lx = startX + col * colW;
        const ly = legendStartY + row * HEIGHTS.chartLegendRowH + HEIGHTS.chartLegendRowH / 2;

        // Color swatch — small line segment
        doc.setDrawColor(...color);
        doc.setLineWidth(0.8);
        doc.line(lx, ly, lx + 5, ly);

        // Dot on the line
        doc.setFillColor(...color);
        doc.circle(lx + 2.5, ly, 0.7, "F");

        // Category name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.5);
        doc.setTextColor(...COLORS.text);
        doc.text(getSpeciesName(cat), lx + 7, ly + 0.8);
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
    console.log('downloadAuctionPDF called', params);
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

    // Determine the reference date for the rolling year
    const auctionDate = parseDate(fecha);

    // Chart shows only these 4 fixed categories
    const allowedCategories = ["NOVILLOS GORDOS", "VAQUILLAS GORDAS", "VACAS GORDAS", "TERNEROS"];

    // Calculate per-category trend data using rolling year (año móvil)
    const trendData = calculateCategoryTrendData(
        allAuctions || [auction],
        auctionDate,
        allowedCategories
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

        // PP (Primeros Precios): top 13 for gordos, top 5 for all others
        const ppN = TOP_13_CATEGORIES.includes(sp) ? 13 : 5;
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

    // ─── Compute a scaled card row height so everything fits on one letter page ───
    const cols = CARD_GRID.columns;
    const glossaryH = measureGlossaryHeight(3); // two columns, max 3 rows per column
    const resumenRowH = Math.max(HEIGHTS.resumenRow, glossaryH);
    const chartH = hasChartData ? measureChartSectionHeight(trendData.categories.length) + SPACING.beforeChart : 0;

    // Row layout: first row has 3 cards, subsequent rows have 4.
    const rowLayouts: SpeciesGroup[][] = [];
    {
        let idx = 0;
        let first = true;
        while (idx < groups.length) {
            const rc = first ? 3 : cols;
            rowLayouts.push(groups.slice(idx, idx + rc));
            idx += rc;
            first = false;
        }
    }
    const rowCount = rowLayouts.length;
    const fixedOverhead =
        HEIGHTS.header + SPACING.afterHeader +
        resumenRowH + SPACING.afterResumen +
        HEIGHTS.sectionTitle + SPACING.afterSectionTitle +
        rowCount * SPACING.cardRowGap +
        chartH +
        SPACING.beforeFooter + HEIGHTS.footer;

    // Max lots across rows (each card row height = max(N) * rowH + card chrome)
    const cardChrome = HEIGHTS.cardTitle + HEIGHTS.cardSubHeader + HEIGHTS.cardFooter * 2 + HEIGHTS.cardPadBottom;
    const maxLotsSum = rowLayouts.reduce((a, rg) => a + Math.max(...rg.map(g => g.lots.length)), 0);

    const availableForCards = PAGE.height - fixedOverhead - rowCount * cardChrome;
    const naturalRowH = HEIGHTS.cardRow;
    const scaledRowH = maxLotsSum > 0
        ? Math.min(naturalRowH, availableForCards / maxLotsSum)
        : naturalRowH;
    // Hard fit: compute row height that always leaves room for the chart.
    // Cards may compress below the nominal floor rather than pushing the chart off-page.
    const hardMinRowH = 1.6; // absolute minimum to keep text legible-ish
    const cardRowH = maxLotsSum > 0
        ? Math.max(hardMinRowH, Math.min(naturalRowH, availableForCards / maxLotsSum))
        : naturalRowH;

    // ════════════════════════════════════════════
    // RENDER PIPELINE — each function returns cursorY
    // ════════════════════════════════════════════

    let cursorY = 0;

    // 1. Header
    cursorY = renderHeader(doc, recintoName, fecha);

    // 2. Resumen + Glossary
    cursorY = renderSummaryAndGlossary(doc, cursorY, totalAnimales);

    // 3. Section title
    cursorY = renderSectionTitle(doc, cursorY, "DETALLE POR CATEGORÍAS");

    // 4. Category cards grid
    cursorY = renderCategoryGrid(doc, groups, cursorY, cardRowH);

    // 5. Price trend chart (multi-category)
    if (hasChartData) {
        cursorY += SPACING.beforeChart;
        cursorY = renderPriceTrendChart(doc, trendData, cursorY);
    }

    // 6. Footer
    cursorY += SPACING.beforeFooter;
    cursorY = renderFooter(doc, cursorY, totalAnimales);

    // ─── Save ───
    const fechaClean = fecha.replace(/\//g, "-");
    doc.save(`Informe_${recintoName}_${fechaClean}.pdf`);
}
