"use client";

import jsPDF from "jspdf";
import "jspdf-autotable";
import { Auction, Lot, TipoLoteSummary } from "@/types";
import { sortSpecies } from "@/lib/utils";

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
    const totalAnimales = groups.reduce((a, g) => a + g.totalCabezas, 0);
    const totalPesoGlobal = groups.reduce((a, g) => a + g.totalPeso, 0);
    const globalAvg = totalPesoGlobal > 0
        ? groups.reduce((a, g) => a + g.avgPrice * g.totalPeso, 0) / totalPesoGlobal
        : 0;
    const maxPriceGroup = groups.reduce((best, g) => g.topPrice > best.topPrice ? g : best, groups[0]);

    // ─── Create PDF ───
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pw = doc.internal.pageSize.getWidth();  // ~215.9
    const ph = doc.internal.pageSize.getHeight(); // ~279.4
    const ml = 10, mr = 10;
    const uw = pw - ml - mr;
    let y = 0;

    // ════════════════════════════════════════════
    // HEADER BAR
    // ════════════════════════════════════════════
    const headerH = 28;
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pw, headerH, "F");

    // Decorative accent strip
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, headerH - 2, pw, 2, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.white);
    doc.text(`Informe de Precios — ${recintoName.charAt(0) + recintoName.slice(1).toLowerCase()}`, ml + 2, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 220, 255);
    doc.text(formatDateLong(fecha), ml + 2, 19);

    // Small brand
    doc.setFontSize(7);
    doc.setTextColor(150, 180, 220);
    doc.text("feriasaraucania.cl", pw - mr - 2, 19, { align: "right" });

    y = headerH + 6;

    // ════════════════════════════════════════════
    // SUMMARY CARDS (4 cards in a row)
    // ════════════════════════════════════════════
    const cardW = (uw - 6) / 4;
    const cardH = 18;
    const cards = [
        { label: "Total Cabezas", value: totalAnimales.toLocaleString("es-CL"), icon: "🐄" },
        { label: "Categorías", value: groups.length.toString(), icon: "📊" },
        { label: "Precio Promedio", value: `$${Math.round(globalAvg).toLocaleString("es-CL")}`, icon: "💰" },
        { label: "Precio Más Alto", value: `$${Math.round(maxPriceGroup?.topPrice || 0).toLocaleString("es-CL")}`, icon: "🔝" },
    ];

    cards.forEach((card, i) => {
        const cx = ml + i * (cardW + 2);
        roundRect(doc, cx, y, cardW, cardH, 2, COLORS.bgLight, COLORS.border);

        // Accent left bar
        doc.setFillColor(...COLORS.accent);
        doc.rect(cx, y + 2, 1.5, cardH - 4, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COLORS.textLight);
        doc.text(card.label, cx + 5, y + 6);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...COLORS.text);
        doc.text(card.value, cx + 5, y + 14);
    });

    y += cardH + 6;

    // ════════════════════════════════════════════
    // BAR CHART: Precio Promedio por Categoría
    // ════════════════════════════════════════════
    const chartH = 48;
    const chartTitle = "Precio Promedio por Categoría ($/kg)";

    // Chart background
    roundRect(doc, ml, y, uw, chartH + 14, 2, COLORS.white, COLORS.border);

    // Chart title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(chartTitle, ml + 5, y + 8);

    const chartX = ml + 38;
    const chartY = y + 14;
    const chartW = uw - 44;
    const maxPrice = Math.max(...groups.map(g => g.avgPrice));

    // Grid lines
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.1);
    for (let i = 0; i <= 4; i++) {
        const gx = chartX + (chartW * i) / 4;
        doc.line(gx, chartY, gx, chartY + chartH);
        // Scale labels
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.textMuted);
        const val = Math.round((maxPrice * i) / 4);
        doc.text(`$${val.toLocaleString("es-CL")}`, gx, chartY + chartH + 3, { align: "center" });
    }

    // Bars
    const barH = Math.min(5, (chartH - 2) / groups.length - 0.5);
    const barGap = (chartH - groups.length * barH) / (groups.length + 1);

    groups.forEach((g, i) => {
        const by = chartY + barGap + i * (barH + barGap);
        const bw = maxPrice > 0 ? (g.avgPrice / maxPrice) * chartW : 0;
        const color = COLORS.chartColors[i % COLORS.chartColors.length];

        // Bar
        doc.setFillColor(...color);
        doc.roundedRect(chartX, by, Math.max(bw, 1), barH, 1, 1, "F");

        // Label on left
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.text);
        doc.text(g.shortName, chartX - 2, by + barH * 0.7, { align: "right" });

        // Value at end of bar
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(...color);
        doc.text(`$${Math.round(g.avgPrice).toLocaleString("es-CL")}`, chartX + bw + 2, by + barH * 0.7);
    });

    y += chartH + 20;

    // ════════════════════════════════════════════
    // RESUMEN TABLE (summary per category)
    // ════════════════════════════════════════════
    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary);
    doc.text("Resumen por Categoría", ml, y + 4);
    doc.setFillColor(...COLORS.accent);
    doc.rect(ml, y + 5.5, 35, 0.8, "F");
    y += 10;

    // Table header
    const colWidths = [uw * 0.20, uw * 0.12, uw * 0.15, uw * 0.13, uw * 0.13, uw * 0.13, uw * 0.14];
    const headers = ["Categoría", "Cabezas", "Peso Total", "Precio Máx", "Precio Mín", "Promedio", "Top 5 Prom."];

    roundRect(doc, ml, y, uw, 7, 1.5, COLORS.primary);
    let hx = ml;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.white);
    headers.forEach((h, i) => {
        const align = i === 0 ? "left" : "center";
        const tx = i === 0 ? hx + 3 : hx + colWidths[i] / 2;
        doc.text(h, tx, y + 4.8, { align });
        hx += colWidths[i];
    });
    y += 7;

    // Table rows
    groups.forEach((g, idx) => {
        const isAlt = idx % 2 === 1;
        const rowH = 6;

        // Check page break
        if (y + rowH > ph - 30) {
            doc.addPage();
            y = 12;
        }

        if (isAlt) {
            roundRect(doc, ml, y, uw, rowH, 0, COLORS.bgLight);
        }

        let rx = ml;
        doc.setTextColor(...COLORS.text);

        // Category name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(g.shortName, rx + 3, y + 4.2);
        rx += colWidths[0];

        // Cabezas
        doc.setFont("helvetica", "normal");
        doc.text(g.totalCabezas.toLocaleString("es-CL"), rx + colWidths[1] / 2, y + 4.2, { align: "center" });
        rx += colWidths[1];

        // Peso Total
        doc.text(g.totalPeso.toLocaleString("es-CL"), rx + colWidths[2] / 2, y + 4.2, { align: "center" });
        rx += colWidths[2];

        // Precio Max
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.accent);
        doc.text(`$${Math.round(g.topPrice).toLocaleString("es-CL")}`, rx + colWidths[3] / 2, y + 4.2, { align: "center" });
        rx += colWidths[3];

        // Precio Min
        const minPrice = g.lots.length > 0 ? g.lots[g.lots.length - 1].precio : 0;
        doc.setTextColor(...COLORS.warmOrange);
        doc.text(`$${Math.round(minPrice).toLocaleString("es-CL")}`, rx + colWidths[4] / 2, y + 4.2, { align: "center" });
        rx += colWidths[4];

        // Promedio General
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "bold");
        doc.text(`$${Math.round(g.avgPrice).toLocaleString("es-CL")}`, rx + colWidths[5] / 2, y + 4.2, { align: "center" });
        rx += colWidths[5];

        // Top 5 average
        const top5 = g.lots.slice(0, 5);
        const t5w = top5.reduce((a, l) => a + l.peso, 0);
        const t5v = top5.reduce((a, l) => a + l.peso * l.precio, 0);
        const t5avg = t5w > 0 ? t5v / t5w : 0;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.primaryLight);
        doc.text(`$${Math.round(t5avg).toLocaleString("es-CL")}`, rx + colWidths[6] / 2, y + 4.2, { align: "center" });

        // Bottom border
        doc.setDrawColor(...COLORS.border);
        doc.setLineWidth(0.15);
        doc.line(ml, y + rowH, ml + uw, y + rowH);

        y += rowH;
    });

    // Totals row
    const totRowH = 7;
    if (y + totRowH > ph - 30) {
        doc.addPage();
        y = 12;
    }
    roundRect(doc, ml, y, uw, totRowH, 0, COLORS.bgCard);
    let tx2 = ml;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primary);
    doc.text("TOTAL", tx2 + 3, y + 4.8);
    tx2 += colWidths[0];
    doc.text(totalAnimales.toLocaleString("es-CL"), tx2 + colWidths[1] / 2, y + 4.8, { align: "center" });
    tx2 += colWidths[1];
    doc.text(totalPesoGlobal.toLocaleString("es-CL"), tx2 + colWidths[2] / 2, y + 4.8, { align: "center" });
    tx2 += colWidths[2] + colWidths[3] + colWidths[4]; // skip max/min
    doc.text(`$${Math.round(globalAvg).toLocaleString("es-CL")}`, tx2 + colWidths[5] / 2, y + 4.8, { align: "center" });

    y += totRowH + 8;

    // ════════════════════════════════════════════
    // PIE CHART: Distribución de Cabezas
    // ════════════════════════════════════════════
    const pieSection = 52;
    if (y + pieSection > ph - 15) {
        doc.addPage();
        y = 12;
    }

    // Pie chart container
    roundRect(doc, ml, y, uw / 2 - 2, pieSection, 2, COLORS.white, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Distribución de Cabezas", ml + 5, y + 8);

    // Draw a simple pie chart using arc segments
    const pieR = 16;
    const pieCx = ml + uw / 4 - 12;
    const pieCy = y + 30;

    let startAngle = -Math.PI / 2; // start at top
    groups.forEach((g, i) => {
        const sliceAngle = totalAnimales > 0 ? (g.totalCabezas / totalAnimales) * 2 * Math.PI : 0;
        if (sliceAngle === 0) return;
        const color = COLORS.chartColors[i % COLORS.chartColors.length];
        doc.setFillColor(...color);

        // Draw pie slice as filled path using triangle approximation
        const steps = Math.max(Math.ceil(sliceAngle / 0.1), 3);
        const points: [number, number][] = [[pieCx, pieCy]];
        for (let s = 0; s <= steps; s++) {
            const angle = startAngle + (sliceAngle * s) / steps;
            points.push([pieCx + Math.cos(angle) * pieR, pieCy + Math.sin(angle) * pieR]);
        }

        // Use triangle fan to fill
        for (let t = 1; t < points.length - 1; t++) {
            doc.triangle(
                points[0][0], points[0][1],
                points[t][0], points[t][1],
                points[t + 1][0], points[t + 1][1],
                "F"
            );
        }

        startAngle += sliceAngle;
    });

    // Legend (to the right of pie)
    const legX = pieCx + pieR + 8;
    let legY = y + 14;
    const maxLegendItems = Math.min(groups.length, 8);
    groups.slice(0, maxLegendItems).forEach((g, i) => {
        const color = COLORS.chartColors[i % COLORS.chartColors.length];
        doc.setFillColor(...color);
        doc.rect(legX, legY - 1.5, 3, 3, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(...COLORS.text);
        const pct = totalAnimales > 0 ? ((g.totalCabezas / totalAnimales) * 100).toFixed(1) : "0";
        doc.text(`${g.shortName} (${pct}%)`, legX + 5, legY + 0.5);
        legY += 4.5;
    });

    // ════════════════════════════════════════════
    // COMPARATIVE MINI TABLE: Top 5 Precios Más Altos (right half)
    // ════════════════════════════════════════════
    const rightX = ml + uw / 2 + 2;
    const rightW = uw / 2 - 2;
    roundRect(doc, rightX, y, rightW, pieSection, 2, COLORS.white, COLORS.border);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text("Top Precios Más Altos", rightX + 5, y + 8);

    // Get all lots sorted by price, top 10
    const allLotsSorted = auction.lots
        .filter(l => l.vendedor !== "__SUMMARY__")
        .sort((a, b) => b.precio - a.precio)
        .slice(0, 10);

    const topTableY = y + 12;
    // Mini header
    roundRect(doc, rightX + 3, topTableY, rightW - 6, 5, 1, COLORS.bgCard);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.textLight);
    doc.text("#", rightX + 6, topTableY + 3.5);
    doc.text("Categoría", rightX + 12, topTableY + 3.5);
    doc.text("Peso", rightX + 42, topTableY + 3.5);
    doc.text("Precio", rightX + 56, topTableY + 3.5);
    doc.text("Vendedor", rightX + 72, topTableY + 3.5);

    allLotsSorted.forEach((lot, i) => {
        const ry = topTableY + 5 + i * 3.5;
        if (ry + 3.5 > y + pieSection - 2) return;

        doc.setFont("helvetica", i < 3 ? "bold" : "normal");
        doc.setFontSize(5.5);
        if (i < 3) {
            doc.setTextColor(...COLORS.accent);
        } else {
            doc.setTextColor(...COLORS.text);
        }

        doc.text(`${i + 1}`, rightX + 6, ry + 2.5);
        doc.text(getShortName(lot.tipoLote), rightX + 12, ry + 2.5);

        doc.setTextColor(...COLORS.text);
        doc.text(lot.peso.toLocaleString("es-CL"), rightX + 42, ry + 2.5);
        doc.setFont("helvetica", "bold");
        doc.text(`$${lot.precio.toFixed(0)}`, rightX + 56, ry + 2.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textLight);
        doc.text(getInitials(lot.vendedor), rightX + 72, ry + 2.5);

        // Subtle divider
        if (i < allLotsSorted.length - 1) {
            doc.setDrawColor(...COLORS.border);
            doc.setLineWidth(0.1);
            doc.line(rightX + 5, ry + 3.3, rightX + rightW - 5, ry + 3.3);
        }
    });

    y += pieSection + 6;

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

        // Estimate height for this row
        const maxRows = Math.max(...rowGroups.map(g => g.lots.length));
        const estHeight = 10 + maxRows * 3.2 + 10; // header + rows + footer

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

    // Footer bar
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

    const sw = [width * 0.12, width * 0.26, width * 0.32, width * 0.30]; // cant, peso, precio, vendedor
    doc.text("Cant", x + sw[0] / 2, subY + 2.5, { align: "center" });
    doc.text("Peso", x + sw[0] + sw[1] / 2, subY + 2.5, { align: "center" });
    doc.text("Precio", x + sw[0] + sw[1] + sw[2] / 2, subY + 2.5, { align: "center" });
    doc.text("Vend.", x + sw[0] + sw[1] + sw[2] + sw[3] / 2, subY + 2.5, { align: "center" });

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(x, subY + 3.5, x + width, subY + 3.5);

    // Data rows
    let rowY = subY + 5.5;
    const lineH = 3.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.text);

    group.lots.forEach((lot, idx) => {
        // Alternate row shading
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
