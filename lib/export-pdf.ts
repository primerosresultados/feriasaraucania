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

interface SpeciesGroup {
    name: string;
    shortName: string;
    lots: Lot[];
    summary?: TipoLoteSummary;
    totalCabezas: number;
    totalPeso: number;
    avgPrice: number;
    topPrice: number;
}

/** Helper: draw a rounded rectangle */
function roundRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: [number, number, number], stroke?: [number, number, number]) {
    doc.setFillColor(...fill);
    if (stroke) {
        doc.setDrawColor(...stroke);
        doc.setLineWidth(0.3);
    }
    doc.roundedRect(x, y, w, h, r, r, stroke ? "FD" : "F");
}

/** Helper: add new page with header */
function addNewPage(doc: jsPDF, pw: number, recintoName: string, fecha: string) {
    doc.addPage();
    
    const headerH = 20;
    doc.setFillColor(4, 20, 26);
    doc.rect(0, 0, pw, headerH, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`${recintoName.toUpperCase()}  |  ${formatDateLong(fecha).toUpperCase()}`, pw / 2, 6, { align: "center" });
    
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, headerH - 1, pw, 1, "F");
    
    return headerH + 5;
}

/** Compute the weighted average of the first N lots (sorted by price desc) */
function topNWeightedAvg(lots: Lot[], n: number): number {
    const topN = lots.slice(0, n);
    const totalW = topN.reduce((a, l) => a + l.peso, 0);
    const totalV = topN.reduce((a, l) => a + l.peso * l.precio, 0);
    return totalW > 0 ? totalV / totalW : 0;
}

/**
 * Data for trend chart (last 12 months)
 */
interface TrendData {
    month: string;    // e.g., "Ene 2024"
    avgPrice: number;
    totalHeads: number;
}

/**
 * Calculate trend data from all auctions for the last 12 months
 */
