"use client";

import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Auction, Lot } from '@/types';
import {
    MapPin,
    Calendar as CalendarIcon,
    Search,
    BarChart3,
    LineChart as TrendingIcon,
    Info,
    TrendingUp,
    TrendingDown,
    Users,
    Scale,
    Hash,
    ArrowUpDown,
    Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, parseDate, formatCurrency } from '@/lib/utils';

interface AnalysisViewProps {
    auctions: Auction[];
    selectedAuctionId: string | null;
    onSelectAuction: (id: string) => void;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#f97316', '#6366f1', '#14b8a6'];

export default function AnalysisView({ auctions, selectedAuctionId, onSelectAuction }: AnalysisViewProps) {
    const [filterRecinto, setFilterRecinto] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const filteredAuctions = useMemo(() => {
        let filtered = [...auctions].sort((a, b) => parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime());
        if (filterRecinto !== "all") {
            filtered = filtered.filter(a => a.recinto.toUpperCase() === filterRecinto.toUpperCase());
        }
        return filtered;
    }, [auctions, filterRecinto]);

    const recent5 = filteredAuctions.slice(0, 5).reverse();
    const allSpecies = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();

    const getPriceData = (species: string, auction: Auction) => {
        const lots = auction.lots.filter(l => l.tipoLote === species);
        if (!lots.length) return null;
        const totalW = lots.reduce((acc, l) => acc + l.peso, 0);
        const totalV = lots.reduce((acc, l) => acc + (l.peso * l.precio), 0);
        return totalW ? Math.round(totalV / totalW) : 0;
    };

    const gStats = useMemo(() => {
        if (!auctions.length) return null;
        const totalAnimales = auctions.reduce((acc, a) => acc + a.totalAnimales, 0);
        const totalKilos = auctions.reduce((acc, a) => acc + a.totalKilos, 0);
        const speciesSet = new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)));
        const sellerSet = new Set(auctions.flatMap(a => a.lots.map(l => l.vendedor)));

        let maxP = -1; let maxS = "";
        let minP = Infinity; let minS = "";

        const speciesAgg: Record<string, { w: number, v: number }> = {};
        auctions.forEach(a => a.lots.forEach(l => {
            if (!speciesAgg[l.tipoLote]) speciesAgg[l.tipoLote] = { w: 0, v: 0 };
            speciesAgg[l.tipoLote].w += l.peso;
            speciesAgg[l.tipoLote].v += (l.peso * l.precio);
        }));

        Object.entries(speciesAgg).forEach(([name, data]) => {
            const avg = data.v / data.w;
            if (avg > maxP) { maxP = avg; maxS = name; }
            if (avg < minP) { minP = avg; minS = name; }
        });

