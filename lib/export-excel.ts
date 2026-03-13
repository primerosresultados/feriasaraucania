import XLSX from "xlsx-js-style";

interface ExcelRow {
    sp: string;
    totalCabezas: number;
    pesoPromedio: number;
    top5Prices: number[];
    precioGeneral: number;
}

interface ExcelFooter {
    totalCabezas: number;
    pesoPromedio: number;
    priceColumns: number[][];
    precioGeneral: number;
}

export function downloadAuctionExcel(params: {
    recintoName: string;
    fecha: string;
    rows: ExcelRow[];
    footer: ExcelFooter;
}): void {
    const { recintoName, fecha, rows, footer } = params;

    const headers = [
        "Especie",
        "Cabezas",
        "Peso Promedio",
        "Precio 1",
        "Precio 2",
        "Precio 3",
        "Precio 4",
        "Precio 5",
        "Promedio General",
    ];

    const boldStyle = { font: { bold: true } };
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "334155" } },
        alignment: { horizontal: "center" as const },
    };

    // Build header row
    const headerRow = headers.map((h) => ({
        v: h,
        t: "s" as const,
        s: headerStyle,
    }));

    // Build data rows
    const dataRows = rows.map((row) => {
        const priceValues = [0, 1, 2, 3, 4].map((i) =>
            row.top5Prices[i] !== undefined
                ? { v: Math.round(row.top5Prices[i]), t: "n" as const, s: boldStyle }
                : { v: "", t: "s" as const }
        );

        return [
            { v: row.sp, t: "s" as const },
            { v: row.totalCabezas, t: "n" as const },
            { v: parseFloat(row.pesoPromedio.toFixed(1)), t: "n" as const },
            ...priceValues,
            { v: Math.round(row.precioGeneral), t: "n" as const, s: boldStyle },
        ];
    });

    // Build footer row
    const footerPrices = [0, 1, 2, 3, 4].map((i) =>
        footer.priceColumns[i] && footer.priceColumns[i].length > 0
            ? {
                  v: Math.round(
                      footer.priceColumns[i].reduce((a, b) => a + b, 0) /
                          footer.priceColumns[i].length
                  ),
                  t: "n" as const,
                  s: boldStyle,
              }
            : { v: "", t: "s" as const }
    );

    const footerBoldStyle = { font: { bold: true } };
    const footerRow = [
        { v: "TOTAL", t: "s" as const, s: footerBoldStyle },
        { v: footer.totalCabezas, t: "n" as const, s: footerBoldStyle },
        { v: parseFloat(footer.pesoPromedio.toFixed(1)), t: "n" as const, s: footerBoldStyle },
        ...footerPrices,
        { v: Math.round(footer.precioGeneral), t: "n" as const, s: boldStyle },
    ];

    // Assemble the sheet
    const sheetData = [headerRow, ...dataRows, footerRow];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    ws["!cols"] = [
        { wch: 22 }, // Especie
        { wch: 10 }, // Cabezas
        { wch: 14 }, // Peso Promedio
        { wch: 12 }, // Precio 1
        { wch: 12 }, // Precio 2
        { wch: 12 }, // Precio 3
        { wch: 12 }, // Precio 4
        { wch: 12 }, // Precio 5
        { wch: 16 }, // Promedio General
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Remate");

    // Format filename: Remate_TEMUCO_01-01-2025.xlsx
    const fechaClean = fecha.replace(/\//g, "-");
    const fileName = `Remate_${recintoName}_${fechaClean}.xlsx`;

    XLSX.writeFile(wb, fileName);
}
