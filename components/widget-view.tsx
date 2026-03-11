"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Auction } from "@/types";
import { cn, parseDate, formatCurrency, formatPrice, sortSpecies } from "@/lib/utils";
import {
    Search,
    BarChart3,
    Filter,
    Calendar as CalendarIcon,
    MapPin,
    Scale,
    Users,
    X,
    ExternalLink,
    ChevronRight,
    Play,
    Check,
    Eye,
    TrendingUp,
    TrendingDown,
    Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

interface WidgetViewProps {
    initialRecinto?: string;
    color?: string;
    allAuctions: Auction[];
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#f97316', '#6366f1', '#14b8a6'];

// Multi-select dropdown component for recintos
function MultiSelectDropdown({
    options,
    selected,
    onChange,
    placeholder = "Seleccionar",
    allLabel = "Todos",
    size = "normal"
}: {
    options: string[];
    selected: string[];
    onChange: (newSelected: string[]) => void;
    placeholder?: string;
    allLabel?: string;
    size?: "normal" | "small";
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const selectAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    };

    const getDisplayText = () => {
        if (selected.length === 0) return `${placeholder}: ${allLabel}`;
        if (selected.length === 1) return selected[0];
        if (selected.length === options.length) return `${placeholder}: ${allLabel}`;
        return `${selected.length} seleccionados`;
    };

    const sizeClasses = size === "small"
        ? "pl-3 pr-8 py-1.5 text-xs min-w-[140px]"
        : "pl-3 pr-8 py-2 text-xs min-w-[160px]";

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "border rounded-md bg-white focus:outline-none appearance-none font-bold text-left flex items-center gap-2",
                    size === "small" ? "border-slate-200 text-slate-600 bg-slate-50" : "border-slate-300 text-slate-700",
                    sizeClasses
                )}
            >
                <span className="truncate">{getDisplayText()}</span>
            </button>
            <ChevronRight className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform",
                isOpen ? "rotate-[-90deg]" : "rotate-90",
                size === "small" ? "w-3 h-3" : "w-3.5 h-3.5"
            )} />

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Select All Option */}
                    <button
                        type="button"
                        onClick={selectAll}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                    >
                        <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            selected.length === 0 || selected.length === options.length ? "bg-slate-700 border-slate-700" : "border-slate-300"
                        )}>
                            {(selected.length === 0 || selected.length === options.length) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {allLabel}
                    </button>

                    {/* Individual Options */}
                    <div className="max-h-[200px] overflow-y-auto">
                        {options.map(option => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => toggleOption(option)}
                                className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                    selected.includes(option) ? "bg-slate-700 border-slate-700" : "border-slate-300"
                                )}>
                                    {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function WidgetView({ initialRecinto, color = "10b981", allAuctions }: WidgetViewProps) {
    const [selectedRecintos, setSelectedRecintos] = useState<string[]>(initialRecinto ? [initialRecinto.toUpperCase()] : []);
    const [filteredAuctions, setFilteredAuctions] = useState<Auction[]>([]);
    const [detailModalData, setDetailModalData] = useState<{ species: string; auction: Auction } | null>(null);

    const resolveColor = (c: string) => {
        const COLORS_MAP: Record<string, string> = {
            verde: "10b981", azul: "3b82f6", rojo: "ef4444", naranja: "f97316", amarillo: "eab308",
            purpura: "8b5cf6", rosa: "ec4899", cyan: "06b6d4", gris: "6b7280", negro: "1f2937"
        };
        if (COLORS_MAP[c]) return `#${COLORS_MAP[c]}`;
        if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c}`;
        return `#${c.replace('#', '')}`;
    };

    const primaryColor = resolveColor(color);
    const availableRecintos = Array.from(new Set(allAuctions.map(a => a.recinto.toUpperCase()))).sort();
    const availableSpecies = sortSpecies(Array.from(new Set(allAuctions.flatMap(a => a.lots.map(l => l.tipoLote)))));

    // Filters
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    const [rangeType, setRangeType] = useState("1m"); // 1m, 3m, 6m, year, all, custom
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [selectedDate, setSelectedDate] = useState<string | null>(null); // key = "fecha|recinto"

    // Calculate Date Range based on selection
    const getDateRange = () => {
        const now = new Date();
        // Since we are simulating or using real data, we might want to anchor "now" to the latest auction if data is old?
        // User said "I have data only for Jan", so using real 'now' might filter everything out if we are in Feb and data is Jan.
        // Let's stick to real time relative to "Today".
        // BUT, if the user data is old (2024 xml), default filters might show nothing.
        // Let's find the latest date in data to anchor if needed, or just use real dates.
        // Given the request "data from Jan", let's assume 'now' is fine.

        let start = new Date(0); // Epoch
        let end = new Date(); // Now

        if (rangeType === 'custom') {
            if (customStart) start = new Date(customStart);
            if (customEnd) end = new Date(customEnd);
            return { start, end };
        }

        switch (rangeType) {
            case '1m': start.setMonth(now.getMonth() - 1); break;
            case '3m': start.setMonth(now.getMonth() - 3); break;
            case '6m': start.setMonth(now.getMonth() - 6); break;
            case 'year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'all': default: start = new Date(0); break;
        }
        return { start, end };
    };


    // Optimization: Pre-calculate timestamps and date objects once, and clean up __SUMMARY__ lots
    const processedAuctions = useMemo(() => {
        return allAuctions.map(a => {
            const dateObj = parseDate(a.fecha);

            let summaries = a.summaries || [];
            if (!a.summaries || a.summaries.length === 0) {
                summaries = a.lots.filter(l => l.vendedor === '__SUMMARY__').map(l => ({
                    descripcion: l.tipoLote,
                    cantidadtotal: l.cantidad,
                    pesototal: l.peso,
                    pptotal: l.precio
                }));
            }

            const realLots = a.lots.filter(l => l.vendedor !== '__SUMMARY__');

            // Recompute total animals matching the actual processed categories (drops ignored species)
            const totalAnimalesFixed = summaries.length > 0
                ? summaries.reduce((acc, s) => acc + s.cantidadtotal, 0)
                : realLots.reduce((acc, l) => acc + l.cantidad, 0);

            return {
                ...a,
                lots: realLots,
                summaries: summaries.length > 0 ? summaries : undefined,
                totalAnimales: totalAnimalesFixed,
                _dateObj: dateObj,
                _timestamp: dateObj.getTime()
            };
        });
    }, [allAuctions]);

    useEffect(() => {
        let filtered = processedAuctions;

        // 1. Recinto (multi-select)
        if (selectedRecintos.length > 0) {
            filtered = filtered.filter(a => selectedRecintos.includes(a.recinto.toUpperCase()));
        }

        // 2. Time Range
        const { start, end } = getDateRange();
        // Reset hours for comparison
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        const startTs = start.getTime();
        const endTs = end.getTime();

        filtered = filtered.filter(a => {
            return a._timestamp >= startTs && a._timestamp <= endTs;
        });

        // Sort by date ascending
        filtered.sort((a, b) => a._timestamp - b._timestamp);

        setFilteredAuctions(filtered);
    }, [selectedRecintos, processedAuctions, rangeType, customStart, customEnd]); // Re-run when filters change

    // Reset selectedDate when filters change
    useEffect(() => {
        setSelectedDate(null);
    }, [selectedRecintos, rangeType, customStart, customEnd]);

    // Available dates for chips: unique date+recinto combos, most recent first
    const availableDates = useMemo(() => {
        const seen = new Map<string, { fecha: string; recinto: string; timestamp: number }>();
        (filteredAuctions as any[]).forEach(a => {
            const key = `${a.fecha}|${a.recinto}`;
            if (!seen.has(key)) {
                seen.set(key, { fecha: a.fecha, recinto: a.recinto, timestamp: a._timestamp });
            }
        });
        return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [filteredAuctions]);

    // Display auctions: if a specific date is selected, show only that one; otherwise top 5
    const displayAuctions = selectedDate
        ? filteredAuctions.filter(a => `${a.fecha}|${a.recinto}` === selectedDate)
        : filteredAuctions.slice(-5);

    // Determine species list to show
    const relevantSpecies = selectedSpecies.length === 0
        ? sortSpecies(Array.from(new Set(displayAuctions.flatMap(a => a.lots.map(l => l.tipoLote)))))
        : selectedSpecies;

    const trendData = useMemo(() => {
        const isDaily = ['1m', '3m', '6m', 'custom'].includes(rangeType);

        // Single pass aggregation
        const dataMap = new Map<string, any>();
        const speciesSet = new Set<string>();

        if (!isDaily) {
            const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            months.forEach((m, idx) => {
                dataMap.set(idx.toString(), { label: m, _sortKey: idx });
            });
        }

        // Use the filteredAuctions which are already processed
        // We need to cast or access the _dateObj if we want it, but filteredAuctions is typed as Auction[] usually.
        // Since we spread ...a, the props are there but TS might not know. 
        // We can just re-parse or rely on the fact that existing logic works with 'fecha' string or re-cast.
        // For type safety, let's just re-use 'fecha' string for daily key and re-parse or use the hidden prop if casted.
        // Let's stick to using the existing 'fecha' and parseDate for simplicity inside this reduction as it's not the bottleneck (iteration count is).
        // Actually, using the pre-calc _dateObj is better. Let's cast.

        (filteredAuctions as any[]).forEach(auction => {
            const date = auction._dateObj as Date;
            let timeKey: string;
            let label: string;
            let sortKey: number;

            if (isDaily) {
                timeKey = auction.fecha;
                label = `${date.getDate()}/${date.getMonth() + 1}`;
                sortKey = date.getTime();

                if (!dataMap.has(timeKey)) {
                    dataMap.set(timeKey, { label, fullDate: auction.fecha, _sortKey: sortKey });
                }
            } else {
                timeKey = date.getMonth().toString();
            }

            const entry = dataMap.get(timeKey);
            if (!entry) return;

            auction.lots.forEach((lot: any) => {
                const sp = lot.tipoLote;
                speciesSet.add(sp);

                if (!entry[`_w_${sp}`]) {
                    entry[`_w_${sp}`] = 0;
                    entry[`_v_${sp}`] = 0;
                }
                entry[`_w_${sp}`] += lot.peso;
                entry[`_v_${sp}`] += (lot.peso * lot.precio);
            });
        });

        const result = Array.from(dataMap.values()).map(entry => {
            const finalEntry: any = { ...entry };
            speciesSet.forEach(sp => {
                const w = finalEntry[`_w_${sp}`];
                const v = finalEntry[`_v_${sp}`];
                if (w && v) {
                    finalEntry[sp] = Math.round(v / w);
                } else {
                    finalEntry[sp] = null;
                }
                delete finalEntry[`_w_${sp}`];
                delete finalEntry[`_v_${sp}`];
            });
            return finalEntry;
        });

        return result.sort((a, b) => a._sortKey - b._sortKey);
    }, [filteredAuctions, rangeType]);

    const globalStats = useMemo(() => {
        if (!filteredAuctions.length) return null;
        const totalAnimales = filteredAuctions.reduce((s, a) => s + a.totalAnimales, 0);
        const totalKilos = filteredAuctions.reduce((s, a) => s + a.totalKilos, 0);
        const speciesList = Array.from(new Set(filteredAuctions.flatMap(a => a.lots.map(l => l.tipoLote))));
        const sellers = new Set(filteredAuctions.flatMap(a => a.lots.map(l => l.vendedor)));

        const agg: Record<string, { w: number, v: number }> = {};
        filteredAuctions.forEach(a => a.lots.forEach(l => {
            if (!agg[l.tipoLote]) agg[l.tipoLote] = { w: 0, v: 0 };
            agg[l.tipoLote].w += l.peso;
            agg[l.tipoLote].v += (l.peso * l.precio);
        }));

        let maxP = -1; let maxS = "";
        let minP = Infinity; let minS = "";
        Object.entries(agg).forEach(([name, data]) => {
            const avg = data.v / data.w;
            if (avg > maxP) { maxP = avg; maxS = name; }
            if (avg < minP) { minP = avg; minS = name; }
        });

        return { totalAnimales, totalKilos, totalRemates: filteredAuctions.length, speciesCount: speciesList.length, sellersCount: sellers.size, maxS, maxP: Math.round(maxP), minS, minP: Math.round(minP) };
    }, [filteredAuctions]);

    const sharedFilterProps = {
        selectedRecintos, setSelectedRecintos,
        selectedSpecies, setSelectedSpecies,
        rangeType, setRangeType,
        customStart, setCustomStart,
        customEnd, setCustomEnd,
        availableRecintos, availableSpecies
    };

    return (
        <div className="font-sans text-sm bg-white selection:bg-slate-200 animate-in fade-in duration-500">
            {/* Top info bar */}
            <div className="bg-[#f2f2f2] px-3 sm:px-5 py-2 flex items-center gap-2 text-slate-500 text-[11px] sm:text-xs border-b border-slate-200">
                <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">i</div>
                Los precios mostrados corresponden a animales rematados al peso
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white z-20 border-b border-slate-200 p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center w-full">
                    {/* Recinto Multi-Selector */}
                    <MultiSelectDropdown
                        options={availableRecintos}
                        selected={selectedRecintos}
                        onChange={setSelectedRecintos}
                        placeholder="Recinto"
                        allLabel="Todos"
                    />

                    {/* Species Multi-Selector */}
                    <MultiSelectDropdown
                        options={availableSpecies}
                        selected={selectedSpecies}
                        onChange={setSelectedSpecies}
                        placeholder="Muestra"
                        allLabel="Todas"
                    />

                    {/* Time Range Selector */}
                    <div className="relative">
                        <select
                            value={rangeType}
                            onChange={(e) => setRangeType(e.target.value)}
                            className="pl-2 sm:pl-3 pr-7 sm:pr-8 py-1.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 text-[11px] sm:text-xs bg-white focus:outline-none appearance-none min-w-[120px] sm:min-w-[140px] font-bold"
                        >
                            <option value="1m">Último Mes</option>
                            <option value="3m">Últimos 3 Meses</option>
                            <option value="6m">Últimos 6 Meses</option>
                            <option value="year">Este Año</option>
                            <option value="all">Histórico Completo</option>
                            <option value="custom">Rango Personalizado</option>
                        </select>
                        <CalendarIcon className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Custom Date Inputs (only if custom) */}
                    {rangeType === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 w-full sm:w-auto">
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-600 flex-1 sm:flex-none"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-600 flex-1 sm:flex-none"
                            />
                        </div>
                    )}

                    {/* Date dropdown - only visible when a single recinto is selected */}
                    {selectedRecintos.length === 1 && availableDates.length > 0 && (
                        <div className="relative animate-in fade-in slide-in-from-left-2 duration-200 w-full sm:w-auto">
                            <select
                                value={selectedDate || ""}
                                onChange={(e) => setSelectedDate(e.target.value || null)}
                                className="pl-3 pr-8 py-1.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 text-xs bg-white focus:outline-none appearance-none w-full sm:min-w-[180px] font-bold"
                            >
                                <option value="">Todas las fechas</option>
                                {availableDates.map(d => {
                                    const key = `${d.fecha}|${d.recinto}`;
                                    const parts = d.fecha.split('/');
                                    let formattedDate = d.fecha;
                                    if (parts.length === 3) {
                                        let year = parseInt(parts[2], 10);
                                        if (year < 100) year += 2000;
                                        formattedDate = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${year}`;
                                    }
                                    return (
                                        <option key={key} value={key}>{formattedDate}</option>
                                    );
                                })}
                            </select>
                            <CalendarIcon className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    )}

                    <div className="flex-1" /> {/* Spacer */}

                    <EmbedStatsModal
                        auctions={filteredAuctions}
                        gStats={globalStats}
                        primaryColor={primaryColor}
                        filters={sharedFilterProps}
                    />
                </div>

            </div>

            <Tabs defaultValue="listado" className="w-full">
                <div className="px-3 sm:px-8 pt-3 sm:pt-4">
                    <TabsList className="bg-slate-100 p-1 rounded-lg w-full grid grid-cols-2">
                        <TabsTrigger value="listado" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-slate-600 text-xs sm:text-sm"> Listado de Precios</TabsTrigger>
                        <TabsTrigger value="tendencias" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-slate-600 text-xs sm:text-sm">Tendencias</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="listado" className="mt-0">
                    <div className="p-3 sm:p-8 pt-3 sm:pt-4">
                        {filteredAuctions.length === 0 ? (
                            <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner group">
                                <Search className="w-16 h-16 text-slate-100 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" />
                                <p className="text-slate-400 font-bold text-lg">No hay registros para mostrar</p>
                                <p className="text-slate-300 text-sm mt-1">Intenta ajustando el filtro de recinto o fecha.</p>
                            </div>
                        ) : (() => {
                            const isDetailMode = selectedRecintos.length === 1;

                            // Use displayAuctions (respects selectedDate) for building the table
                            const auctionsForTable = selectedDate ? displayAuctions : filteredAuctions;

                            // Group auctions by recinto and get the most recent one per recinto
                            const recintoMap = new Map<string, typeof filteredAuctions[0]>();
                            auctionsForTable.forEach(a => {
                                const rKey = a.recinto.toUpperCase();
                                const existing = recintoMap.get(rKey);
                                if (!existing || (a as any)._timestamp > (existing as any)._timestamp) {
                                    recintoMap.set(rKey, a);
                                }
                            });
                            const RECINTO_ORDER = ['TEMUCO', 'VICTORIA', 'FREIRE'];
                            const recintoAuctions = Array.from(recintoMap.entries())
                                .sort(([a], [b]) => {
                                    const indexA = RECINTO_ORDER.indexOf(a);
                                    const indexB = RECINTO_ORDER.indexOf(b);
                                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                    if (indexA !== -1) return -1;
                                    if (indexB !== -1) return 1;
                                    return a.localeCompare(b);
                                });

                            // Collect all species from these auctions
                            // Include species from summaries since they may have types not in the top items
                            const allSpecies = Array.from(new Set(
                                recintoAuctions.flatMap(([, a]) => {
                                    const fromLots = a.lots.map(l => l.tipoLote);
                                    const fromSummaries = (a.summaries || []).map(s => s.descripcion);
                                    return [...fromLots, ...fromSummaries];
                                })
                            ));
                            const speciesToShow = sortSpecies(selectedSpecies.length > 0
                                ? allSpecies.filter(sp => selectedSpecies.includes(sp))
                                : allSpecies);

                            // Format date from DD/MM/YY to DD-MM-YYYY
                            const formatTableDate = (fecha: string) => {
                                const parts = fecha.split('/');
                                if (parts.length === 3) {
                                    let year = parseInt(parts[2], 10);
                                    if (year < 100) year += 2000;
                                    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${year}`;
                                }
                                return fecha;
                            };

                            // Helper: get the pptotal from summaries for a species in an auction
                            const getSummaryPrice = (auction: typeof filteredAuctions[0], species: string): number | null => {
                                const summary = (auction.summaries || []).find(s => s.descripcion === species);
                                if (summary && summary.pptotal > 0) return summary.pptotal;
                                return null;
                            };

                            // Helper: calculate fallback price from lots (peso-weighted avg)
                            const calcFallbackPrice = (auction: typeof filteredAuctions[0], species: string): number | null => {
                                const lots = auction.lots.filter(l => l.tipoLote === species);
                                if (!lots.length) return null;
                                const totalW = lots.reduce((acc, l) => acc + l.peso, 0);
                                const totalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                return totalW ? totalV / totalW : 0;
                            };

                            // ─── DETAIL MODE: Single recinto selected ───
                            if (isDetailMode) {
                                const auction = recintoAuctions[0]?.[1];
                                if (!auction) return null;
                                const recintoName = recintoAuctions[0][0];

                                // Pre-calculate totals for footer row
                                let footerTotalCabezas = 0;
                                let footerTotalPeso = 0;
                                let footerPPWeightSum = 0;
                                let footerPPValueSum = 0;
                                let footerGeneralWeightSum = 0;
                                let footerGeneralValueSum = 0;
                                const footerPriceColumns: number[][] = [[], [], [], [], []]; // Top 5 price columns

                                // Pre-compute row data so we can accumulate totals
                                const rowsData = speciesToShow.map(sp => {
                                    const lots = auction.lots.filter(l => l.tipoLote === sp);
                                    const summary = (auction.summaries || []).find(s => s.descripcion === sp);

                                    const totalCabezas = summary?.cantidadtotal ?? lots.reduce((acc, l) => acc + l.cantidad, 0);
                                    if (totalCabezas === 0 && !lots.length) return null;

                                    const totalPeso = summary?.pesototal ?? lots.reduce((acc, l) => acc + l.peso, 0);
                                    const pesoPromedio = totalCabezas > 0 ? totalPeso / totalCabezas : 0;

                                    const sortedByPrice = [...lots].sort((a, b) => b.precio - a.precio);
                                    const top5Prices = sortedByPrice.slice(0, 5).map(l => l.precio);

                                    const top13Lots = sortedByPrice.slice(0, 13);
                                    const ppTotalW = top13Lots.reduce((acc, l) => acc + l.peso, 0);
                                    const ppTotalV = top13Lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                    const precioPP = ppTotalW > 0 ? ppTotalV / ppTotalW : 0;

                                    const precioGeneral = summary?.pptotal ?? ((() => {
                                        const gralTotalW = lots.reduce((acc, l) => acc + l.peso, 0);
                                        const gralTotalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                        return gralTotalW > 0 ? gralTotalV / gralTotalW : 0;
                                    })());

                                    // Accumulate footer totals
                                    footerTotalCabezas += totalCabezas;
                                    footerTotalPeso += totalPeso;
                                    footerPPWeightSum += ppTotalW;
                                    footerPPValueSum += ppTotalV;
                                    const gralW = lots.reduce((acc, l) => acc + l.peso, 0);
                                    const gralV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                    if (summary?.pptotal) {
                                        // Use summary weight as proxy for general average weighting
                                        footerGeneralWeightSum += totalPeso;
                                        footerGeneralValueSum += summary.pptotal * totalPeso;
                                    } else if (gralW > 0) {
                                        footerGeneralWeightSum += gralW;
                                        footerGeneralValueSum += gralV;
                                    }

                                    for (let i = 0; i < 5; i++) {
                                        if (top5Prices[i] !== undefined) {
                                            footerPriceColumns[i].push(top5Prices[i]);
                                        }
                                    }

                                    return { sp, totalCabezas, pesoPromedio, precioPP, top5Prices, precioGeneral };
                                }).filter(Boolean) as { sp: string; totalCabezas: number; pesoPromedio: number; precioPP: number; top5Prices: number[]; precioGeneral: number }[];

                                const footerPesoPromedio = footerTotalCabezas > 0 ? footerTotalPeso / footerTotalCabezas : 0;
                                const footerPrecioPP = footerPPWeightSum > 0 ? footerPPValueSum / footerPPWeightSum : 0;
                                const footerPrecioGeneral = footerGeneralWeightSum > 0 ? footerGeneralValueSum / footerGeneralWeightSum : 0;

                                return (
                                    <>
                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="flex items-center justify-center gap-4 py-4 px-6 border-b border-slate-100">
                                                <span className="px-5 py-2 rounded-full text-white text-sm font-bold tracking-wide" style={{ backgroundColor: primaryColor }}>
                                                    {recintoName.charAt(0) + recintoName.slice(1).toLowerCase()}
                                                </span>
                                                <span className="px-5 py-2 rounded-full text-white text-sm font-bold tracking-wide" style={{ backgroundColor: '#6b7280' }}>
                                                    {formatTableDate(auction.fecha)}
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto overflow-y-hidden">
                                                <table className="w-full border-collapse min-w-[640px]">
                                                    <thead>
                                                        <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                            <th className="p-3 text-left font-bold text-xs tracking-wide sticky left-0 z-10" style={{ backgroundColor: primaryColor }}>Especie</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Cabezas</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Peso Promedio</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 1</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 2</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 3</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 4</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 5</th>
                                                            <th className="p-3 text-center font-bold text-xs border-l border-white/10">Promedio General</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rowsData.map((row, idx) => (
                                                            <tr key={row.sp} className={cn("transition-colors group/row cursor-pointer", idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100")} onClick={() => setDetailModalData({ species: row.sp, auction })}>
                                                                <td className={cn("p-3 font-bold text-xs uppercase sticky left-0 z-10 border-r border-slate-100", idx % 2 === 0 ? "bg-white group-hover/row:bg-slate-50" : "bg-slate-50 group-hover/row:bg-slate-100")}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-1 rounded-md bg-slate-100 group-hover/row:bg-emerald-100 text-slate-400 group-hover/row:text-emerald-600 transition-colors flex-shrink-0">
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <span className="text-slate-700 group-hover/row:text-emerald-700 transition-colors">{row.sp}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                    {row.totalCabezas}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                    {row.pesoPromedio.toFixed(1)}
                                                                </td>
                                                                {[0, 1, 2, 3, 4].map(i => (
                                                                    <td key={i} className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                        {row.top5Prices[i] !== undefined ? formatPrice(Math.round(row.top5Prices[i])) : "–"}
                                                                    </td>
                                                                ))}
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums">
                                                                    {formatPrice(Math.round(row.precioGeneral))}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    {rowsData.length > 0 && (
                                                        <tfoot>
                                                            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                                                                <td className="p-3 font-black text-slate-800 text-xs uppercase sticky left-0 z-10 border-r border-slate-200 bg-slate-100">
                                                                    TOTAL
                                                                </td>
                                                                <td className="p-3 text-center text-slate-800 text-xs tabular-nums font-black border-r border-slate-200">
                                                                    {footerTotalCabezas.toLocaleString('es-CL')}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums font-bold border-r border-slate-200">
                                                                    {footerPesoPromedio.toFixed(1)}
                                                                </td>
                                                                {[0, 1, 2, 3, 4].map(i => (
                                                                    <td key={i} className="p-3 text-center text-slate-600 text-xs tabular-nums font-bold border-r border-slate-200">
                                                                        {footerPriceColumns[i].length > 0
                                                                            ? formatPrice(Math.round(footerPriceColumns[i].reduce((a, b) => a + b, 0) / footerPriceColumns[i].length))
                                                                            : "–"}
                                                                    </td>
                                                                ))}
                                                                <td className="p-3 text-center text-slate-800 text-xs tabular-nums font-black">
                                                                    {formatPrice(Math.round(footerPrecioGeneral))}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            </div>
                                        </div>
                                        <SpeciesDetailModal
                                            data={detailModalData}
                                            onClose={() => setDetailModalData(null)}
                                            primaryColor={primaryColor}
                                        />
                                    </>
                                );
                            }

                            // ─── GENERAL MODE: No recinto or multiple recintos ───
                            return (
                                <>
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto overflow-y-hidden">
                                            <table className="w-full border-collapse min-w-[600px]">
                                                <thead>
                                                    <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                        <th className="p-3 text-left font-bold text-sm tracking-wide sticky left-0 z-10" style={{ backgroundColor: primaryColor }}>Categoría</th>
                                                        {recintoAuctions.map(([recinto, auction]) => (
                                                            <th key={recinto} className="p-3 text-center font-bold text-xs border-l border-white/10">
                                                                <div className="opacity-90">Local {recinto.charAt(0) + recinto.slice(1).toLowerCase()}</div>
                                                                <div className="text-[10px] mt-0.5 opacity-70 font-medium">{formatTableDate(auction.fecha)}</div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {speciesToShow.map((sp, idx) => {
                                                        const rowPrices = recintoAuctions.map(([, a]) => {
                                                            // Prefer pptotal from summaries (authoritative)
                                                            const summaryPrice = getSummaryPrice(a, sp);
                                                            if (summaryPrice !== null) return summaryPrice;
                                                            // Fallback to item-based calculation
                                                            return calcFallbackPrice(a, sp);
                                                        });

                                                        // Find the best auction to show detail for this species
                                                        const bestAuctionForDetail = recintoAuctions.find(([, a]) => a.lots.some(l => l.tipoLote === sp));

                                                        return (
                                                            <tr key={sp} className={cn("transition-colors group/row", idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100", bestAuctionForDetail && "cursor-pointer")} onClick={() => { if (bestAuctionForDetail) setDetailModalData({ species: sp, auction: bestAuctionForDetail[1] }); }}>
                                                                <td className={cn("p-3 font-bold text-xs uppercase sticky left-0 z-10 border-r border-slate-100", idx % 2 === 0 ? "bg-white group-hover/row:bg-slate-50" : "bg-slate-50 group-hover/row:bg-slate-100")}>
                                                                    <div className="flex items-center gap-2">
                                                                        {bestAuctionForDetail && (
                                                                            <div className="p-1 rounded-md bg-slate-100 group-hover/row:bg-emerald-100 text-slate-400 group-hover/row:text-emerald-600 transition-colors flex-shrink-0">
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                            </div>
                                                                        )}
                                                                        <span className={cn("text-slate-700 transition-colors", bestAuctionForDetail && "group-hover/row:text-emerald-700")}>{sp}</span>
                                                                    </div>
                                                                </td>
                                                                {rowPrices.map((p, i) => (
                                                                    <td key={i} className="p-3 text-right text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                        {p !== null ? formatPrice(Math.round(p)) : "–"}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Animales Transados row */}
                                                    <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                                                        <td className="p-3 font-bold text-slate-700 text-xs uppercase sticky left-0 z-10 border-r border-slate-100 bg-slate-50">
                                                            Animales Transados
                                                        </td>
                                                        {recintoAuctions.map(([recinto, auction]) => {
                                                            let totalCabezas = 0;
                                                            speciesToShow.forEach(sp => {
                                                                const summary = (auction.summaries || []).find(s => s.descripcion === sp);
                                                                if (summary) totalCabezas += summary.cantidadtotal;
                                                                else totalCabezas += auction.lots.filter(l => l.tipoLote === sp).reduce((acc, l) => acc + l.cantidad, 0);
                                                            });
                                                            return (
                                                                <td key={recinto} className="p-3 text-right text-slate-700 text-xs tabular-nums font-bold border-r border-slate-100">
                                                                    {totalCabezas.toLocaleString('es-CL')}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <SpeciesDetailModal
                                        data={detailModalData}
                                        onClose={() => setDetailModalData(null)}
                                        primaryColor={primaryColor}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </TabsContent>

                <TabsContent value="tendencias" className="mt-0">
                    <div className="p-3 sm:p-8 pt-3 sm:pt-4">
                        <div className="bg-white rounded-2xl sm:rounded-[3rem] border border-slate-200 shadow-sm p-2 sm:p-4 md:p-8">
                            <div className="h-[350px] sm:h-[500px] w-full bg-slate-50/50 rounded-xl sm:rounded-[2rem] p-2 sm:p-4 border border-slate-100">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 'bold', dy: 10 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                            formatter={(v) => formatCurrency(v as number)}
                                        />
                                        {availableSpecies.filter(s => selectedSpecies.length === 0 || selectedSpecies.includes(s)).map((sp, i) => (
                                            <Line key={sp} type="monotone" dataKey={sp} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={4} dot={{ r: 5, strokeWidth: 3, fill: '#fff' }} connectNulls />
                                        ))}
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ paddingTop: '24px' }}
                                            formatter={(value) => <span className="text-slate-600 font-bold text-[10px] sm:text-xs uppercase ml-1 mr-2 tracking-tight">{value}</span>}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div >
    );
}

function EmbedStatsModal({ auctions, gStats, primaryColor, filters }: { auctions: Auction[], gStats: any, primaryColor: string, filters: any }) {
    if (!gStats) return null;
    const {
        selectedRecintos, setSelectedRecintos,
        selectedSpecies, setSelectedSpecies,
        rangeType, setRangeType,
        customStart, setCustomStart,
        customEnd, setCustomEnd,
        availableRecintos, availableSpecies
    } = filters;

    const speciesToUse = selectedSpecies.length > 0
        ? sortSpecies(selectedSpecies)
        : sortSpecies(Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))));

    const bySpeciesData = useMemo(() => {
        return speciesToUse.map(sp => {
            const lots = auctions.flatMap(a => a.lots.filter(l => l.tipoLote === sp));
            const totalW = lots.reduce((s, l) => s + l.peso, 0);
            const totalV = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
            return { name: sp, value: lots.reduce((s, l) => s + l.cantidad, 0), promedio: totalW > 0 ? Math.round(totalV / totalW) : 0 };
        }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }, [auctions, speciesToUse]);

    const modalStats = useMemo(() => {
        let totalAnimales = 0;
        let totalKilos = 0;
        const sellers = new Set<string>();
        let rematesCount = 0;

        auctions.forEach(a => {
            const relevantLots = selectedSpecies.length > 0
                ? a.lots.filter(l => selectedSpecies.includes(l.tipoLote))
                : a.lots;

            if (relevantLots.length > 0) rematesCount++;
            totalAnimales += relevantLots.reduce((s, l) => s + l.cantidad, 0);
            totalKilos += relevantLots.reduce((s, l) => s + l.peso, 0);
            relevantLots.forEach(l => sellers.add(l.vendedor));
        });

        return {
            totalAnimales,
            totalKilos,
            totalRemates: rematesCount,
            speciesCount: bySpeciesData.length,
            sellersCount: sellers.size
        };
    }, [auctions, selectedSpecies, bySpeciesData]);

    const byRecintoData = useMemo(() => {
        const recintoMap: Record<string, number> = {};
        auctions.forEach(a => {
            let count = 0;
            if (selectedSpecies.length > 0) {
                count = a.lots.filter(l => selectedSpecies.includes(l.tipoLote)).reduce((s, l) => s + l.cantidad, 0);
            } else {
                count = a.totalAnimales;
            }
            if (count > 0) {
                recintoMap[a.recinto] = (recintoMap[a.recinto] || 0) + count;
            }
        });
        return Object.entries(recintoMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [auctions, selectedSpecies]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 gap-2 h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                    <BarChart3 className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Ver Estadísticas</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1200px] !p-0 !rounded-none sm:!rounded-[2rem] border border-slate-200 shadow-2xl bg-white overflow-hidden max-h-[100vh] sm:max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 pb-2 mb-0 flex-shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight">Estadísticas Generales</DialogTitle>
                        {/* Unified Filters inside Modal */}
                        <div className="flex flex-wrap gap-2">
                            <MultiSelectDropdown
                                options={availableRecintos}
                                selected={selectedRecintos}
                                onChange={setSelectedRecintos}
                                placeholder="Recinto"
                                allLabel="Todos"
                                size="small"
                            />
                            <MultiSelectDropdown
                                options={availableSpecies}
                                selected={selectedSpecies}
                                onChange={setSelectedSpecies}
                                placeholder="Muestra"
                                allLabel="Todas"
                                size="small"
                            />
                            <div className="relative">
                                <select value={rangeType} onChange={(e) => setRangeType(e.target.value)} className="pl-3 pr-8 py-1.5 border border-slate-200 rounded-md text-slate-600 text-xs bg-slate-50 focus:outline-none appearance-none font-bold">
                                    <option value="1m">Último Mes</option>
                                    <option value="3m">Últimos 3 Meses</option>
                                    <option value="6m">Últimos 6 Meses</option>
                                    <option value="year">Este Año</option>
                                    <option value="all">Histórico Completo</option>
                                </select>
                                <CalendarIcon className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="overflow-y-auto p-6 pt-2">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-6 sm:mb-8 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                        <StatBox label="Total Animales" val={modalStats.totalAnimales.toLocaleString('es-CL')} />
                        <StatBox label="Total Kilos" val={(modalStats.totalKilos / 1000).toFixed(1) + "t"} />
                        <StatBox label="Remates" val={modalStats.totalRemates} />
                        <StatBox label="Especies" val={modalStats.speciesCount} />
                        <StatBox label="Vendedores" val={modalStats.sellersCount} />
                    </div>

                    {selectedSpecies.length === 1 ? (() => {
                        const sp = selectedSpecies[0];
                        // Get all lots for this species
                        const speciesLots = auctions.flatMap(a => a.lots.filter(l => l.tipoLote === sp).map(l => ({ ...l, fecha: a.fecha, recinto: a.recinto, _ts: (a as any)._timestamp })));

                        if (speciesLots.length === 0) return null;

                        // 1. Price Distribution Chart
                        const pMax = Math.max(...speciesLots.map(l => l.precio));
                        const pMin = Math.min(...speciesLots.map(l => l.precio));

                        // Create 5 buckets for distribution
                        const range = pMax - pMin;
                        const bucketSize = range / 5;
                        const distribution = Array.from({ length: 5 }, (_, i) => {
                            const min = pMin + (i * bucketSize);
                            const max = i === 4 ? pMax : pMin + ((i + 1) * bucketSize);
                            return {
                                name: `${formatPrice(min)} - ${formatPrice(max)}`,
                                min,
                                max,
                                cantidad: 0
                            };
                        });

                        speciesLots.forEach(l => {
                            const bIdx = Math.min(4, Math.floor((l.precio - pMin) / bucketSize));
                            if (distribution[bIdx]) distribution[bIdx].cantidad += l.cantidad;
                        });

                        // 2. Average price by Recinto
                        const rMap: Record<string, { w: number, v: number }> = {};
                        speciesLots.forEach(l => {
                            if (!rMap[l.recinto]) rMap[l.recinto] = { w: 0, v: 0 };
                            rMap[l.recinto].w += l.peso;
                            rMap[l.recinto].v += (l.peso * l.precio);
                        });
                        const byRecinto = Object.entries(rMap).map(([name, data]) => ({
                            name,
                            promedio: data.w > 0 ? Math.round(data.v / data.w) : 0
                        })).sort((a, b) => b.promedio - a.promedio);

                        return (
                            <div className="grid md:grid-cols-2 gap-8 mb-8">
                                <div className="flex flex-col bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-700 mb-6 text-center">Distribución de Precios ({sp})</h4>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={distribution} margin={{ left: 10, right: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" height={40} />
                                                <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                                    formatter={(val: any) => [val, 'Cabezas']}
                                                />
                                                <Bar dataKey="cantidad" fill={primaryColor} radius={[4, 4, 0, 0]} maxBarSize={40}>
                                                    {distribution.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 4 ? primaryColor : `${primaryColor}${Math.round(40 + (index * 15)).toString(16).padStart(2, '0')}`} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="flex flex-col bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-700 mb-6 text-center">Precio PP por Recinto</h4>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={byRecinto} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} domain={['dataMin - 100', 'dataMax + 100']} />
                                                <YAxis dataKey="name" type="category" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} width={80} tick={{ fill: '#64748b' }} />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(val: any) => [`$${formatPrice(val)}`, 'Precio Promedio']}
                                                />
                                                <Bar dataKey="promedio" fill={primaryColor} radius={[0, 4, 4, 0]} barSize={24}>
                                                    {byRecinto.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? primaryColor : `${primaryColor}aa`} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            <div className="flex flex-col items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">Distribución por Especie</h4>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={bySpeciesData.slice(0, 8)}
                                                cx="40%" cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {bySpeciesData.slice(0, 8).map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Legend
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                iconType="circle"
                                                formatter={(value, entry, index) => {
                                                    const total = bySpeciesData.slice(0, 8).reduce((acc, curr) => acc + curr.value, 0);
                                                    const val = bySpeciesData[index]?.value || 0;
                                                    const percent = ((val / total) * 100).toFixed(0);
                                                    return <span className="text-slate-600 font-bold text-[10px] sm:text-xs uppercase ml-1 tracking-tight">{value} <span className="text-slate-400 font-medium ml-1">({percent}%)</span></span>
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="flex flex-col bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h4 className="text-sm font-bold text-slate-700 mb-6 text-center">Comparación de Precios Promedio por Especie</h4>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bySpeciesData.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                            <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                            <YAxis dataKey="name" type="category" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} width={120} tick={{ fill: '#64748b' }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="promedio" fill={primaryColor} radius={[0, 4, 4, 0]} barSize={16}>
                                                {bySpeciesData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? primaryColor : `${primaryColor}cc`} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatBox({ label, val }: { label: string, val: string | number }) {
    return (
        <div className="flex flex-col items-center justify-center p-2 text-center">
            <h4 className="text-lg font-bold text-slate-800 leading-none">{val}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tight">{label}</p>
        </div>
    );
}

function SpeciesDetailModal({ data, onClose, primaryColor }: {
    data: { species: string; auction: Auction } | null;
    onClose: () => void;
    primaryColor: string;
}) {
    if (!data) return null;

    const { species, auction } = data;
    const lots = auction.lots
        .filter(l => l.tipoLote === species)
        .sort((a, b) => b.precio - a.precio);

    if (!lots.length) return null;

    const totalCabezas = lots.reduce((s, l) => s + l.cantidad, 0);
    const totalPeso = lots.reduce((s, l) => s + l.peso, 0);
    const totalValor = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
    const precioPP = totalPeso > 0 ? totalValor / totalPeso : 0;
    const pesoPromedio = totalCabezas > 0 ? totalPeso / totalCabezas : 0;
    const precioMax = Math.max(...lots.map(l => l.precio));
    const precioMin = Math.min(...lots.map(l => l.precio));

    // Chart data for the mini price distribution
    const chartData = lots.map((l, i) => ({
        name: `Lote ${i + 1}`,
        precio: l.precio,
        peso: l.peso,
    }));

    return (
        <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-3xl !p-0 !rounded-none sm:!rounded-[2rem] border-0 sm:border border-slate-200 shadow-2xl bg-white overflow-hidden max-h-[100vh] sm:max-h-[90vh] flex flex-col [&>button]:hidden">
                {/* Header */}
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 opacity-90" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }} />
                    <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-white/5 blur-xl" />
                    <DialogClose className="absolute right-4 top-4 z-20 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all backdrop-blur-sm">
                        <X className="w-4 h-4" />
                    </DialogClose>
                    <div className="relative p-4 sm:p-6 pb-4 sm:pb-5 text-white z-10">
                        <DialogHeader>
                            <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg sm:rounded-xl backdrop-blur-sm">
                                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                {species}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                                {auction.recinto}
                            </span>
                            <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-sm">
                                {auction.fecha}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="px-3 sm:px-6 -mt-1">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                        <div className="text-center">
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Cabezas</p>
                            <p className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">{totalCabezas}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Prom.</p>
                            <p className="text-lg sm:text-xl font-black text-slate-800 mt-0.5">{pesoPromedio.toFixed(1)} <span className="text-[10px] sm:text-xs text-slate-400">kg</span></p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio PP</p>
                            <p className="text-lg sm:text-xl font-black mt-0.5" style={{ color: primaryColor }}>{formatPrice(precioPP)}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-3 sm:p-6 pt-3 sm:pt-4 space-y-4 sm:space-y-6">
                    {/* Lots Table */}
                    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="p-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">#</th>
                                        <th className="p-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Cantidad</th>
                                        <th className="p-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Peso (kg)</th>
                                        <th className="p-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Precio ($/kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lots.map((lot, idx) => {
                                        // Color-code price relative to min/max
                                        const range = precioMax - precioMin;
                                        const ratio = range > 0 ? (lot.precio - precioMin) / range : 1;
                                        const barWidth = ratio * 100;

                                        return (
                                            <tr key={idx} className={cn(
                                                "transition-colors hover:bg-slate-50/80 group/lot",
                                                idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                            )}>
                                                <td className="p-2 sm:p-3 text-slate-400 font-bold tabular-nums">{idx + 1}</td>
                                                <td className="p-2 sm:p-3 text-center text-slate-700 font-bold tabular-nums">{lot.cantidad}</td>
                                                <td className="p-2 sm:p-3 text-center text-slate-700 font-semibold tabular-nums">{lot.peso.toLocaleString('es-CL')}</td>
                                                <td className="p-2 sm:p-3 text-center">
                                                    <div className="relative">
                                                        <div
                                                            className="absolute inset-y-0 left-0 rounded-r-full opacity-10 transition-all"
                                                            style={{
                                                                width: `${barWidth}%`,
                                                                backgroundColor: primaryColor
                                                            }}
                                                        />
                                                        <span className="relative font-black tabular-nums" style={{ color: ratio > 0.7 ? primaryColor : ratio < 0.3 ? '#ef4444' : '#334155' }}>
                                                            {formatPrice(lot.precio)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-black">
                                        <td className="p-3 text-slate-800 uppercase text-[10px] tracking-widest">Total</td>
                                        <td className="p-3 text-center text-slate-800 tabular-nums">{totalCabezas}</td>
                                        <td className="p-3 text-center text-slate-800 tabular-nums">{totalPeso.toLocaleString('es-CL')}</td>
                                        <td className="p-3 text-center tabular-nums" style={{ color: primaryColor }}>{formatPrice(precioPP)} <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">(Promedio)</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Price Distribution Chart */}
                    {chartData.length > 1 && (
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5">
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BarChart3 className="w-3.5 h-3.5" /> Distribución de Precios
                            </h4>
                            <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} width={50} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                            formatter={(value: any) => [`$${formatPrice(value)}`, 'Precio']}
                                        />
                                        <Bar dataKey="precio" radius={[0, 6, 6, 0]} barSize={14}>
                                            {chartData.map((entry, index) => {
                                                const range = precioMax - precioMin;
                                                const ratio = range > 0 ? (entry.precio - precioMin) / range : 1;
                                                const r = Math.round(16 + (239 - 16) * (1 - ratio));
                                                const g = Math.round(185 + (68 - 185) * (1 - ratio));
                                                const b = Math.round(129 + (68 - 129) * (1 - ratio));
                                                return <Cell key={index} fill={`rgb(${r},${g},${b})`} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