function calculateTrendData(auctions: Auction[]): TrendData[] {
    const months = [
        "Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];
    const now = new Date();
    const result: TrendData[] = [];

    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthIdx = d.getMonth();
        const year = d.getFullYear();
        const monthLabel = `${months[monthIdx]} ${year.toString().slice(-2)}`;

        // Find auctions in this month
        const monthAuctions = auctions.filter(a => {
            const fechaDate = parseDate(a.fecha);
            return fechaDate.getMonth() === monthIdx && fechaDate.getFullYear() === year;
        });

        // Calculate weighted average price
        let totalPeso = 0;
        let totalValue = 0;
        let totalHeads = 0;

        monthAuctions.forEach(a => {
            a.lots.forEach(lot => {
                if (lot.vendedor === "__SUMMARY__") return;
                totalPeso += lot.peso;
                totalValue += lot.peso * lot.precio;
                totalHeads += lot.cantidad;
            });
        });

        const avgPrice = totalPeso > 0 ? Math.round(totalValue / totalPeso) : 0;
        result.push({ month: monthLabel, avgPrice, totalHeads });
    }

    return result;
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

/**
 * Single-page PDF report — page height adapts to content
 */
export function downloadAuctionPDF(params: {
    auction: Auction;
    recintoName: string;
    fecha: string;
    allAuctions?: Auction[];
}): void {
    console.log('downloadAuctionPDF called', params);
    const { auction, recintoName, fecha, allAuctions } = params;

    // Calculate trend data from all auctions (last 12 months)
    const trendData = calculateTrendData(allAuctions || [auction]);

    // ─── Build species groups ───
    const speciesMap = new Map<string, Lot[]>();
    auction.lots.forEach(lot => {
        if (lot.vendedor === "__SUMMARY__") return;
        const key = lot.tipoLote.toUpperCase();
        if (!speciesMap.has(key)) speciesMap.set(key, []);
        speciesMap.get(key)!.push(lot);
    });

    const speciesKeys = sortSpecies(Array.from(speciesMap.keys()));
    const groups: SpeciesGroup[] = speciesKeys.map(sp => {
        const lots = (speciesMap.get(sp) || []).sort((a, b) => b.precio - a.precio);
        const summary = (auction.summaries || []).find(s => s.descripcion.toUpperCase() === sp.toUpperCase());
        const totalCabezas = summary?.cantidadtotal ?? lots.reduce((a, l) => a + l.cantidad, 0);
        const totalPeso = summary?.pesototal ?? lots.reduce((a, l) => a + l.peso, 0);
        const totalValue = lots.reduce((a, l) => a + l.peso * l.precio, 0);
        const totalW = lots.reduce((a, l) => a + l.peso, 0);
        const avgPrice = summary?.pptotal ?? (totalW > 0 ? totalValue / totalW : 0);
        const topPrice = lots.length > 0 ? lots[0].precio : 0;
        return { name: sp, shortName: getSpeciesName(sp), lots, summary, totalCabezas, totalPeso, avgPrice, topPrice };
    }).filter(g => g.totalCabezas > 0);

    // Global stats
    const totalAnimales = auction.totalAnimales || groups.reduce((a, g) => a + g.totalCabezas, 0);
    const totalKilos = auction.totalKilos || groups.reduce((a, g) => a + g.totalPeso, 0);
    const totalVista = auction.totalVista ?? 0;
    // "Transados por kilo" = total - vista
    const transadosPorKilo = totalAnimales - totalVista;

    // ─── Layout constants ───
    const pw = 210;
    const ml = 10, mr = 10;
    const uw = pw - ml - mr;
    const headerH = 26;
    const resumenH = 20;
    const sectionTitleH = 8;
    const footerH = 12;
    const gapAfterHeader = 1;
    const gapAfterResumen = 3;
    const gapBeforeFooter = 2;
    const lineH = 3.5;

    // Detail section layout
    const colCount = 4;
    const colGap = 2;
    const colW = (uw - colGap * (colCount - 1)) / colCount;

    // Per column overhead
    const colTitleH = 6;
    const colSubHeaderH = 4.5;
    const colFooterH = 4;
    const rowGap = 4;
    const colPadding = 2; // internal padding

    // Helper: compute height for a single group
    function groupHeight(g: SpeciesGroup): number {
        return colTitleH + colSubHeaderH + g.lots.length * lineH + colFooterH + colPadding;
    }

    // ─── Pre-calculate total page height ───
    let detailsH = 0;
    for (let i = 0; i < groups.length; i += colCount) {
        const rowGroups = groups.slice(i, i + colCount);
        const maxH = Math.max(...rowGroups.map(g => groupHeight(g)));
        detailsH += maxH + rowGap;
    }

    const totalPageH = headerH + gapAfterHeader + resumenH + gapAfterResumen
        + sectionTitleH + detailsH + gapBeforeFooter + footerH;

    // ─── Create PDF with exact page height ───
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pw, totalPageH],
    });
    let y = 0;

    // ════════════════════════════════════════════
    // HEADER BAR with Logo (centered)
    // ════════════════════════════════════════════
    doc.setFillColor(4, 20, 26);
    doc.rect(0, 0, pw, headerH, "F");

    const logoH = 10;
    const logoW = logoH * (1024 / 346);
    const logoX = (pw - logoW) / 2;
    const logoY = 2;
    try {
        doc.addImage(LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH);
    } catch (e) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.white);
        doc.text("GRUPO ARAUCANÍA", pw / 2, 5, { align: "center" });
    }

    const city = recintoName.toUpperCase();
    const dateText = formatDateLong(fecha).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`${city}  |  ${dateText}`, pw / 2, logoY + logoH + 4, { align: "center" });

    doc.setFillColor(...COLORS.accent);
    doc.rect(0, headerH - 1, pw, 1, "F");

    y = headerH + gapAfterHeader;

    // ════════════════════════════════════════════
    // RESUMEN TOTALES + GLOSSARY (side by side)
    // ════════════════════════════════════════════
    const resumenW = uw * 0.35;
    const glossaryW = uw - resumenW - 3;

    // --- Left: Resumen Totales ---
    roundRect(doc, ml, y, resumenW, resumenH, 2, COLORS.white, COLORS.border);

    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y, resumenW, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen Totales", ml + 5, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Animales Transados", ml + 5, y + 15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.accent);
    doc.text(totalAnimales.toLocaleString("es-CL"), ml + resumenW - 5, y + 15, { align: "right" });

    // --- Right: Glossary ---
    const glossaryX = ml + resumenW + 3;
    roundRect(doc, glossaryX, y, glossaryW, resumenH, 2, COLORS.bgLight, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primaryLight);
    doc.text("Glosario", glossaryX + 5, y + 7);

    const glossaryItems = [
        { key: "Cantidad:", desc: "Número de animales en el lote" },
        { key: "Peso:", desc: "Peso en Kg de todo el lote" },
        { key: "Precio:", desc: "Precio por kilo al que se transó el lote" },
        { key: "PP:", desc: "Totales de los primeros precios" },
        { key: "Gral:", desc: "Totales de todos los animales transados" },
    ];

    glossaryItems.forEach((item, i) => {
        const gy = y + 11 + i * 2.4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.primary);
        doc.text(item.key, glossaryX + 5, gy);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(item.desc, glossaryX + 22, gy);
    });

    y += resumenH + gapAfterResumen;

    // ════════════════════════════════════════════
    // SECTION TITLE
    // ════════════════════════════════════════════
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text("DETALLE POR CATEGORÍAS", ml, y + 4);
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y + 5.5, 45, 0.8, "F");
    y += sectionTitleH;

    // ════════════════════════════════════════════
    // DETAILED LOTS — 4-column layout, individual heights
    // ════════════════════════════════════════════
    for (let i = 0; i < groups.length; i += colCount) {
        const rowGroups = groups.slice(i, i + colCount);
        const maxH = Math.max(...rowGroups.map(g => groupHeight(g)));

        rowGroups.forEach((g, ci) => {
            const cx = ml + ci * (colW + colGap);
            const thisH = groupHeight(g);

            // Draw container with this group's actual height
            roundRect(doc, cx, y, colW, thisH, 1.5, COLORS.white, COLORS.border);

            // Render content
            renderDetailColumn(doc, g, cx, y, colW);
        });

        y += maxH + rowGap;
    }

    // ════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════
    y += gapBeforeFooter;

    doc.setFillColor(...COLORS.bgCard);
    doc.rect(0, y, pw, footerH, "F");
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, y, pw, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.text("www.feriasaraucania.cl", ml, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text(`Total: ${totalAnimales.toLocaleString("es-CL")} cabezas`, pw - mr, y + 7, { align: "right" });

    // ─── Save ───
    const fechaClean = fecha.replace(/\//g, "-");
    doc.save(`Informe_${recintoName}_${fechaClean}.pdf`);
}


/**
 * Renders a single species group as a compact, styled column.
 */
function renderDetailColumn(
    doc: jsPDF,
    group: SpeciesGroup,
    x: number,
    y: number,
    width: number
): void {
    // Column header with color accent
    roundRect(doc, x, y, width, 6, 1, COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.white);
    doc.text(group.shortName, x + width / 2, y + 4, { align: "center" });

    // Sub-column header
    const subY = y + 6.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.5);
    doc.setTextColor(...COLORS.textLight);

    const sw = [width * 0.12, width * 0.26, width * 0.32, width * 0.30];
    doc.text("Cant", x + sw[0] / 2, subY + 2, { align: "center" });
    doc.text("Peso", x + sw[0] + sw[1] / 2, subY + 2, { align: "center" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] / 2, subY + 2, { align: "center" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] / 2, subY + 2, { align: "center" });

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    doc.line(x, subY + 2.8, x + width, subY + 2.8);

    let rowY = subY + 4.5;
    const lineH = 3.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.text);

    group.lots.forEach((lot, idx) => {
        if (idx % 2 === 1) {
            doc.setFillColor(...COLORS.bgLight);
            doc.rect(x, rowY - 1.8, width, lineH, "F");
        }

        let sx = x;
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        doc.text(lot.cantidad.toString(), sx + sw[0] - 0.5, rowY, { align: "right" });
        sx += sw[0];

        doc.text(Math.round(lot.peso).toLocaleString("es-CL"), sx + sw[1] - 1, rowY, { align: "right" });
        sx += sw[1];

        doc.setFont("helvetica", "bold");
        doc.text(Math.round(lot.precio).toLocaleString("es-CL"), sx + sw[2] - 1, rowY, { align: "right" });
        sx += sw[2];

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(4.5);
        doc.text(getInitials(lot.vendedor), sx + 1.5, rowY);

        rowY += lineH;
    });

    // Footer: subtotals
    if (group.lots.length > 0) {
        doc.setDrawColor(...COLORS.accent);
        doc.setLineWidth(0.3);
        doc.line(x, rowY - 0.5, x + width, rowY - 0.5);
        rowY += 1.5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(...COLORS.primary);

        let sx = x;
        doc.text(group.totalCabezas.toString(), sx + sw[0] - 0.5, rowY, { align: "right" });
        sx += sw[0];
        doc.text(Math.round(group.totalPeso).toLocaleString("es-CL"), sx + sw[1] - 1, rowY, { align: "right" });
        sx += sw[1];
        doc.setTextColor(...COLORS.accent);
        doc.text(Math.round(group.avgPrice).toLocaleString("es-CL"), sx + sw[2] - 1, rowY, { align: "right" });
        sx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(4.5);
        doc.text("PR.GRAL.", sx + 2, rowY);
    }
}

