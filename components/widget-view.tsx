"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Auction } from "@/types";
import { cn, parseDate, formatCurrency, formatPrice } from "@/lib/utils";
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
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
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
    const availableSpecies = Array.from(new Set(allAuctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();

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


    // Optimization: Pre-calculate timestamps and date objects once
    const processedAuctions = useMemo(() => {
        return allAuctions.map(a => {
            const dateObj = parseDate(a.fecha);
            return {
                ...a,
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
        ? Array.from(new Set(displayAuctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort()
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
        <div className="font-sans text-sm min-h-screen bg-white selection:bg-slate-200 animate-in fade-in duration-500">
            {/* Top info bar */}
            <div className="bg-[#f2f2f2] px-5 py-2 flex items-center gap-2 text-slate-500 text-xs border-b border-slate-200">
                <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">i</div>
                Los precios mostrados corresponden a animales rematados al peso
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white z-20 border-b border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap gap-2 items-center w-full">
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
                            className="pl-3 pr-8 py-2 border border-slate-300 rounded-md text-slate-700 text-xs bg-white focus:outline-none appearance-none min-w-[140px] font-bold"
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
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
                            />
                        </div>
                    )}

                    {/* Date dropdown - only visible when a single recinto is selected */}
                    {selectedRecintos.length === 1 && availableDates.length > 0 && (
                        <div className="relative animate-in fade-in slide-in-from-left-2 duration-200">
                            <select
                                value={selectedDate || ""}
                                onChange={(e) => setSelectedDate(e.target.value || null)}
                                className="pl-3 pr-8 py-2 border border-slate-300 rounded-md text-slate-700 text-xs bg-white focus:outline-none appearance-none min-w-[180px] font-bold"
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
                <div className="px-4 sm:px-8 pt-4">
                    <TabsList className="bg-slate-100 p-1 rounded-lg w-full grid grid-cols-2">
                        <TabsTrigger value="listado" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-slate-600"> Listado de Precios</TabsTrigger>
                        <TabsTrigger value="tendencias" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-slate-600">Gráfico de Tendencias</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="listado" className="mt-0">
                    <div className="p-4 sm:p-8 pt-4">
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
                            const recintoAuctions = Array.from(recintoMap.entries())
                                .sort(([a], [b]) => a.localeCompare(b));

                            // Collect all species from these auctions
                            // Include species from summaries since they may have types not in the top items
                            const allSpecies = Array.from(new Set(
                                recintoAuctions.flatMap(([, a]) => {
                                    const fromLots = a.lots.map(l => l.tipoLote);
                                    const fromSummaries = (a.summaries || []).map(s => s.descripcion);
                                    return [...fromLots, ...fromSummaries];
                                })
                            )).sort();
                            const speciesToShow = selectedSpecies.length > 0
                                ? allSpecies.filter(sp => selectedSpecies.includes(sp))
                                : allSpecies;

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

                                return (
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                        {/* Header with recinto name and date */}
                                        <div className="flex items-center justify-center gap-4 py-4 px-6 border-b border-slate-100">
                                            <span className="px-5 py-2 rounded-full text-white text-sm font-bold tracking-wide" style={{ backgroundColor: primaryColor }}>
                                                {recintoName.charAt(0) + recintoName.slice(1).toLowerCase()}
                                            </span>
                                            <span className="px-5 py-2 rounded-full text-white text-sm font-bold tracking-wide" style={{ backgroundColor: '#6b7280' }}>
                                                {formatTableDate(auction.fecha)}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto overflow-y-hidden">
                                            <table className="w-full border-collapse min-w-[900px]">
                                                <thead>
                                                    <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                        <th className="p-3 text-left font-bold text-xs tracking-wide sticky left-0 z-10" style={{ backgroundColor: primaryColor }}>Especie</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Cabezas</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Peso Promedio</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio Promedio</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 1</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 2</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 3</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 4</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Precio 5</th>
                                                        <th className="p-3 text-center font-bold text-xs border-l border-white/10">Promedio General</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {speciesToShow.map((sp, idx) => {
                                                        const lots = auction.lots.filter(l => l.tipoLote === sp);
                                                        const summary = (auction.summaries || []).find(s => s.descripcion === sp);

                                                        // Use summary cantidadtotal if available (covers all animals, not just top items)
                                                        const totalCabezas = summary?.cantidadtotal ?? lots.reduce((acc, l) => acc + l.cantidad, 0);
                                                        if (totalCabezas === 0 && !lots.length) return null;

                                                        // Peso promedio from summary or items
                                                        const totalPeso = summary?.pesototal ?? lots.reduce((acc, l) => acc + l.peso, 0);
                                                        const pesoPromedio = totalCabezas > 0 ? totalPeso / totalCabezas : 0;

                                                        // Sort lots by precio descending for PP and Top 5
                                                        const sortedByPrice = [...lots].sort((a, b) => b.precio - a.precio);

                                                        // Top 5 individual prices
                                                        const top5Prices = sortedByPrice.slice(0, 5).map(l => l.precio);

                                                        // PP: weighted average of top 13 lots by price
                                                        const top13Lots = sortedByPrice.slice(0, 13);
                                                        const ppTotalW = top13Lots.reduce((acc, l) => acc + l.peso, 0);
                                                        const ppTotalV = top13Lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                                        const precioPP = ppTotalW > 0 ? ppTotalV / ppTotalW : 0;

                                                        // General: use pptotal from summary (authoritative), fallback to calculated
                                                        const precioGeneral = summary?.pptotal ?? ((() => {
                                                            const gralTotalW = lots.reduce((acc, l) => acc + l.peso, 0);
                                                            const gralTotalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                                            return gralTotalW > 0 ? gralTotalV / gralTotalW : 0;
                                                        })());

                                                        return (
                                                            <tr key={sp} className={cn("transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                                <td className={cn("p-3 font-bold text-slate-700 text-xs uppercase sticky left-0 z-10 border-r border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                                    {sp}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                    {totalCabezas}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                    {pesoPromedio.toFixed(1)}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-700 text-xs tabular-nums font-bold border-r border-slate-100">
                                                                    {formatPrice(precioPP)}
                                                                </td>
                                                                {[0, 1, 2, 3, 4].map(i => (
                                                                    <td key={i} className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                        {top5Prices[i] !== undefined ? formatPrice(top5Prices[i]) : "–"}
                                                                    </td>
                                                                ))}
                                                                <td className="p-3 text-center text-slate-600 text-xs tabular-nums">
                                                                    {formatPrice(precioGeneral)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            }

                            // ─── GENERAL MODE: No recinto or multiple recintos ───
                            return (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto overflow-y-hidden">
                                        <table className="w-full border-collapse min-w-[600px]">
                                            <thead>
                                                <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                    <th className="p-3 text-left font-bold text-sm tracking-wide sticky left-0 z-10" style={{ backgroundColor: primaryColor }}></th>
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

                                                    return (
                                                        <tr key={sp} className={cn("transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                            <td className={cn("p-3 font-bold text-slate-700 text-xs uppercase sticky left-0 z-10 border-r border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                                {sp}
                                                            </td>
                                                            {rowPrices.map((p, i) => (
                                                                <td key={i} className="p-3 text-right text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                                    {p !== null ? formatPrice(p) : "–"}
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
                                                    {recintoAuctions.map(([recinto, auction]) => (
                                                        <td key={recinto} className="p-3 text-right text-slate-700 text-xs tabular-nums font-bold border-r border-slate-100">
                                                            {auction.totalAnimales.toLocaleString('es-CL')}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </TabsContent>

                <TabsContent value="tendencias" className="mt-0">
                    <div className="p-4 sm:p-8 pt-4">
                        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-4 md:p-8">
                            <div className="h-[500px] w-full bg-slate-50/50 rounded-[2rem] p-4 border border-slate-100">
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
                                            wrapperStyle={{ paddingTop: '20px' }}
                                            formatter={(value) => <span className="text-slate-500 font-bold text-[10px] md:text-xs uppercase mr-2">{value}</span>}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
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

    const species = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();
    const bySpeciesData = species.map(sp => {
        const lots = auctions.flatMap(a => a.lots.filter(l => l.tipoLote === sp));
        const totalW = lots.reduce((s, l) => s + l.peso, 0);
        const totalV = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
        return { name: sp, value: lots.reduce((s, l) => s + l.cantidad, 0), promedio: Math.round(totalV / totalW) };
    }).sort((a, b) => b.value - a.value);

    const byRecintoData = useMemo(() => {
        const recintoMap: Record<string, number> = {};
        auctions.forEach(a => {
            recintoMap[a.recinto] = (recintoMap[a.recinto] || 0) + a.totalAnimales;
        });
        return Object.entries(recintoMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [auctions]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 gap-2 h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                    <BarChart3 className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Ver Estadísticas</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[1200px] p-0 rounded-[2rem] border border-slate-200 shadow-2xl bg-white overflow-hidden max-h-[90vh] flex flex-col">
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <StatBox label="Total Animales" val={gStats.totalAnimales.toLocaleString()} />
                        <StatBox label="Total Kilos" val={(gStats.totalKilos / 1000).toFixed(1) + "t"} />
                        <StatBox label="Remates" val={gStats.totalRemates} />
                        <StatBox label="Especies" val={gStats.speciesCount} />
                        <StatBox label="Vendedores" val={gStats.sellersCount} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div className="flex flex-col items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-700 mb-4">Distribución por Especie</h4>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={bySpeciesData.slice(0, 8)}
                                            cx="50%" cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {bySpeciesData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="flex flex-col bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-700 mb-4 text-center">Volumen por Recinto</h4>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={byRecintoData} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                                        <YAxis dataKey="name" type="category" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} width={80} tick={{ fill: '#64748b' }} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                        <Bar dataKey="value" fill="#334b5c" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 mb-6 text-center">Comparación de Precios Promedio por Especie</h4>
                        <div className="h-[300px] w-full">
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
