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

/** Species short names */
const SPECIES_SHORT: Record<string, string> = {
    "NOVILLOS GORDOS": "Nov. Gordo",
    "VAQUILLAS GORDAS": "Vaq. Gorda",
    "VACAS GORDAS": "Vaca Gorda",
    "NOVILLOS ENGORDA": "Nov. Engorda",
    "VAQUILLAS ENGORDA": "Vaq. Engorda",
    "VACAS ENGORDA": "Vaca Engorda",
    "TERNEROS": "Terneros",
    "TERNERAS": "Terneras",
    "VACAS CON CRIAS": "Vaca c/cría",
    "TOROS": "Toros",
    "BUEYES": "Bueyes",
    "VACAS CARNAZA": "V. Carnaza",
    "CABALLARES": "Caballares",
};

/** Categories that use top 13 for average (gordos) */
const TOP_13_CATEGORIES = ["NOVILLOS GORDOS", "VACAS GORDAS", "VAQUILLAS GORDAS"];

function getShortName(sp: string): string {
    return SPECIES_SHORT[sp.toUpperCase()] || sp;
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
 * Modernized PDF report — clean, visual, with charts
 */
export function downloadAuctionPDF(params: {
    auction: Auction;
    recintoName: string;
    fecha: string;
    trendData?: TrendData[];
}): void {
    console.log('downloadAuctionPDF called', params);
    const { auction, recintoName, fecha, trendData } = params;

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
        return { name: sp, shortName: getShortName(sp), lots, summary, totalCabezas, totalPeso, avgPrice, topPrice };
    }).filter(g => g.totalCabezas > 0);

    // Global stats
    const totalAnimales = auction.totalAnimales || groups.reduce((a, g) => a + g.totalCabezas, 0);
    const totalKilos = auction.totalKilos || groups.reduce((a, g) => a + g.totalPeso, 0);
    const totalVista = auction.totalVista ?? 0;
    // "Transados por kilo" = total - vista
    const transadosPorKilo = totalAnimales - totalVista;

    // ─── Create PDF ───
    const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
    const pw = 210;
    const ml = 10, mr = 10;
    const uw = pw - ml - mr;
    let y = 0;

    // ════════════════════════════════════════════
    // HEADER BAR with Logo (centered)
    // ════════════════════════════════════════════
    const headerH = 32;
    // Background: #04141A
    doc.setFillColor(4, 20, 26);
    doc.rect(0, 0, pw, headerH, "F");

    // Logo (centered at top)
    const logoH = 12;
    const logoW = logoH * (1024 / 346);
    const logoX = (pw - logoW) / 2;
    const logoY = 2;
    try {
        doc.addImage(LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH);
    } catch (e) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.white);
        doc.text("GRUPO ARAUCANÍA", pw / 2, 6, { align: "center" });
    }

    // City and Date on same line in header (white, uppercase, bold)
    const city = recintoName.toUpperCase();
    const dateText = formatDateLong(fecha).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`${city}  |  ${dateText}`, pw / 2, logoY + logoH + 6, { align: "center" });

    // Decorative accent strip at bottom
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, headerH - 1, pw, 1, "F");

    y = headerH + 2;

    // ════════════════════════════════════════════
    // RESUMEN TOTALES + GLOSSARY (side by side)
    // ════════════════════════════════════════════
    const resumenH = 36;
    const resumenW = uw * 0.45;
    const glossaryW = uw - resumenW - 3;

    // --- Left: Resumen Totales ---
    roundRect(doc, ml, y, resumenW, resumenH, 2, COLORS.white, COLORS.border);

    // Accent top bar
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y, resumenW, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen Totales", ml + 6, y + 10);

    // Three stat rows
    const statsStartY = y + 17;
    const statRows = [
        { label: "Animales Ingresados a Remate", value: totalAnimales.toLocaleString("es-CL") },
        { label: "Animales Transados por Kilo", value: transadosPorKilo.toLocaleString("es-CL") },
        { label: "Animales Transados a la Vista", value: totalVista.toLocaleString("es-CL") },
    ];

    statRows.forEach((row, i) => {
        const ry = statsStartY + i * 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.text);
        doc.text(row.label, ml + 6, ry);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.accent);
        doc.text(row.value, ml + resumenW - 5, ry, { align: "right" });
    });

    // --- Right: Glossary ---
    const glossaryX = ml + resumenW + 3;
    roundRect(doc, glossaryX, y, glossaryW, resumenH, 2, COLORS.bgLight, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primaryLight);
    doc.text("Glosario", glossaryX + 6, y + 9);

    const glossaryItems = [
        { key: "Cantidad:", desc: "Número de animales en el lote" },
        { key: "Peso:", desc: "Peso en Kg de todo el lote" },
        { key: "Precio:", desc: "Precio por kilo al que se transó el lote" },
        { key: "PP:", desc: "Totales de los primeros precios" },
        { key: "Gral:", desc: "Totales de todos los animales transados" },
    ];

    glossaryItems.forEach((item, i) => {
        const gy = y + 15 + i * 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.primary);
        doc.text(item.key, glossaryX + 6, gy);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(item.desc, glossaryX + 26, gy);
    });

    y += resumenH + 4;

    // ════════════════════════════════════════════
    // DETAILED LOTS — Grouped in 3-column layout
    // ════════════════════════════════════════════
    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.primary);
    doc.text("Detalle de Lotes por Categoría", ml, y + 5);
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y + 7, 55, 1, "F");
    y += 12;

    // 3-column detail layout
    const colCount = 3;
    const colGap = 3;
    const colW = (uw - colGap * (colCount - 1)) / colCount;

    for (let i = 0; i < groups.length; i += colCount) {
        const rowGroups = groups.slice(i, i + colCount);

        // Calculate actual height needed for each group
        const groupHeights = rowGroups.map(g => {
            const headerH2 = 8; // title bar
            const subHeaderH = 7; // sub-column headers + line
            const rowsH = g.lots.length * 4.5;
            const footerH = g.lots.length > 0 ? 6 : 0; // accent line + subtotals
            return headerH2 + subHeaderH + rowsH + footerH + 5; // +5 padding for safety
        });
        const maxGroupH = Math.max(...groupHeights);

        rowGroups.forEach((g, ci) => {
            const cx = ml + ci * (colW + colGap);
            const thisH = groupHeights[ci];

            // Draw container background with border
            roundRect(doc, cx, y, colW, maxGroupH, 1.5, COLORS.white, COLORS.border);

            // Render content inside container
            renderDetailColumn(doc, g, cx, y, colW);
        });

        y += maxGroupH + 4;
    }

    // TREND CHART
    if (trendData && trendData.length > 0) {
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.primary);
        doc.text("Tendencia de Precios - Ultimos 12 Meses", ml, y + 4);
        
        const chartY = y + 8;
        const chartH = 35;
        const chartW = uw - 20;
        const chartX = ml + 10;
        
        roundRect(doc, chartX, chartY, chartW, chartH, 2, COLORS.white, COLORS.border);
        
        const barCount = Math.min(trendData.length, 12);
        const barWidth = (chartW - 20) / barCount;
        const maxPrice = Math.max(...trendData.map(d => d.avgPrice), 1);
        
        trendData.slice(0, 12).forEach((data, i) => {
            const barX = chartX + 10 + i * barWidth;
            const barH = (data.avgPrice / maxPrice) * (chartH - 15);
            const barY = chartY + chartH - 5 - barH;
            
            const colorIdx = i % COLORS.chartColors.length;
            doc.setFillColor(...COLORS.chartColors[colorIdx]);
            doc.rect(barX, barY, barWidth - 2, barH, "F");
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(5);
            doc.setTextColor(...COLORS.textLight);
            const monthLabel = data.month.substring(0, 3);
            doc.text(monthLabel, barX + (barWidth - 2) / 2, chartY + chartH - 2, { align: "center" });
        });
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textLight);
        doc.text("Precio Promedio", ml, chartY - 3, { align: "left" });
        
        y += chartH + 8;
    }

    // ════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════
    y += 4;
    const footerH = 18;

    doc.setFillColor(...COLORS.bgCard);
    doc.rect(0, y, pw, footerH, "F");
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, y, pw, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text("Visite www.feriasaraucania.cl para precios actualizados al cierre de cada remate", ml, y + 9);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text(`Total Transado: ${totalAnimales.toLocaleString("es-CL")} cabezas`, pw - mr, y + 9, { align: "right" });

    y += footerH;

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
    roundRect(doc, x, y, width, 8, 1.5, COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(group.shortName, x + width / 2, y + 5.2, { align: "center" });

    // Sub-column header
    const subY = y + 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);

    const sw = [width * 0.12, width * 0.26, width * 0.32, width * 0.30];
    doc.text("Cant", x + sw[0] / 2, subY + 3, { align: "center" });
    doc.text("Peso", x + sw[0] + sw[1] / 2, subY + 3, { align: "center" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] / 2, subY + 3, { align: "center" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] / 2, subY + 3, { align: "center" });

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(x, subY + 4, x + width, subY + 4);

    let rowY = subY + 7;
    const lineH = 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.text);

    group.lots.forEach((lot, idx) => {
        if (idx % 2 === 1) {
            doc.setFillColor(...COLORS.bgLight);
            doc.rect(x, rowY - 2.5, width, lineH, "F");
        }

        let sx = x;
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.text(lot.cantidad.toString(), sx + sw[0] - 1, rowY, { align: "right" });
        sx += sw[0];

        doc.text(Math.round(lot.peso).toLocaleString("es-CL"), sx + sw[1] - 2, rowY, { align: "right" });
        sx += sw[1];

        doc.setFont("helvetica", "bold");
        doc.text(lot.precio.toFixed(2), sx + sw[2] - 2, rowY, { align: "right" });
        sx += sw[2];

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(getInitials(lot.vendedor), sx + 3, rowY);

        rowY += lineH;
    });

    // Footer: subtotals
    if (group.lots.length > 0) {
        doc.setDrawColor(...COLORS.accent);
        doc.setLineWidth(0.4);
        doc.line(x, rowY - 1, x + width, rowY - 1);
        rowY += 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.primary);

        let sx = x;
        doc.text(group.totalCabezas.toString(), sx + sw[0] - 1, rowY, { align: "right" });
        sx += sw[0];
        doc.text(Math.round(group.totalPeso).toLocaleString("es-CL"), sx + sw[1] - 2, rowY, { align: "right" });
        sx += sw[1];
        doc.setTextColor(...COLORS.accent);
        doc.text(group.avgPrice.toFixed(2), sx + sw[2] - 2, rowY, { align: "right" });
        sx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(6);
        doc.text("PR.GRAL.", sx + 3, rowY);
    }
}
