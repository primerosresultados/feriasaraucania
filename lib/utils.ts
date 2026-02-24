import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function parseDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
    }
    return new Date();
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

export function formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Canonical display order for animal species/categories
const SPECIES_ORDER: string[] = [
    'NOVILLO GORDO',
    'VAQUILLA GORDA',
    'VACA GORDA',
    'NOVILLO ENGORDA',
    'VAQUILLA ENGORDA',
    'TERNEROS',
    'TERNERAS',
    'VACAS ENGORDA',
    'VACAS C CRIA',
    'BUEYES',
    'TOROS',
    'CABALLOS',
];

/**
 * Sort an array of species names according to the canonical display order.
 * Species not in the predefined list are placed at the end, sorted alphabetically.
 */
export function sortSpecies(species: string[]): string[] {
    return [...species].sort((a, b) => {
        const ai = SPECIES_ORDER.indexOf(a.toUpperCase());
        const bi = SPECIES_ORDER.indexOf(b.toUpperCase());
        // Both known → use predefined order
        if (ai !== -1 && bi !== -1) return ai - bi;
        // Only one known → known first
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        // Neither known → alphabetical
        return a.localeCompare(b);
    });
}