        return { totalAnimales, totalKilos, totalRemates: auctions.length, totalSpecies: speciesSet.size, totalSellers: sellerSet.size, maxS, maxP: Math.round(maxP), minS, minP: Math.round(minP) };
    }, [auctions]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Content */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Análisis Comparativo</h2>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-500" /> Comparativa de precios históricos al peso (KG)
                    </p>
                </div>
                <div className="flex gap-3">
                    <TrendModal auctions={auctions} />
                    <StatsModal auctions={auctions} gStats={gStats} />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-wrap items-center gap-4">
                <div className="relative group flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar especie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <select
                        value={filterRecinto}
                        onChange={(e) => setFilterRecinto(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="all">Todos los recintos</option>
                        {Array.from(new Set(auctions.map(a => a.recinto))).map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>

                <Button variant="outline" className="h-12 px-6 rounded-2xl border-slate-200 font-bold hover:bg-slate-50">
                    <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-emerald-600 text-white">
                                <th className="p-6 font-black text-[10px] uppercase tracking-[0.2em] w-[220px]">Especie</th>
                                {recent5.map((a, idx) => (
                                    <th key={a.id} className="p-6 text-center border-l border-white/10 min-w-[140px]">
                                        <div className="text-[9px] opacity-70 font-black uppercase tracking-tighter mb-1">Muestra {idx + 1}</div>
                                        <div className="text-xs font-black tracking-tight">{a.fecha}</div>
                                        <div className="text-[9px] font-bold opacity-50 uppercase mt-0.5">{a.recinto}</div>
                                    </th>
                                ))}
                                <th className="p-6 text-center font-black bg-emerald-700 w-[180px]">PROMEDIO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allSpecies
                                .filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((species) => {
                                    const prices = recent5.map(a => getPriceData(species, a));
                                    const valid = prices.filter(p => p !== null) as number[];
                                    if (!valid.length) return null;
                                    const avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);

                                    return (
                                        <tr key={species} className="hover:bg-emerald-50/30 transition-colors group">
                                            <td className="p-6 font-bold text-slate-800 uppercase text-xs tracking-wide group-hover:text-emerald-700 transition-colors">{species}</td>
                                            {prices.map((p, i) => (
                                                <td key={i} className="p-6 text-center text-slate-500 tabular-nums border-l border-slate-50/50">
                                                    {p ? (
                                                        <span className="font-semibold text-slate-700">{formatCurrency(p)}</span>
                                                    ) : (
                                                        <span className="text-slate-200">—</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="p-6 text-center bg-slate-50/40 group-hover:bg-emerald-50/50 transition-colors">
                                                <span className="text-lg font-black text-emerald-600 tabular-nums">
                                                    {formatCurrency(avg)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
                {allSpecies.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <div className="p-20 text-center animate-in zoom-in-95 duration-300">
                        <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-slate-400">No se encontraron especies</h4>
                        <p className="text-slate-300 text-sm">Intenta ajustar tu búsqueda o filtros.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TrendModal({ auctions }: { auctions: Auction[] }) {
    const species = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();
    const [selectedRecinto, setSelectedRecinto] = useState("all");

    const trendData = useMemo(() => {
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return months.map((m, idx) => {
            const data: any = { month: m };
            species.forEach(sp => {
                const relevantAuctions = auctions.filter(a => {
                    const d = parseDate(a.fecha);
                    return d.getMonth() === idx && (selectedRecinto === "all" || a.recinto === selectedRecinto);
                });
                if (relevantAuctions.length) {
                    const totalW = relevantAuctions.reduce((sum, a) => sum + a.lots.filter(l => l.tipoLote === sp).reduce((s, l) => s + l.peso, 0), 0);
                    const totalV = relevantAuctions.reduce((sum, a) => sum + a.lots.filter(l => l.tipoLote === sp).reduce((s, l) => s + (l.peso * l.precio), 0), 0);
                    data[sp] = totalW ? Math.round(totalV / totalW) : null;
                }
            });
            return data;
        });
    }, [auctions, species, selectedRecinto]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="h-14 px-8 rounded-2xl bg-slate-900 border-none hover:bg-black text-white font-black shadow-xl shadow-slate-200 transition-all active:scale-95 gap-2">
                    <TrendingIcon className="w-5 h-5 text-emerald-400" /> Tendencia Anual
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
                <div className="bg-slate-900 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                    <DialogHeader>
                        <DialogTitle className="text-3xl font-black text-white tracking-tight">Evolución del Mercado</DialogTitle>
                        <p className="text-slate-400 font-medium">Histórico de precios promedio mensuales por especie</p>
                    </DialogHeader>
                </div>
                <div className="p-8 space-y-6">
                    <div className="flex gap-4">
                        <select
                            value={selectedRecinto}
                            onChange={e => setSelectedRecinto(e.target.value)}
                            className="h-12 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                        >
                            <option value="all">Todos los recintos</option>
                            {Array.from(new Set(auctions.map(a => a.recinto))).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="h-[500px] w-full bg-slate-100/30 rounded-[2rem] p-8 border border-slate-100/50">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                    formatter={(v) => formatCurrency(v as number)}
                                />
                                {species.map((sp, idx) => (
                                    <Line
                                        key={sp}
                                        type="monotone"
                                        dataKey={sp}
                                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                        strokeWidth={4}
                                        dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                                        activeDot={{ r: 8, strokeWidth: 4 }}
                                        connectNulls
                                    />
                                ))}
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '11px', fontWeight: 'bold' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatsModal({ auctions, gStats }: { auctions: Auction[], gStats: any }) {
    if (!gStats) return null;
    const species = Array.from(new Set(auctions.flatMap(a => a.lots.map(l => l.tipoLote)))).sort();
    const recintos = Array.from(new Set(auctions.map(a => a.recinto))).sort();

    const bySpeciesData = useMemo(() => {
        return species.map(sp => {
            const lots = auctions.flatMap(a => a.lots.filter(l => l.tipoLote === sp));
            const count = lots.reduce((s, l) => s + l.cantidad, 0);
            const totalW = lots.reduce((s, l) => s + l.peso, 0);
            const totalV = lots.reduce((s, l) => s + (l.peso * l.precio), 0);
            const prices = lots.map(l => l.precio);
            return {
                name: sp,
                value: count,
                promedio: Math.round(totalV / totalW),
                min: Math.min(...prices),
                max: Math.max(...prices)
            };
        }).sort((a, b) => b.value - a.value);
    }, [auctions, species]);

    const byRecintoData = useMemo(() => {
        return recintos.map(r => ({
            name: r,
            value: auctions.filter(a => a.recinto === r).reduce((s, a) => s + a.totalAnimales, 0)
        }));
    }, [auctions, recintos]);

    const topSellers = useMemo(() => {
        const sellers: Record<string, number> = {};
        auctions.forEach(a => a.lots.forEach(l => {
            sellers[l.vendedor] = (sellers[l.vendedor] || 0) + l.cantidad;
        }));
        return Object.entries(sellers).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    }, [auctions]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="h-14 px-8 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black shadow-xl shadow-slate-200/50 transition-all active:scale-95 gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" /> Ver Estadísticas
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
                <div className="bg-emerald-600 p-8 text-white relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500" />
                    <div className="relative z-10">
                        <DialogTitle className="text-3xl font-black text-white tracking-tight">Centro de Estadísticas</DialogTitle>
                        <p className="text-emerald-50 font-medium">Panorámica general del flujo ganadero</p>
                    </div>
                </div>

                <Tabs defaultValue="generales" className="w-full">
                    <div className="px-8 border-b border-slate-100 bg-white">
                        <TabsList className="bg-transparent h-16 gap-10">
                            {[
                                { id: "generales", label: "KPIs Globales" },
                                { id: "especie", label: "Por Especie" },
                                { id: "recinto", label: "Por Recinto" },
                                { id: "vendedores", label: "Consignatarios" }
                            ].map(t => (
                                <TabsTrigger
                                    key={t.id}
                                    value={t.id}
                                    className="rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent font-black uppercase text-[11px] tracking-widest text-slate-400 data-[state=active]:text-slate-900 transition-all"
                                >
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="p-8 bg-slate-50/30 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <TabsContent value="generales" className="mt-0 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                {[
                                    { label: "Animales", val: gStats.totalAnimales.toLocaleString(), icon: Users },
                                    { label: "Toneladas", val: (gStats.totalKilos / 1000).toFixed(1) + "t", icon: Scale },
                                    { label: "Remates", val: gStats.totalRemates, icon: BarChart3 },
                                    { label: "Especies", val: gStats.totalSpecies, icon: Hash },
                                    { label: "Vendedores", val: gStats.totalSellers, icon: Users },
                                ].map((kpi, i) => (
                                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-2 group hover:translate-y-[-4px] transition-all">
                                        <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors"><kpi.icon className="w-6 h-6" /></div>
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{kpi.label}</p>
                                        <h4 className="text-2xl font-black text-slate-800">{kpi.val}</h4>
                                    </div>
                                ))}
                            </div>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={120} /></div>
                                    <div className="flex items-center gap-3 text-emerald-600 font-black mb-4 uppercase text-xs tracking-widest">
                                        <TrendingUp className="w-5 h-5" /> Mayor Precio Promedio
                                    </div>
                                    <h4 className="text-5xl font-black text-slate-800 tracking-tight">{formatCurrency(gStats.maxP)}</h4>
                                    <p className="text-slate-400 font-bold uppercase mt-3 tracking-widest text-sm">{gStats.maxS}</p>
                                </div>
                                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group text-right md:text-left">
                                    <div className="absolute top-0 left-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={120} /></div>
                                    <div className="flex items-center justify-end md:justify-start gap-3 text-red-500 font-black mb-4 uppercase text-xs tracking-widest">
                                        <TrendingDown className="w-5 h-5" /> Menor Precio Promedio
                                    </div>
                                    <h4 className="text-5xl font-black text-slate-800 tracking-tight">{formatCurrency(gStats.minP)}</h4>
                                    <p className="text-slate-400 font-bold uppercase mt-3 tracking-widest text-sm">{gStats.minS}</p>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="especie" className="mt-0 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                                <h4 className="text-lg font-black text-slate-800 mb-8 px-2 tracking-tight">Volumetria por Especie</h4>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bySpeciesData} layout="vertical" margin={{ left: 80 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} width={120} />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} barSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                                <h4 className="text-lg font-black text-slate-800 mb-8 px-2 tracking-tight">Rangos de Precio (Min / Promedio / Max)</h4>
                                <div className="h-[500px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bySpeciesData} layout="vertical" margin={{ left: 80 }}>
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={120} />
                                            <Tooltip formatter={(v) => formatCurrency(v as number)} />
                                            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                                            <Bar dataKey="min" fill="#cbd5e1" radius={[0, 4, 4, 0]} name="Mínimo" />
                                            <Bar dataKey="promedio" fill="#10b981" radius={[0, 4, 4, 0]} name="Promedio" />
                                            <Bar dataKey="max" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Máximo" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="recinto" className="mt-0 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {byRecintoData.map((r, i) => (
                                    <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col gap-4 group hover:translate-y-[-8px] transition-all">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{r.name}</p>
                                            <h4 className="text-4xl font-black text-slate-800">{r.value.toLocaleString()}</h4>
                                            <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase">animales movidos</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="vendedores" className="mt-0 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                                <h4 className="text-lg font-black text-slate-800 mb-8 px-2 tracking-tight">Top 10 Consignatarios (Volumen)</h4>
                                <div className="h-[500px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topSellers} layout="vertical" margin={{ left: 100 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} width={180} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="value" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={25}>
                                                {topSellers.map((entry, index) => (
                                                    <Cell key={index} fillOpacity={1 - (index * 0.08)} />
                                                ))}
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
