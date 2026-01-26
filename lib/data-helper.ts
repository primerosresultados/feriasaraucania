import { Auction, Lot } from "@/types";
import { getAuctions } from "./db";

export function getAuctionsByRecinto(recinto: string | null): Auction[] {
    const auctions = getAuctions();
    if (!recinto) return auctions;
    return auctions.filter(a => a.recinto.toUpperCase() === recinto.toUpperCase());
}

export function getSpeciesStats(auctions: Auction[]) {
    // Sort auctions by date desc
    const sortedAuctions = [...auctions].sort((a, b) => {
        // DD/MM/YY
        const dateA = parseDate(a.fecha);
        const dateB = parseDate(b.fecha);
        return dateB.getTime() - dateA.getTime();
    });

    // Get all unique lot types
    const speciesSet = new Set<string>();
    sortedAuctions.forEach(a => a.lots.forEach(l => speciesSet.add(l.tipoLote)));
    const species = Array.from(speciesSet).sort();

    // For the table: We want to show prices for each species in the recent auctions.
    // Actually, usually these tables show "Min", "Max", "Average" per auction?
    // Or maybe "Price at Auction 1", "Price at Auction 2".
    // The user said "Precio 1-5 (con fechas)".
    // Let's create a structure:
    // { species: "NOVILLO", prices: [ { date: "12/01", price: 1500 }, ... ], avg: 1450 }

    // We'll take the top 5 recent auctions
    const recentAuctions = sortedAuctions.slice(0, 5);

    const stats = species.map(sp => {
        const prices = recentAuctions.map(auction => {
            const lots = auction.lots.filter(l => l.tipoLote === sp);
            if (lots.length === 0) return { date: auction.fecha, price: null };

            // Calculate avg price for this species in this auction
            const totalWeight = lots.reduce((sum, l) => sum + l.peso, 0);
            const totalVal = lots.reduce((sum, l) => sum + (l.peso * l.precio), 0);
            const avg = totalWeight > 0 ? Math.round(totalVal / totalWeight) : 0;
            return { date: auction.fecha, price: avg };
        });

        // Valid prices for overall average
        const validPrices = prices.filter(p => p.price !== null).map(p => p.price as number);
        const overallAvg = validPrices.length > 0
            ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length)
            : 0;

        return {
            species: sp,
            prices: prices.reverse(), // Show oldest to newest left to right? or Newest left? usually Newest left.
            // But "Precio 1-5" usually implies cols.
            // Let's keep them as is (recent first) or sort?
            // "Prices with dates".
            average: overallAvg
        };
    });

    return {
        dates: recentAuctions.map(a => a.fecha), // Matches the prices array index
        data: stats
    };
}

function parseDate(dateStr: string): Date {
    const [d, m, y] = dateStr.split('/').map(Number);
    // Assume 20xx
    return new Date(2000 + y, m - 1, d);
}
