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
    primary: [15, 52, 96] as [number, number, number],       // Deep navy
    primaryLight: [30, 80, 140] as [number, number, number],  // Lighter navy
    accent: [16, 185, 129] as [number, number, number],       // Emerald green
    accentLight: [209, 250, 229] as [number, number, number], // Light green bg
    warmOrange: [249, 115, 22] as [number, number, number],   // Orange highlight
    text: [30, 41, 59] as [number, number, number],           // Slate-800
    textLight: [100, 116, 139] as [number, number, number],   // Slate-500
    textMuted: [148, 163, 184] as [number, number, number],   // Slate-400
    border: [226, 232, 240] as [number, number, number],      // Slate-200
    bgLight: [248, 250, 252] as [number, number, number],     // Slate-50
    bgCard: [241, 245, 249] as [number, number, number],      // Slate-100
    white: [255, 255, 255] as [number, number, number],
    gold: [234, 179, 8] as [number, number, number],          // Amber/gold
    chartColors: [
        [16, 185, 129],   // Emerald
        [59, 130, 246],   // Blue
        [245, 158, 11],   // Amber
        [139, 92, 246],   // Violet
        [236, 72, 153],   // Pink
        [6, 182, 212],    // Cyan
        [239, 68, 68],    // Red
        [249, 115, 22],   // Orange
        [99, 102, 241],   // Indigo
        [20, 184, 166],   // Teal
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
    return v.trim().split(/\s+/).map(p => p.charAt(0).toUpperCase() + ".").join("");
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
 * Modernized PDF report — clean, visual, with charts
 */
export function downloadAuctionPDF(params: {
    auction: Auction;
    recintoName: string;
    fecha: string;
}): void {
    const { auction, recintoName, fecha } = params;

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
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pw = doc.internal.pageSize.getWidth();  // ~215.9
    const ph = doc.internal.pageSize.getHeight(); // ~279.4
    const ml = 10, mr = 10;
    const uw = pw - ml - mr;
    let y = 0;

    // ════════════════════════════════════════════
    // HEADER BAR with Logo
    // ════════════════════════════════════════════
    const headerH = 32;
    // Background: #04141A
    doc.setFillColor(4, 20, 26);
    doc.rect(0, 0, pw, headerH, "F");

    // Decorative accent strip
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, headerH - 1.5, pw, 1.5, "F");

    // Logo (left side) — aspect ratio 1024:346 ≈ 2.96:1
    const logoH = 16;
    const logoW = logoH * (1024 / 346); // ≈ 47.4mm
    const logoY = (headerH - 1.5 - logoH) / 2; // vertically centered
    try {
        doc.addImage(LOGO_BASE64, "PNG", ml + 1, logoY, logoW, logoH);
    } catch (e) {
        // Fallback: text if image fails
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...COLORS.white);
        doc.text("GRUPO ARAUCANÍA", ml + 2, 14);
    }

    // Title (right of logo)
    const titleX = ml + logoW + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.white);
    doc.text(`Informe de Precios — ${recintoName.charAt(0) + recintoName.slice(1).toLowerCase()}`, titleX, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 220, 255);
    doc.text(formatDateLong(fecha), titleX, 19);

    // Small brand (right edge)
    doc.setFontSize(7);
    doc.setTextColor(150, 180, 220);
    doc.text("feriasaraucania.cl", pw - mr - 2, 25, { align: "right" });

    y = headerH + 4;

    // ════════════════════════════════════════════
    // RESUMEN TOTALES + GLOSSARY (side by side)
    // ════════════════════════════════════════════
    const resumenH = 24;
    const resumenW = uw * 0.45;
    const glossaryW = uw - resumenW - 3;

    // --- Left: Resumen Totales ---
    roundRect(doc, ml, y, resumenW, resumenH, 2, COLORS.white, COLORS.border);

    // Accent top bar
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y, resumenW, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen Totales", ml + 4, y + 7);

    // Three stat rows
    const statsStartY = y + 11;
    const statRows = [
        { label: "Animales Ingresados a Remate", value: totalAnimales.toLocaleString("es-CL") },
        { label: "Animales Transados por Kilo", value: transadosPorKilo.toLocaleString("es-CL") },
        { label: "Animales Transados a la Vista", value: totalVista.toLocaleString("es-CL") },
    ];

    statRows.forEach((row, i) => {
        const ry = statsStartY + i * 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.text);
        doc.text(row.label, ml + 4, ry);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.accent);
        doc.text(row.value, ml + resumenW - 5, ry, { align: "right" });
    });

    // --- Right: Glossary ---
    const glossaryX = ml + resumenW + 3;
    roundRect(doc, glossaryX, y, glossaryW, resumenH, 2, COLORS.bgLight, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primaryLight);
    doc.text("Glosario", glossaryX + 4, y + 6);

    const glossaryItems = [
        { key: "Cantidad:", desc: "Número de animales en el lote" },
        { key: "Peso:", desc: "Peso en Kg de todo el lote" },
        { key: "Precio:", desc: "Precio por kilo al que se transó el lote" },
        { key: "PP:", desc: "Totales de los primeros precios" },
        { key: "Gral:", desc: "Totales de todos los animales transados" },
    ];

    glossaryItems.forEach((item, i) => {
        const gy = y + 10 + i * 2.8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.primary);
        doc.text(item.key, glossaryX + 4, gy);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(item.desc, glossaryX + 18, gy);
    });

    y += resumenH + 4;

    // ════════════════════════════════════════════
    // BAR CHART: Precio Promedio por Categoría
    // ════════════════════════════════════════════
    const barCount = groups.length;
    const barH = 5;
    const barGapChart = 2;
    const chartContentH = barCount * barH + (barCount - 1) * barGapChart;
    const chartPaddingTop = 14;
    const chartPaddingBottom = 10;
    const chartTotalH = chartPaddingTop + chartContentH + chartPaddingBottom;

    // Chart background
    roundRect(doc, ml, y, uw, chartTotalH, 2, COLORS.white, COLORS.border);

    // Chart title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Precio Promedio por Categoría ($/kg)", ml + 5, y + 8);

    const labelAreaW = 34;
    const valueAreaW = 20;
    const chartX = ml + labelAreaW + 2;
    const chartY = y + chartPaddingTop;
    const chartW = uw - labelAreaW - valueAreaW - 6;
    const maxPrice = Math.max(...groups.map(g => g.avgPrice));

    // Grid lines (vertical)
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    for (let i = 0; i <= 4; i++) {
        const gx = chartX + (chartW * i) / 4;
        doc.line(gx, chartY - 1, gx, chartY + chartContentH + 1);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        doc.setTextColor(...COLORS.textMuted);
        const val = Math.round((maxPrice * i) / 4);
        doc.text(`$${val.toLocaleString("es-CL")}`, gx, chartY + chartContentH + 5, { align: "center" });
    }

    // Bars
    groups.forEach((g, i) => {
        const by = chartY + i * (barH + barGapChart);
        const bw = maxPrice > 0 ? (g.avgPrice / maxPrice) * chartW : 0;
        const color = COLORS.chartColors[i % COLORS.chartColors.length];

        doc.setFillColor(...(color as [number, number, number]));
        if (bw > 2) {
            doc.roundedRect(chartX, by, bw, barH, 1, 1, "F");
        } else {
            doc.rect(chartX, by, Math.max(bw, 1), barH, "F");
        }

        // Label on left
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.text);
        doc.text(g.shortName, chartX - 3, by + barH * 0.7, { align: "right" });

        // Value at end of bar
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...(color as [number, number, number]));
        const valueX = chartX + Math.max(bw, 1) + 2;
        doc.text(`$${Math.round(g.avgPrice).toLocaleString("es-CL")}`, valueX, by + barH * 0.7);
    });

    y += chartTotalH + 5;

    // ════════════════════════════════════════════
    // PROMEDIOS PRIMEROS PRECIOS + TOP PRECIOS
    // Two-column layout for more breathing room
    // ════════════════════════════════════════════
    const sectionH = 72;
    if (y + sectionH > ph - 15) {
        doc.addPage();
        y = 12;
    }

    const halfW = (uw - 4) / 2;

    // --- LEFT: Promedios de Primeros Precios ---
    roundRect(doc, ml, y, halfW, sectionH, 2, COLORS.white, COLORS.border);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Promedio Primeros Precios", ml + 6, y + 9);

    // Accent underline
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml + 6, y + 10.5, 38, 0.6, "F");

    let promedioY = y + 17;

    // === Section: Gordos — use XML pp5pp if available ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primaryLight);
    doc.text("Gordos — Primeros Precios", ml + 6, promedioY);
    promedioY += 2;

    const gordoCategories = groups.filter(g => TOP_13_CATEGORIES.includes(g.name));
    gordoCategories.forEach((g, i) => {
        promedioY += 5;
        const avg = g.summary?.pp5pp ?? topNWeightedAvg(g.lots, 13);
        const count = g.summary?.cantidad5pp;
        const color = COLORS.chartColors[i % COLORS.chartColors.length];

        // Color dot
        doc.setFillColor(...(color as [number, number, number]));
        doc.circle(ml + 9, promedioY - 1.3, 1.5, "F");

        // Name + count
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.text);
        const label = count ? `${g.shortName} (${count} cab.)` : g.shortName;
        doc.text(label, ml + 13, promedioY);

        // Price
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.accent);
        doc.text(`$${Math.round(avg).toLocaleString("es-CL")}`, ml + halfW - 6, promedioY, { align: "right" });
    });

    promedioY += 7;

    // === Section: Otros — Primeros Precios ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primaryLight);
    doc.text("Otros — Primeros Precios", ml + 6, promedioY);
    promedioY += 2;

    const otherCategories = groups.filter(g => !TOP_13_CATEGORIES.includes(g.name));
    otherCategories.forEach((g) => {
        promedioY += 4.5;
        const avg = g.summary?.pp5pp ?? topNWeightedAvg(g.lots, 5);
        const count = g.summary?.cantidad5pp;

        // Small dash
        doc.setFillColor(...COLORS.textMuted);
        doc.rect(ml + 7, promedioY - 1.5, 3, 0.5, "F");

        // Name + count
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.text);
        const label = count ? `${g.shortName} (${count} cab.)` : g.shortName;
        doc.text(label, ml + 13, promedioY);

        // Price
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.primaryLight);
        doc.text(`$${Math.round(avg).toLocaleString("es-CL")}`, ml + halfW - 6, promedioY, { align: "right" });
    });

    // --- RIGHT: Top Precios Más Altos ---
    const rightX = ml + halfW + 4;
    const rightW = halfW;
    roundRect(doc, rightX, y, rightW, sectionH, 2, COLORS.white, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Top Precios Más Altos", rightX + 6, y + 9);

    const allLotsSorted = auction.lots
        .filter(l => l.vendedor !== "__SUMMARY__")
        .sort((a, b) => b.precio - a.precio)
        .slice(0, 15);

    const topTableY = y + 14;
    // Mini header
    roundRect(doc, rightX + 4, topTableY, rightW - 8, 5, 1, COLORS.bgCard);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textLight);
    doc.text("#", rightX + 8, topTableY + 3.5);
    doc.text("Categoría", rightX + 16, topTableY + 3.5);
    doc.text("Peso", rightX + 48, topTableY + 3.5);
    doc.text("Precio", rightX + 64, topTableY + 3.5);
    doc.text("Vendedor", rightX + 80, topTableY + 3.5);

    allLotsSorted.forEach((lot, i) => {
        const ry = topTableY + 5.5 + i * 3.5;
        if (ry + 3.5 > y + sectionH - 2) return;

        doc.setFont("helvetica", i < 3 ? "bold" : "normal");
        doc.setFontSize(6);
        if (i < 3) {
            doc.setTextColor(...COLORS.accent);
        } else {
            doc.setTextColor(...COLORS.text);
        }

        doc.text(`${i + 1}`, rightX + 8, ry + 2.5);
        doc.text(getShortName(lot.tipoLote), rightX + 16, ry + 2.5);

        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.text(lot.peso.toLocaleString("es-CL"), rightX + 48, ry + 2.5);
        doc.setFont("helvetica", "bold");
        doc.text(`$${lot.precio.toFixed(0)}`, rightX + 64, ry + 2.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(getInitials(lot.vendedor), rightX + 80, ry + 2.5);

        if (i < allLotsSorted.length - 1) {
            doc.setDrawColor(...COLORS.border);
            doc.setLineWidth(0.1);
            doc.line(rightX + 6, ry + 3.3, rightX + rightW - 6, ry + 3.3);
        }
    });

    y += sectionH + 6;

    // ════════════════════════════════════════════
    // DETAILED LOTS — Grouped in 3-column layout
    // ════════════════════════════════════════════
    if (y + 20 > ph - 15) {
        doc.addPage();
        y = 12;
    }

    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text("Detalle de Lotes por Categoría", ml, y + 4);
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y + 5.5, 42, 0.8, "F");
    y += 10;

    // 3-column detail layout
    const colCount = 3;
    const colGap = 3;
    const colW = (uw - colGap * (colCount - 1)) / colCount;

    for (let i = 0; i < groups.length; i += colCount) {
        const rowGroups = groups.slice(i, i + colCount);

        const maxRows = Math.max(...rowGroups.map(g => g.lots.length));
        const estHeight = 10 + maxRows * 3.2 + 10;

        if (y + estHeight > ph - 12) {
            doc.addPage();
            y = 12;
        }

        rowGroups.forEach((g, ci) => {
            const cx = ml + ci * (colW + colGap);
            renderDetailColumn(doc, g, cx, y, colW);
        });

        const actualMax = Math.max(...rowGroups.map(g => 10 + g.lots.length * 3.2 + 10));
        y += actualMax + 3;
    }

    // ════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════
    if (y + 14 > ph - 5) {
        doc.addPage();
        y = 12;
    }

    doc.setFillColor(...COLORS.bgCard);
    doc.rect(0, ph - 14, pw, 14, "F");
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, ph - 14, pw, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textLight);
    doc.text("Visite www.feriasaraucania.cl para precios actualizados al cierre de cada remate", ml, ph - 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primary);
    doc.text(`Total Transado: ${totalAnimales.toLocaleString("es-CL")} cabezas`, pw - mr, ph - 7, { align: "right" });

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
    roundRect(doc, x, y, width, 6, 1.5, COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(group.shortName, x + width / 2, y + 4.2, { align: "center" });

    // Sub-column header
    const subY = y + 6.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.textLight);

    const sw = [width * 0.12, width * 0.26, width * 0.32, width * 0.30];
    doc.text("Cant", x + sw[0] / 2, subY + 2.5, { align: "center" });
    doc.text("Peso", x + sw[0] + sw[1] / 2, subY + 2.5, { align: "center" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] / 2, subY + 2.5, { align: "center" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] / 2, subY + 2.5, { align: "center" });

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(x, subY + 3.5, x + width, subY + 3.5);

    let rowY = subY + 5.5;
    const lineH = 3.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.text);

    group.lots.forEach((lot, idx) => {
        if (idx % 2 === 1) {
            doc.setFillColor(...COLORS.bgLight);
            doc.rect(x, rowY - 2, width, lineH, "F");
        }

        let sx = x;
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "normal");
        doc.text(lot.cantidad.toString(), sx + sw[0] - 1, rowY, { align: "right" });
        sx += sw[0];

        doc.text(lot.peso.toLocaleString("es-CL"), sx + sw[1] - 2, rowY, { align: "right" });
        sx += sw[1];

        doc.setFont("helvetica", "bold");
        doc.text(lot.precio.toFixed(2), sx + sw[2] - 2, rowY, { align: "right" });
        sx += sw[2];

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(getInitials(lot.vendedor), sx + 2, rowY);

        rowY += lineH;
    });

    // Footer: subtotals
    if (group.lots.length > 0) {
        doc.setDrawColor(...COLORS.accent);
        doc.setLineWidth(0.4);
        doc.line(x, rowY - 0.8, x + width, rowY - 0.8);
        rowY += 1.5;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.8);
        doc.setTextColor(...COLORS.primary);

        let sx = x;
        doc.text(group.totalCabezas.toString(), sx + sw[0] - 1, rowY, { align: "right" });
        sx += sw[0];
        doc.text(group.totalPeso.toLocaleString("es-CL"), sx + sw[1] - 2, rowY, { align: "right" });
        sx += sw[1];
        doc.setTextColor(...COLORS.accent);
        doc.text(group.avgPrice.toFixed(2), sx + sw[2] - 2, rowY, { align: "right" });
        sx += sw[2];
        doc.setTextColor(...COLORS.textLight);
        doc.setFontSize(5);
        doc.text("PR.GRAL.", sx + 2, rowY);
    }
}
