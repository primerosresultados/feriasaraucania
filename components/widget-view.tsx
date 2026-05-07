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
    Hash,
    Download
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
import { downloadAuctionPDF } from "@/lib/export-pdf";

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
        ? "pl-3 pr-8 py-1.5 text-xs sm:min-w-[140px]"
        : "pl-2 sm:pl-3 pr-7 sm:pr-8 py-1.5 sm:py-2 text-[11px] sm:text-xs sm:min-w-[160px]";

    return (
        <div className="relative flex-1 min-w-0 sm:flex-none" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full sm:w-auto border rounded-md bg-white focus:outline-none appearance-none font-bold text-left flex items-center gap-2",
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-full sm:w-auto sm:min-w-[180px] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
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
    const RECINTO_DISPLAY_ORDER = ['TEMUCO', 'FREIRE', 'VICTORIA'];
    const availableRecintos = Array.from(new Set(allAuctions.map(a => a.recinto.toUpperCase()))).sort((a, b) => {
        const ia = RECINTO_DISPLAY_ORDER.indexOf(a);
        const ib = RECINTO_DISPLAY_ORDER.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    const availableSpecies = sortSpecies(Array.from(new Set(allAuctions.flatMap(a => a.lots.map(l => l.tipoLote)))));

    // Filters
    const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
    const [rangeType, setRangeType] = useState("last"); // last, 1m, 3m, 6m, year, all, custom
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [selectedDate, setSelectedDate] = useState<string | null>(null); // key = "fecha|recinto"

    // Calculate Date Range based on selection.
    // Anchor "now" to the latest auction in the dataset (fallback to real clock)
    // so relative windows like "Último Mes" still return data when the dataset
    // is older than the wall clock.
    const getDateRange = () => {
        const latestTs = allAuctions.reduce((m, a) => {
            const t = parseDate(a.fecha).getTime();
            return t > m ? t : m;
        }, 0);
        const now = latestTs > 0 ? new Date(latestTs) : new Date();

        let start = new Date(0); // Epoch
        const end = new Date(now);

        if (rangeType === 'custom') {
            if (customStart) start = new Date(customStart);
            const customEndDate = customEnd ? new Date(customEnd) : end;
            return { start, end: customEndDate };
        }

        // Build start from `now` so the year adjusts correctly when subtracting months.
        // (new Date(0).setMonth(...) would leave the year at 1970 — a subtle bug.)
        switch (rangeType) {
            case '1m': start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
            case '3m': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case '6m': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
            case 'year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'last': start = new Date(0); break;
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

        // 3. "Último Remate": keep only the latest auction per recinto
        if (rangeType === 'last') {
            const latestByRecinto = new Map<string, typeof filtered[number]>();
            filtered.forEach(a => {
                const key = a.recinto.toUpperCase();
                const prev = latestByRecinto.get(key);
                if (!prev || (a as any)._timestamp > (prev as any)._timestamp) {
                    latestByRecinto.set(key, a);
                }
            });
            filtered = Array.from(latestByRecinto.values()).sort((a, b) => (a as any)._timestamp - (b as any)._timestamp);
        }

        setFilteredAuctions(filtered);
    }, [selectedRecintos, processedAuctions, rangeType, customStart, customEnd]); // Re-run when filters change

    // Reset selectedDate only when recinto changes (not when range changes,
    // so the user can pick an exact fair without fighting the range filter)
    useEffect(() => {
        setSelectedDate(null);
    }, [selectedRecintos]);

    // Available dates for chips: unique date+recinto combos, most recent first
    const availableDates = useMemo(() => {
        const seen = new Map<string, { fecha: string; recinto: string; timestamp: number }>();
        const source = selectedRecintos.length > 0
            ? (processedAuctions as any[]).filter(a => selectedRecintos.includes(a.recinto.toUpperCase()))
            : (processedAuctions as any[]);
        source.forEach(a => {
            const key = `${a.fecha}|${a.recinto}`;
            if (!seen.has(key)) {
                seen.set(key, { fecha: a.fecha, recinto: a.recinto, timestamp: a._timestamp });
            }
        });
        return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [processedAuctions, selectedRecintos]);

    // Display auctions: if a specific date is selected, show only that one; otherwise top 5
    const displayAuctions = selectedDate
        ? (processedAuctions as any[]).filter(a => `${a.fecha}|${a.recinto}` === selectedDate)
        : filteredAuctions.slice(-5);

    // Determine species list to show
    const relevantSpecies = selectedSpecies.length === 0
        ? sortSpecies(Array.from(new Set(displayAuctions.flatMap((a: any) => a.lots.map((l: any) => l.tipoLote)))))
        : selectedSpecies;

    const trendData = useMemo(() => {
        const isDaily = ['1m', '3m', '6m', 'custom'].includes(rangeType);
        // 'year' = single calendar year → month-only buckets (12). 'all' = span
        // potentially many years → year+month buckets so 2024-Feb and 2025-Feb
        // don't collapse together.
        const perYear = rangeType === 'all';
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        // Single pass aggregation
        const dataMap = new Map<string, any>();
        const speciesSet = new Set<string>();

        if (!isDaily && !perYear) {
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

        const trendSource = selectedDate
            ? (processedAuctions as any[]).filter(a => `${a.fecha}|${a.recinto}` === selectedDate)
            : (filteredAuctions as any[]);

        trendSource.forEach(auction => {
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
            } else if (perYear) {
                const y = date.getFullYear();
                const m = date.getMonth();
                timeKey = `${y}-${String(m).padStart(2, '0')}`;
                if (!dataMap.has(timeKey)) {
                    dataMap.set(timeKey, {
                        label: `${months[m]} ${String(y).slice(-2)}`,
                        _sortKey: y * 12 + m,
                    });
                }
            } else {
                timeKey = date.getMonth().toString();
            }

            const entry = dataMap.get(timeKey);
            if (!entry) return;

            // Lot-based fallback (primeros precios) accumulators
            auction.lots.forEach((lot: any) => {
                if (lot.vendedor === "__SUMMARY__") return;
                const sp = lot.tipoLote;
                speciesSet.add(sp);

                if (!entry[`_w_${sp}`]) {
                    entry[`_w_${sp}`] = 0;
                    entry[`_v_${sp}`] = 0;
                }
                entry[`_w_${sp}`] += lot.peso;
                entry[`_v_${sp}`] += (lot.peso * lot.precio);
            });

            // Promedio General from XML summaries (all animals) — preferred source
            (auction.summaries || []).forEach((s: any) => {
                if (!s.pptotal || s.pptotal <= 0) return;
                const sp = s.descripcion;
                speciesSet.add(sp);
                const w = s.pesototal && s.pesototal > 0 ? s.pesototal : 1;
                entry[`_gw_${sp}`] = (entry[`_gw_${sp}`] || 0) + w;
                entry[`_gv_${sp}`] = (entry[`_gv_${sp}`] || 0) + s.pptotal * w;
            });
        });

        const result = Array.from(dataMap.values()).map(entry => {
            const finalEntry: any = { ...entry };
            speciesSet.forEach(sp => {
                const gw = finalEntry[`_gw_${sp}`];
                const gv = finalEntry[`_gv_${sp}`];
                const w = finalEntry[`_w_${sp}`];
                const v = finalEntry[`_v_${sp}`];
                if (gw && gv) {
                    finalEntry[sp] = Math.round(gv / gw);
                } else if (w && v) {
                    finalEntry[sp] = Math.round(v / w);
                } else {
                    finalEntry[sp] = null;
                }
                delete finalEntry[`_w_${sp}`];
                delete finalEntry[`_v_${sp}`];
                delete finalEntry[`_gw_${sp}`];
                delete finalEntry[`_gv_${sp}`];
            });
            return finalEntry;
        });

        return result.sort((a, b) => a._sortKey - b._sortKey);
    }, [filteredAuctions, processedAuctions, selectedDate, rangeType]);

    const trendYAxis = useMemo(() => {
        const values: number[] = [];
        trendData.forEach((row: any) => {
            Object.keys(row).forEach(k => {
                if (k === 'label' || k.startsWith('_')) return;
                const v = row[k];
                if (typeof v === 'number' && isFinite(v)) values.push(v);
            });
        });
        if (!values.length) return { ticks: undefined as number[] | undefined, domain: ['auto', 'auto'] as [any, any] };
        // Add a 200-unit breathing pad below the lowest value and above the highest
        // so the line never hugs the axes.
        const min = Math.floor(Math.min(...values) / 100) * 100 - 200;
        const max = Math.ceil(Math.max(...values) / 100) * 100 + 200;
        const ticks: number[] = [];
        for (let v = min; v <= max; v += 100) ticks.push(v);
        return { ticks, domain: [min, max] as [number, number] };
    }, [trendData]);

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
                    <div className="relative flex-1 min-w-0 sm:flex-none">
                        <select
                            value={rangeType}
                            onChange={(e) => setRangeType(e.target.value)}
                            className="w-full sm:w-auto pl-2 sm:pl-3 pr-7 sm:pr-8 py-1.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 text-[11px] sm:text-xs bg-white focus:outline-none appearance-none sm:min-w-[140px] font-bold"
                        >
                            <option value="last">Último Remate</option>
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
                                className="pl-2 sm:pl-3 pr-7 sm:pr-8 py-1.5 sm:py-2 border border-slate-300 rounded-md text-slate-700 text-[11px] sm:text-xs bg-white focus:outline-none appearance-none w-full sm:min-w-[180px] font-bold"
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
                        auctions={displayAuctions as Auction[]}
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

                            // Group auctions by recinto. When a specific date is picked, keep
                            // the single matching auction. Otherwise aggregate ALL auctions of
                            // that recinto within the active filter window into a synthetic
                            // auction so the table reflects the full range.
                            const recintoMap = new Map<string, typeof filteredAuctions[0]>();
                            if (selectedDate) {
                                auctionsForTable.forEach(a => {
                                    const rKey = a.recinto.toUpperCase();
                                    const existing = recintoMap.get(rKey);
                                    if (!existing || (a as any)._timestamp > (existing as any)._timestamp) {
                                        recintoMap.set(rKey, a);
                                    }
                                });
                            } else {
                                const byRecinto = new Map<string, any[]>();
                                auctionsForTable.forEach(a => {
                                    const rKey = a.recinto.toUpperCase();
                                    if (!byRecinto.has(rKey)) byRecinto.set(rKey, []);
                                    byRecinto.get(rKey)!.push(a);
                                });
                                byRecinto.forEach((list, rKey) => {
                                    list.sort((a, b) => (a as any)._timestamp - (b as any)._timestamp);
                                    const aggLots = list.flatMap(a => a.lots);
                                    // Merge summaries by species (sum cabezas + peso, weight-avg pptotal)
                                    const summMap = new Map<string, any>();
                                    list.forEach(a => {
                                        (a.summaries || []).forEach((s: any) => {
                                            const prev = summMap.get(s.descripcion);
                                            if (!prev) {
                                                summMap.set(s.descripcion, { ...s });
                                            } else {
                                                const w1 = prev.pesototal || 0;
                                                const w2 = s.pesototal || 0;
                                                const newW = w1 + w2;
                                                prev.pptotal = newW > 0
                                                    ? (prev.pptotal * w1 + s.pptotal * w2) / newW
                                                    : 0;
                                                prev.pesototal = newW;
                                                prev.cantidadtotal += s.cantidadtotal;
                                            }
                                        });
                                    });
                                    const latest = list[list.length - 1];
                                    const earliest = list[0];
                                    const fmt = (f: string) => {
                                        const parts = f.split('/');
                                        if (parts.length === 3) {
                                            let y = parseInt(parts[2], 10);
                                            if (y < 100) y += 2000;
                                            return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${y}`;
                                        }
                                        return f;
                                    };
                                    const fechaLabel = list.length === 1
                                        ? latest.fecha
                                        : `${fmt(earliest.fecha)} → ${fmt(latest.fecha)}`;
                                    const totalAnimales = list.reduce((s, a) => s + (a.totalAnimales || 0), 0);
                                    const totalKilos = list.reduce((s, a) => s + (a.totalKilos || 0), 0);
                                    const synthetic: any = {
                                        ...latest,
                                        fecha: fechaLabel,
                                        lots: aggLots,
                                        summaries: Array.from(summMap.values()),
                                        totalAnimales,
                                        totalKilos,
                                        _isAggregated: true,
                                        _sourceAuctions: list,
                                    };
                                    recintoMap.set(rKey, synthetic);
                                });
                            }
                            const RECINTO_ORDER = ['TEMUCO', 'FREIRE', 'VICTORIA'];
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

                                // Calculate trend data (last 12 months) for the same recinto
                                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                                const trendMap = new Map<string, { totalWeight: number; totalValue: number; totalHeads: number }>();
                                
                                filteredAuctions.forEach((a: any) => {
                                    if (a.recinto.toUpperCase() !== recintoName.toUpperCase()) return;
                                    const dateObj = a._dateObj as Date;
                                    const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
                                    
                                    if (!trendMap.has(monthKey)) {
                                        trendMap.set(monthKey, { totalWeight: 0, totalValue: 0, totalHeads: 0 });
                                    }
                                    const entry = trendMap.get(monthKey)!;
                                    
                                    a.lots.forEach((lot: any) => {
                                        entry.totalWeight += lot.peso;
                                        entry.totalValue += lot.peso * lot.precio;
                                        entry.totalHeads += lot.cantidad;
                                    });
                                });

                                const trendData = Array.from(trendMap.entries())
                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                    .slice(-12)
                                    .map(([key, data]) => {
                                        const [year, month] = key.split('-').map(Number);
                                        return {
                                            month: `${months[month]} ${year.toString().slice(-2)}`,
                                            avgPrice: data.totalWeight > 0 ? data.totalValue / data.totalWeight : 0,
                                            totalHeads: data.totalHeads
                                        };
                                    });

                                return (
                                    <>
                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="flex items-center justify-center gap-2 sm:gap-4 py-3 sm:py-4 px-3 sm:px-6 border-b border-slate-100 flex-wrap">
                                                <span className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-white text-xs sm:text-sm font-bold tracking-wide" style={{ backgroundColor: primaryColor }}>
                                                    {recintoName.charAt(0) + recintoName.slice(1).toLowerCase()}
                                                </span>
                                                <span className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-white text-xs sm:text-sm font-bold tracking-wide" style={{ backgroundColor: '#6b7280' }}>
                                                    {formatTableDate(auction.fecha)}
                                                </span>
                                                <span className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-white text-xs sm:text-sm font-bold tracking-wide" style={{ backgroundColor: '#10b981' }}>
                                                    {footerTotalCabezas.toLocaleString('es-CL')} CABEZAS
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        try {
                                                            downloadAuctionPDF({
                                                                auction,
                                                                recintoName,
                                                                fecha: formatTableDate(auction.fecha),
                                                                allAuctions,
                                                            });
                                                        } catch (err) {
                                                            console.error('Error generating PDF:', err);
                                                            alert('Error al generar el PDF. Revisa la consola para más detalles.');
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-sm"
                                                >
                                                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                    <span className="hidden sm:inline">Descargar Datos</span>
                                                    <span className="sm:hidden">Descargar</span>
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto overflow-y-hidden">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-left font-bold text-lg sm:text-2xl tracking-tight sticky left-0 z-10" style={{ backgroundColor: primaryColor }}>Especie</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Cabezas</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Peso Prom.</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Precio 1</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Precio 2</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Precio 3</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Precio 4</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Precio 5</th>
                                                            <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold text-lg sm:text-2xl border-l border-white/10 tracking-tight">Prom. Gral.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rowsData.map((row, idx) => (
                                                            <tr key={row.sp} className={cn("transition-colors group/row cursor-pointer", idx % 2 === 0 ? "bg-emerald-50/70 hover:bg-emerald-100/80" : "bg-slate-300/60 hover:bg-slate-300/80")} onClick={() => setDetailModalData({ species: row.sp, auction })}>
                                                                <td className={cn("px-2 py-3 sm:px-3 sm:py-3.5 font-bold text-lg sm:text-2xl uppercase sticky left-0 z-10 border-r border-slate-300/60 tracking-tight", idx % 2 === 0 ? "bg-emerald-50/95 group-hover/row:bg-emerald-100/90" : "bg-slate-300/80 group-hover/row:bg-slate-300")}>
                                                                    <span className="text-slate-800 group-hover/row:text-slate-900 transition-colors">{row.sp}</span>
                                                                </td>
                                                                <td className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-slate-900 text-lg sm:text-2xl tabular-nums font-black border-r border-slate-300/40">
                                                                    {row.totalCabezas.toLocaleString('es-CL')}
                                                                </td>
                                                                <td className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-slate-900 text-lg sm:text-2xl tabular-nums font-black border-r border-slate-300/40">
                                                                    {Math.round(row.pesoPromedio)}
                                                                </td>
                                                                {[0, 1, 2, 3, 4].map(i => (
                                                                    <td key={i} className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-slate-900 text-lg sm:text-2xl tabular-nums font-black border-r border-slate-300/40">
                                                                        {row.top5Prices[i] !== undefined ? formatPrice(Math.round(row.top5Prices[i])) : "–"}
                                                                    </td>
                                                                ))}
                                                                <td className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-slate-900 text-lg sm:text-2xl tabular-nums font-black">
                                                                    {formatPrice(Math.round(row.precioGeneral))}
                                                                </td>
                                                            </tr>
                                                        ))}
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
                            }

                            // ─── GENERAL MODE: No recinto or multiple recintos ───
                            return (
                                <>
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto overflow-y-hidden">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                                        <th className="px-2 py-2.5 sm:px-3 sm:py-3 text-left font-bold text-lg sm:text-2xl tracking-tight sticky left-0 z-10 align-middle" style={{ backgroundColor: primaryColor }}>Categoría</th>
                                                        {recintoAuctions.map(([recinto, auction]) => {
                                                            const handleDownload = (e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                const rowsData = speciesToShow.map(sp => {
                                                                    const lots = auction.lots.filter(l => l.tipoLote === sp);
                                                                    const summary = (auction.summaries || []).find(s => s.descripcion === sp);
                                                                    const totalCabezas = summary?.cantidadtotal ?? lots.reduce((acc, l) => acc + l.cantidad, 0);
                                                                    if (totalCabezas === 0 && !lots.length) return null;
                                                                    const totalPeso = summary?.pesototal ?? lots.reduce((acc, l) => acc + l.peso, 0);
                                                                    const pesoPromedio = totalCabezas > 0 ? totalPeso / totalCabezas : 0;
                                                                    const sortedByPrice = [...lots].sort((a, b) => b.precio - a.precio);
                                                                    const top5Prices = sortedByPrice.slice(0, 5).map(l => l.precio);
                                                                    const precioGeneral = summary?.pptotal ?? (() => {
                                                                        const gralTotalW = lots.reduce((acc, l) => acc + l.peso, 0);
                                                                        const gralTotalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                                                        return gralTotalW > 0 ? gralTotalV / gralTotalW : 0;
                                                                    })();
                                                                    return { sp, totalCabezas, pesoPromedio, precioPP: 0, top5Prices, precioGeneral };
                                                                }).filter(Boolean) as { sp: string; totalCabezas: number; pesoPromedio: number; precioPP: number; top5Prices: number[]; precioGeneral: number }[];

                                                                let fTotalCabezas = 0;
                                                                let fGeneralWeightSum = 0;
                                                                let fGeneralValueSum = 0;
                                                                const fPriceColumns: number[][] = [[], [], [], [], []];
                                                                rowsData.forEach(row => {
                                                                    fTotalCabezas += row.totalCabezas;
                                                                    const lots = auction.lots.filter(l => l.tipoLote === row.sp);
                                                                    const summary = (auction.summaries || []).find(s => s.descripcion === row.sp);
                                                                    const totalPeso = summary?.pesototal ?? lots.reduce((acc, l) => acc + l.peso, 0);
                                                                    if (summary?.pptotal) {
                                                                        fGeneralWeightSum += totalPeso;
                                                                        fGeneralValueSum += summary.pptotal * totalPeso;
                                                                    } else {
                                                                        const gW = lots.reduce((acc, l) => acc + l.peso, 0);
                                                                        const gV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                                                        if (gW > 0) { fGeneralWeightSum += gW; fGeneralValueSum += gV; }
                                                                    }
                                                                    for (let i = 0; i < 5; i++) {
                                                                        if (row.top5Prices[i] !== undefined) fPriceColumns[i].push(row.top5Prices[i]);
                                                                    }
                                                                });

                                                                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                                                                const trendMap = new Map<string, { totalWeight: number; totalValue: number; totalHeads: number }>();
                                                                
                                                                filteredAuctions.forEach((a: any) => {
                                                                    if (a.recinto.toUpperCase() !== recinto.toUpperCase()) return;
                                                                    const dateObj = a._dateObj as Date;
                                                                    const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
                                                                    
                                                                    if (!trendMap.has(monthKey)) {
                                                                        trendMap.set(monthKey, { totalWeight: 0, totalValue: 0, totalHeads: 0 });
                                                                    }
                                                                    const entry = trendMap.get(monthKey)!;
                                                                    
                                                                    a.lots.forEach((lot: any) => {
                                                                        entry.totalWeight += lot.peso;
                                                                        entry.totalValue += lot.peso * lot.precio;
                                                                        entry.totalHeads += lot.cantidad;
                                                                    });
                                                                });

                                                                const trendData = Array.from(trendMap.entries())
                                                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                                                    .slice(-12)
                                                                    .map(([key, data]) => {
                                                                        const [year, month] = key.split('-').map(Number);
                                                                        return {
                                                                            month: `${months[month]} ${year.toString().slice(-2)}`,
                                                                            avgPrice: data.totalWeight > 0 ? data.totalValue / data.totalWeight : 0,
                                                                            totalHeads: data.totalHeads
                                                                        };
                                                                    });

                                                                downloadAuctionPDF({
                                                                    auction,
                                                                    recintoName: recinto,
                                                                    fecha: formatTableDate(auction.fecha),
                                                                    allAuctions,
                                                                });
                                                            };
                                                            return (
                                                                <th key={recinto} className="px-2 py-2.5 sm:px-3 sm:py-3 text-center font-bold border-l border-white/10">
                                                                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                                                        <div className="opacity-95 text-lg sm:text-2xl tracking-tight">{recinto.charAt(0) + recinto.slice(1).toLowerCase()}</div>
                                                                        <button
                                                                            onClick={handleDownload}
                                                                            className="group/dl inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-white text-slate-800 hover:bg-slate-100 active:bg-slate-200 shadow-sm hover:shadow transition-all text-[11px] sm:text-xs font-bold tracking-wide"
                                                                            title={`Descargar datos ${recinto.charAt(0) + recinto.slice(1).toLowerCase()}`}
                                                                            style={{ color: primaryColor }}
                                                                        >
                                                                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 icon-download-nudge" />
                                                                            <span>PDF</span>
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-xs sm:text-sm mt-1 opacity-80 font-semibold tracking-wide">{formatTableDate(auction.fecha)}</div>
                                                                </th>
                                                            );
                                                        })}
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
                                                            <tr key={sp} className={cn("transition-colors group/row", idx % 2 === 0 ? "bg-emerald-50/70 hover:bg-emerald-100/80" : "bg-slate-300/60 hover:bg-slate-300/80", bestAuctionForDetail && "cursor-pointer")} onClick={() => { if (bestAuctionForDetail) setDetailModalData({ species: sp, auction: bestAuctionForDetail[1] }); }}>
                                                                <td className={cn("px-2 py-3 sm:px-3 sm:py-3.5 font-bold text-lg sm:text-2xl uppercase sticky left-0 z-10 border-r border-slate-300/60 tracking-tight", idx % 2 === 0 ? "bg-emerald-50/95 group-hover/row:bg-emerald-100/90" : "bg-slate-300/80 group-hover/row:bg-slate-300")}>
                                                                    <span className={cn("text-slate-800 transition-colors", bestAuctionForDetail && "group-hover/row:text-slate-900")}>{sp}</span>
                                                                </td>
                                                                {rowPrices.map((p, i) => (
                                                                    <td key={i} className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-slate-900 text-lg sm:text-2xl tabular-nums font-black border-r border-slate-300/40">
                                                                        {p !== null ? formatPrice(Math.round(p)) : "–"}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Animales Transados row */}
                                                    <tr className="border-t-2 border-emerald-700/30 font-bold bg-emerald-100/80">
                                                        <td className="px-2 py-3 sm:px-3 sm:py-3.5 font-bold text-emerald-900 text-lg sm:text-2xl uppercase sticky left-0 z-10 border-r border-emerald-700/20 bg-emerald-100/95 tracking-tight">
                                                            <span className="sm:hidden">Animales</span>
                                                            <span className="hidden sm:inline">Animales Transados</span>
                                                        </td>
                                                        {recintoAuctions.map(([recinto, auction]) => {
                                                            let totalCabezas = 0;
                                                            speciesToShow.forEach(sp => {
                                                                const summary = (auction.summaries || []).find(s => s.descripcion === sp);
                                                                if (summary) totalCabezas += summary.cantidadtotal;
                                                                else totalCabezas += auction.lots.filter(l => l.tipoLote === sp).reduce((acc, l) => acc + l.cantidad, 0);
                                                            });
                                                            return (
                                                                <td key={recinto} className="px-2 py-3 sm:px-3 sm:py-3.5 text-center text-emerald-900 text-lg sm:text-2xl tabular-nums font-black border-r border-emerald-700/20">
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
                                {(() => {
                                    // Dynamic X-axis spacing: with many points, skip ticks so labels
                                    // don't overlap. Aim for ~10 labels max.
                                    const len = trendData.length;
                                    const maxLabels = 10;
                                    const xInterval = len > maxLabels ? Math.ceil(len / maxLabels) - 1 : 0;
                                    const xFontSize = len > 20 ? 10 : len > 12 ? 11 : 13;
                                    const xAngle = len > 16 ? -35 : 0;
                                    return (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: xAngle ? 40 : 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="label"
                                            interval={xInterval}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: xFontSize, fontWeight: 'bold' }}
                                            tickMargin={xAngle ? 14 : 10}
                                            angle={xAngle}
                                            textAnchor={xAngle ? 'end' : 'middle'}
                                            height={xAngle ? 60 : 30}
                                            padding={{ left: 24, right: 24 }}
                                            minTickGap={8}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} ticks={trendYAxis.ticks} domain={trendYAxis.domain} tickFormatter={(v) => (v as number).toLocaleString('es-CL')} />
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
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
            <div className="px-3 sm:px-5 py-1.5 text-right text-[9px] text-slate-300 select-none tracking-wider">
                v{process.env.NEXT_PUBLIC_BUILD_VERSION || "dev"}
            </div>
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
            const spU = sp.toUpperCase();
            // Authoritative cantidad/peso/precio lives in summaries (XML lots are
            // only primeros precios). Fall back to lots when no summary exists.
            let cantidad = 0;
            let gralWeight = 0;
            let gralValue = 0;
            let lotW = 0;
            let lotV = 0;
            let lotCantidad = 0;

            auctions.forEach(a => {
                const summary = (a.summaries || []).find(s => s.descripcion.toUpperCase() === spU);
                if (summary) {
                    cantidad += summary.cantidadtotal || 0;
                    if (summary.pptotal && summary.pptotal > 0) {
                        const w = summary.pesototal && summary.pesototal > 0 ? summary.pesototal : 1;
                        gralWeight += w;
                        gralValue += summary.pptotal * w;
                    }
                }
                const lots = a.lots.filter(l => l.tipoLote.toUpperCase() === spU);
                lots.forEach(l => {
                    lotW += l.peso;
                    lotV += l.peso * l.precio;
                    lotCantidad += l.cantidad;
                });
            });

            const value = cantidad > 0 ? cantidad : lotCantidad;
            const promedio = gralWeight > 0
                ? Math.round(gralValue / gralWeight)
                : (lotW > 0 ? Math.round(lotV / lotW) : 0);

            return { name: sp, value, promedio };
        }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    }, [auctions, speciesToUse]);

    const modalStats = useMemo(() => {
        let totalAnimales = 0;
        let totalKilos = 0;
        const sellers = new Set<string>();
        let rematesCount = 0;

        // Note: a.lots contains only "primeros precios" (top lots from XML),
        // not every animal. Authoritative totals live in a.summaries
        // (cantidadtotal / pesototal) and a.totalAnimales.
        auctions.forEach(a => {
            const speciesSet = selectedSpecies.length > 0
                ? new Set(selectedSpecies.map((s: string) => s.toUpperCase()))
                : null;

            const matchingSummaries = (a.summaries || []).filter(s =>
                !speciesSet || speciesSet.has(s.descripcion.toUpperCase())
            );

            let auctionAnimales = 0;
            let auctionKilos = 0;

            if (matchingSummaries.length > 0) {
                auctionAnimales = matchingSummaries.reduce((s, x) => s + (x.cantidadtotal || 0), 0);
                auctionKilos = matchingSummaries.reduce((s, x) => s + (x.pesototal || 0), 0);
            } else if (speciesSet) {
                // Fallback: no summaries for the selected species — sum lots.
                const relevantLots = a.lots.filter(l => speciesSet.has(l.tipoLote.toUpperCase()));
                auctionAnimales = relevantLots.reduce((s, l) => s + l.cantidad, 0);
                auctionKilos = relevantLots.reduce((s, l) => s + l.peso, 0);
            } else {
                // No species filter and no summaries → use auction totals.
                auctionAnimales = a.totalAnimales;
                auctionKilos = a.totalKilos;
            }

            if (auctionAnimales > 0) rematesCount++;
            totalAnimales += auctionAnimales;
            totalKilos += auctionKilos;

            const relevantLots = speciesSet
                ? a.lots.filter(l => speciesSet.has(l.tipoLote.toUpperCase()))
                : a.lots;
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
        const speciesSet = selectedSpecies.length > 0
            ? new Set(selectedSpecies.map((s: string) => s.toUpperCase()))
            : null;

        auctions.forEach(a => {
            let count = 0;
            if (speciesSet) {
                const matching = (a.summaries || []).filter(s => speciesSet.has(s.descripcion.toUpperCase()));
                if (matching.length > 0) {
                    count = matching.reduce((s, x) => s + (x.cantidadtotal || 0), 0);
                } else {
                    count = a.lots
                        .filter(l => speciesSet.has(l.tipoLote.toUpperCase()))
                        .reduce((s, l) => s + l.cantidad, 0);
                }
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
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 gap-2 h-8 sm:h-10 px-2.5 sm:px-4 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex-shrink-0">
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
                                    <option value="last">Último Remate</option>
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
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                        <StatBox label="Total Animales" val={modalStats.totalAnimales.toLocaleString('es-CL')} />
                        <StatBox label="Remates" val={modalStats.totalRemates} />
                    </div>

                    {selectedSpecies.length === 1 ? (() => {
                        const sp = selectedSpecies[0];
                        const spU = sp.toUpperCase();

                        // Per-auction Promedio General (pptotal) for this species, weighted by pesototal.
                        // Falls back to weighted avg of lot prices if summary is missing.
                        const auctionStats = auctions.map(a => {
                            const summary = (a.summaries || []).find(
                                s => s.descripcion.toUpperCase() === spU
                            );
                            if (summary && summary.pptotal && summary.pptotal > 0) {
                                return {
                                    recinto: a.recinto,
                                    precio: summary.pptotal,
                                    peso: summary.pesototal || 0,
                                    cantidad: summary.cantidadtotal || 0,
                                };
                            }
                            const lots = a.lots.filter(l => l.tipoLote === sp && l.vendedor !== "__SUMMARY__");
                            if (lots.length === 0) return null;
                            const w = lots.reduce((s, l) => s + l.peso, 0);
                            const v = lots.reduce((s, l) => s + l.peso * l.precio, 0);
                            const cantidad = lots.reduce((s, l) => s + l.cantidad, 0);
                            return {
                                recinto: a.recinto,
                                precio: w > 0 ? v / w : 0,
                                peso: w,
                                cantidad,
                            };
                        }).filter((x): x is { recinto: string; precio: number; peso: number; cantidad: number } => !!x && x.precio > 0);

                        if (auctionStats.length === 0) return null;

                        // 1. Price Distribution Chart — buckets of Promedio General per remate
                        const pMax = Math.max(...auctionStats.map(s => s.precio));
                        const pMin = Math.min(...auctionStats.map(s => s.precio));

                        const range = pMax - pMin || 1;
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

                        auctionStats.forEach(s => {
                            const bIdx = Math.min(4, Math.floor((s.precio - pMin) / bucketSize));
                            if (distribution[bIdx]) distribution[bIdx].cantidad += s.cantidad;
                        });

                        // 2. Promedio General price by Recinto
                        const rMap: Record<string, { w: number, v: number }> = {};
                        auctionStats.forEach(s => {
                            if (!rMap[s.recinto]) rMap[s.recinto] = { w: 0, v: 0 };
                            const w = s.peso > 0 ? s.peso : 1;
                            rMap[s.recinto].w += w;
                            rMap[s.recinto].v += s.precio * w;
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
                                    <h4 className="text-sm font-bold text-slate-700 mb-6 text-center">Precio Promedio General por Recinto</h4>
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

    // Lots are only "primeros precios" (top items from XML). The authoritative
    // totals for the species live in summary.{cantidadtotal,pesototal,pptotal}.
    const summary = (auction.summaries || []).find(s => s.descripcion === species);

    const ppPeso = lots.reduce((s, l) => s + l.peso, 0);
    const ppValor = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
    const ppCabezas = lots.reduce((s, l) => s + l.cantidad, 0);

    const totalCabezas = summary?.cantidadtotal ?? ppCabezas;
    const totalPeso = summary?.pesototal ?? ppPeso;
    const pesoPromedio = totalCabezas > 0 ? totalPeso / totalCabezas : 0;
    const precioGeneral = summary?.pptotal ?? (ppPeso > 0 ? ppValor / ppPeso : 0);

    const precioMax = Math.max(...lots.map(l => l.precio));
    const precioMin = Math.min(...lots.map(l => l.precio));

    return (
        <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="!max-w-[98vw] sm:!max-w-[95vw] w-full !p-0 !rounded-2xl border border-slate-200 shadow-2xl bg-white overflow-hidden max-h-[95vh] flex flex-col [&>button]:hidden">
                {/* Header — solid color, sin degradado */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 text-white" style={{ backgroundColor: primaryColor }}>
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <DialogHeader className="min-w-0">
                            <DialogTitle className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                                {species}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold">{auction.recinto}</span>
                            <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-bold">{auction.fecha}</span>
                        </div>
                    </div>
                    <DialogClose className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-white/15 hover:bg-white/30 text-white transition-colors text-sm font-bold">
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">Cerrar</span>
                    </DialogClose>
                </div>

                {/* Sub-header chips on mobile */}
                <div className="sm:hidden flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-700">{auction.recinto}</span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-500">{auction.fecha}</span>
                </div>

                {/* KPI Strip — totales reales del remate */}
                <div className="px-4 sm:px-6 pt-4">
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-center">
                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">Cabezas</p>
                            <p className="text-xl sm:text-3xl font-black text-slate-800 mt-1 tabular-nums">{totalCabezas.toLocaleString('es-CL')}</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">Peso Prom.</p>
                            <p className="text-xl sm:text-3xl font-black text-slate-800 mt-1 tabular-nums">{Math.round(pesoPromedio).toLocaleString('es-CL')}<span className="text-xs sm:text-sm text-slate-400 font-bold ml-1">kg</span></p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">Promedio Gral.</p>
                            <p className="text-xl sm:text-3xl font-black mt-1 tabular-nums" style={{ color: primaryColor }}>{formatPrice(precioGeneral)}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-widest">Primeros Precios</h4>
                            <span className="text-xs sm:text-sm font-bold text-slate-500 tabular-nums">{lots.length} lotes</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-xs">#</th>
                                        <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest text-xs">Peso (kg)</th>
                                        <th className="px-4 py-3 text-right font-black text-slate-500 uppercase tracking-widest text-xs">Precio ($/kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lots.map((lot, idx) => {
                                        const range = precioMax - precioMin;
                                        const ratio = range > 0 ? (lot.precio - precioMin) / range : 1;
                                        const priceColor = ratio > 0.7 ? primaryColor : ratio < 0.3 ? '#ef4444' : '#334155';
                                        return (
                                            <tr key={idx} className={cn(
                                                "transition-colors",
                                                idx % 2 === 0 ? "bg-white hover:bg-emerald-50/60" : "bg-slate-100/70 hover:bg-slate-200/70"
                                            )}>
                                                <td className="px-4 py-3 text-slate-500 font-bold tabular-nums text-base sm:text-lg">{idx + 1}</td>
                                                <td className="px-4 py-3 text-center text-slate-800 font-bold tabular-nums text-base sm:text-lg">{lot.peso.toLocaleString('es-CL')}</td>
                                                <td className="px-4 py-3 text-right font-black tabular-nums text-base sm:text-lg" style={{ color: priceColor }}>
                                                    {formatPrice(lot.precio)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-black">
                                        <td className="px-4 py-3.5 text-slate-700 uppercase text-xs sm:text-sm tracking-widest">Total Remate</td>
                                        <td className="px-4 py-3.5 text-center text-slate-800 tabular-nums text-base sm:text-lg">{totalPeso.toLocaleString('es-CL')}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums text-base sm:text-lg" style={{ color: primaryColor }}>
                                            {formatPrice(precioGeneral)}
                                            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest ml-2 font-bold">prom. gral.</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
