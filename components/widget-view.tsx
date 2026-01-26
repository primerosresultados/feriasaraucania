"use client";

import { useEffect, useState, useMemo } from "react";
import { Auction } from "@/types";
import { cn, parseDate, formatCurrency } from "@/lib/utils";
import {
    Search,
    BarChart3,
    LineChart as LineChartIcon,
    Filter,
    Calendar as CalendarIcon,
    MapPin,
    TrendingUp,
    TrendingDown,
    Scale,
    Users,
    X,
    ExternalLink,
    ChevronRight,
    Play
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

export default function WidgetView({ initialRecinto, color = "10b981", allAuctions }: WidgetViewProps) {
    const [recinto, setRecinto] = useState(initialRecinto);
    const [searchDate, setSearchDate] = useState("");
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

    useEffect(() => {
        let filtered = allAuctions;
        if (recinto) {
            filtered = filtered.filter(a => a.recinto.toUpperCase() === recinto.toUpperCase());
        }
        filtered.sort((a, b) => parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime());
        setFilteredAuctions(filtered);
    }, [recinto, allAuctions]);

    const recentAuctionsFromEnd = filteredAuctions.slice(-5);
    const recentAuctions = [...recentAuctionsFromEnd].reverse(); // Keep descending for some logic if needed
    // Actually, looking at the image, 09/07 is Precio 1 and 06/08 is Precio 5. 
    // That's Chronological (ASCENDING).
    const displayAuctions = filteredAuctions.slice(-5).sort((a, b) => parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime());
    const speciesSet = new Set<string>();
    recentAuctions.forEach(a => a.lots.forEach(l => speciesSet.add(l.tipoLote)));
    const speciesList = Array.from(speciesSet).sort();

    const globalStats = useMemo(() => {
        if (!allAuctions.length) return null;
        const totalAnimales = allAuctions.reduce((s, a) => s + a.totalAnimales, 0);
        const totalKilos = allAuctions.reduce((s, a) => s + a.totalKilos, 0);
        const speciesList = Array.from(new Set(allAuctions.flatMap(a => a.lots.map(l => l.tipoLote))));
        const sellers = new Set(allAuctions.flatMap(a => a.lots.map(l => l.vendedor)));

        const agg: Record<string, { w: number, v: number }> = {};
        allAuctions.forEach(a => a.lots.forEach(l => {
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

        return { totalAnimales, totalKilos, totalRemates: allAuctions.length, speciesCount: speciesList.length, sellersCount: sellers.size, maxS, maxP: Math.round(maxP), minS, minP: Math.round(minP) };
    }, [allAuctions]);

    return (
        <div className="font-sans text-sm min-h-screen bg-white selection:bg-slate-200 animate-in fade-in duration-500">
            {/* Top info bar */}
            <div className="bg-[#f2f2f2] px-5 py-2 flex items-center gap-2 text-slate-500 text-xs border-b border-slate-200">
                <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">i</div>
                Los precios mostrados corresponden a animales rematados al peso
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white z-20 border-b border-slate-200 p-4 space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="dd/mm/aaaa"
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="pl-3 pr-10 py-2 border border-slate-300 rounded-md text-slate-700 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                        <CalendarIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <Button
                        style={{ backgroundColor: primaryColor }}
                        className="h-9 px-4 rounded-md text-white font-bold text-xs flex items-center gap-2 hover:opacity-90"
                    >
                        <Search className="w-3.5 h-3.5" /> Buscar
                    </Button>

                    <div className="relative">
                        <select
                            value={recinto || ""}
                            onChange={(e) => setRecinto(e.target.value)}
                            className="pl-3 pr-8 py-2 border border-slate-300 rounded-md text-slate-700 text-xs bg-white focus:outline-none appearance-none min-w-[150px]"
                        >
                            <option value="">Todos los recintos</option>
                            {availableRecintos.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <ChevronRight className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>

                    <EmbedTrendModal auctions={allAuctions} primaryColor={primaryColor} />
                    <EmbedStatsModal auctions={allAuctions} gStats={globalStats} primaryColor={primaryColor} />
                </div>


            </div>

            {/* Table */}
            <div className="p-4 sm:p-8">
                {recentAuctions.length === 0 ? (
                    <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner group">
                        <Search className="w-16 h-16 text-slate-100 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" />
                        <p className="text-slate-400 font-bold text-lg">No hay registros para mostrar</p>
                        <p className="text-slate-300 text-sm mt-1">Intenta ajustando el filtro de recinto.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto overflow-y-hidden">
                            <table className="w-full border-collapse min-w-[800px]">
                                <thead>
                                    <tr style={{ backgroundColor: primaryColor }} className="text-white">
                                        <th className="p-3 text-left font-bold text-sm tracking-wide sticky left-0 z-10" style={{ backgroundColor: primaryColor }}>Especie</th>
                                        {displayAuctions.map((a, idx) => (
                                            <th key={a.id} className="p-3 text-center font-bold text-xs border-l border-white/10">
                                                <div className="opacity-90">Precio {idx + 1}</div>
                                                <div className="text-[10px] mt-0.5 opacity-70 font-medium">{a.fecha}</div>
                                            </th>
                                        ))}
                                        <th className="p-3 text-center font-bold text-sm border-l border-white/10 sticky right-0 z-10 uppercase tracking-tighter" style={{ backgroundColor: primaryColor }}>Promedio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {speciesList.map((sp, idx) => {
                                        const rowPrices = displayAuctions.map(a => {
                                            const lots = a.lots.filter(l => l.tipoLote === sp);
                                            if (!lots.length) return null;
                                            const totalW = lots.reduce((acc, l) => acc + l.peso, 0);
                                            const totalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
                                            return totalW ? Math.round(totalV / totalW) : 0;
                                        });
                                        const validPrices = rowPrices.filter(p => p !== null) as number[];
                                        const avg = validPrices.length ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

                                        return (
                                            <tr key={sp} className={cn("transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                <td className={cn("p-3 font-bold text-slate-700 text-xs uppercase sticky left-0 z-10 border-r border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                                    {sp}
                                                </td>
                                                {rowPrices.map((p, i) => (
                                                    <td key={i} className="p-3 text-center text-slate-600 text-xs tabular-nums border-r border-slate-100">
                                                        {p ? formatCurrency(p) : "—"}
                                                    </td>
                                                ))}
                                                <td
                                                    className={cn("p-3 text-center font-bold text-sm tabular-nums sticky right-0 z-10", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}
                                                    style={{ color: primaryColor }}
                                                >
                                                    {formatCurrency(avg)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function EmbedTrendModal({ auctions, primaryColor }: { auctions: Auction[], primaryColor: string }) {
    const species = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const trendData = useMemo(() => {
        return months.map((m, idx) => {
            const data: any = { month: m };
            species.forEach(sp => {
                const relevant = auctions.filter(a => parseDate(a.fecha).getMonth() === idx);
                if (relevant.length) {
                    const totalW = relevant.reduce((sum, a) => sum + a.lots.filter(l => l.tipoLote === sp).reduce((s, l) => s + l.peso, 0), 0);
                    const totalV = relevant.reduce((sum, a) => sum + a.lots.filter(l => l.tipoLote === sp).reduce((s, l) => s + (l.peso * l.precio), 0), 0);
                    data[sp] = totalW ? Math.round(totalV / totalW) : null;
                }
            });
            return data;
        });
    }, [auctions, species]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 gap-2 h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                    <TrendingUp className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Ver Tendencia Anual</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl rounded-[3rem] p-0 border-none shadow-3xl overflow-hidden">
                <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-3xl font-black tracking-tight">Evolución Anual</DialogTitle>
                        <p className="text-slate-400 font-medium mt-1">Variación histórica de precios por especie</p>
                    </div>
                    <LineChartIcon className="w-16 h-16 text-white/10" />
                </div>
                <div className="p-10 bg-white">
                    <div className="h-[450px] w-full bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                    formatter={(v) => formatCurrency(v as number)}
                                />
                                {species.map((sp, i) => (
                                    <Line key={sp} type="monotone" dataKey={sp} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={4} dot={{ r: 5, strokeWidth: 3, fill: '#fff' }} connectNulls />
                                ))}
                                <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '11px', fontWeight: 'bold' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EmbedStatsModal({ auctions, gStats, primaryColor }: { auctions: Auction[], gStats: any, primaryColor: string }) {
    if (!gStats) return null;
    const species = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();
    const bySpeciesData = species.map(sp => {
        const lots = auctions.flatMap(a => a.lots.filter(l => l.tipoLote === sp));
        const totalW = lots.reduce((s, l) => s + l.peso, 0);
        const totalV = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
        return { name: sp, value: lots.reduce((s, l) => s + l.cantidad, 0), promedio: Math.round(totalV / totalW) };
    }).sort((a, b) => b.value - a.value);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 gap-2 h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                    <BarChart3 className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Ver Estadísticas</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl p-0 rounded-[3rem] border-none shadow-3xl overflow-hidden">
                <div className="bg-emerald-600 p-10 text-white flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-3xl font-black tracking-tight">Métricas del Mercado</DialogTitle>
                        <p className="text-emerald-50 font-medium mt-1">Resumen del volumen y flujo por especie</p>
                    </div>
                </div>
                <Tabs defaultValue="generales" className="w-full">
                    <div className="px-10 border-b border-slate-100 bg-white">
                        <TabsList className="bg-transparent h-16 gap-10">
                            <TabsTrigger value="generales" className="rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest text-slate-300 data-[state=active]:text-slate-900 transition-all">Generales</TabsTrigger>
                            <TabsTrigger value="especie" className="rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest text-slate-300 data-[state=active]:text-slate-900 transition-all">Por Especie</TabsTrigger>
                            <TabsTrigger value="vendedores" className="rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest text-slate-300 data-[state=active]:text-slate-900 transition-all">Top Vendedores</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="p-10 bg-slate-50/50 max-h-[65vh] overflow-y-auto custom-scrollbar">
                        <TabsContent value="generales" className="mt-0 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <StatBox label="Animales" val={gStats.totalAnimales.toLocaleString()} icon={Users} color="green" />
                                <StatBox label="Toneladas" val={(gStats.totalKilos / 1000).toFixed(1) + "t"} icon={Scale} color="blue" />
                                <StatBox label="Especies" val={gStats.speciesCount} icon={BarChart3} color="orange" />
                                <StatBox label="Remates" val={gStats.totalRemates} icon={CalendarIcon} color="purple" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 group">
                                    <p className="text-emerald-600 font-black mb-1 flex items-center gap-2 uppercase tracking-widest text-[10px]"><TrendingUp className="w-4 h-4" /> Mayor Precio Promedio</p>
                                    <h4 className="text-5xl font-black text-slate-900 group-hover:scale-105 transition-transform duration-500 origin-left">{formatCurrency(gStats.maxP)}</h4>
                                    <p className="text-slate-400 font-bold uppercase mt-3 tracking-widest text-xs">{gStats.maxS}</p>
                                </div>
                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 group">
                                    <p className="text-red-500 font-black mb-1 flex items-center gap-2 uppercase tracking-widest text-[10px]"><TrendingDown className="w-4 h-4" /> Menor Precio Promedio</p>
                                    <h4 className="text-5xl font-black text-slate-900 group-hover:scale-105 transition-transform duration-500 origin-left">{formatCurrency(gStats.minP)}</h4>
                                    <p className="text-slate-400 font-bold uppercase mt-3 tracking-widest text-xs">{gStats.minS}</p>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="especie" className="mt-0 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                                <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight">Volumen Histórico por Especie</h4>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bySpeciesData} layout="vertical" margin={{ left: 50 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} width={120} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="value" fill="#10b981" radius={[0, 10, 10, 0]} barSize={25} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="vendedores" className="mt-0 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                                <h4 className="text-xl font-black text-slate-900 mb-10 tracking-tight">Top 10 Vendedores (Cantidad)</h4>
                                <div className="h-[450px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(() => {
                                            const sellers: Record<string, number> = {};
                                            auctions.forEach(a => a.lots.forEach(l => sellers[l.vendedor] = (sellers[l.vendedor] || 0) + l.cantidad));
                                            return Object.entries(sellers).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
                                        })()} layout="vertical" margin={{ left: 80 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} width={160} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={20}>
                                                {bySpeciesData.map((_, index) => <Cell key={index} fillOpacity={1 - (index * 0.05)} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function StatBox({ label, val, icon: Icon, color }: any) {
    const colors: any = {
        green: "text-emerald-500 bg-emerald-50",
        blue: "text-blue-500 bg-blue-50",
        orange: "text-orange-500 bg-orange-50",
        purple: "text-purple-500 bg-purple-50"
    };
    return (
        <div className="bg-white p-7 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center space-y-3 group hover:translate-y-[-5px] transition-all shadow-sm hover:shadow-xl">
            <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 shadow-sm", colors[color])}>
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{label}</p>
                <h4 className="text-2xl font-black text-slate-800">{val}</h4>
            </div>
        </div>
    );
}
