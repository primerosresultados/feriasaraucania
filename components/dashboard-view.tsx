"use client";

import React, { useMemo } from 'react';
import { Auction } from '@/types';
import {
    Users,
    Scale,
    MapPin,
    TrendingUp,
    FileCheck,
    ExternalLink,
    PlusCircle,
    BarChart3,
    Clock,
    ArrowUpRight,
    ShieldCheck,
    Calendar,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseDate, formatCurrency, cn } from '@/lib/utils';

interface DashboardViewProps {
    auctions: Auction[];
    onNavigate: (tab: string) => void;
}

export default function DashboardView({ auctions, onNavigate }: DashboardViewProps) {
    const stats = useMemo(() => {
        if (!auctions.length) return null;

        const totalAnimales = auctions.reduce((s, a) => s + a.totalAnimales, 0);
        const totalKilos = auctions.reduce((s, a) => s + a.totalKilos, 0);
        const totalSellers = new Set(auctions.flatMap(a => a.lots.map(l => l.vendedor))).size;
        const recintos = Array.from(new Set(auctions.map(a => a.recinto))).sort();

        // Latest upload
        const sortedAuctions = [...auctions].sort((a, b) => parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime());
        const latest = sortedAuctions[0];

        // Aggregated species
        const speciesData: Record<string, number> = {};
        auctions.forEach(a => a.lots.forEach(l => {
            speciesData[l.tipoLote] = (speciesData[l.tipoLote] || 0) + l.cantidad;
        }));
        const topSpecies = Object.entries(speciesData).sort((a, b) => b[1] - a[1]).slice(0, 3);

        return { totalAnimales, totalKilos, totalSellers, recintoCount: recintos.length, latest, topSpecies, recintos };
    }, [auctions]);

    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <FileCheck className="w-10 h-10" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">No hay datos todavía</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mt-2">Sube tu primer archivo de remate para comenzar a ver las estadísticas generales.</p>
                </div>
                <Button onClick={() => onNavigate("subir")} className="bg-green-600 hover:bg-green-700 rounded-xl">
                    <PlusCircle className="w-4 h-4 mr-2" /> Subir Primer Archivo
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    label="Total Animales"
                    val={stats.totalAnimales.toLocaleString()}
                    icon={Users}
                    color="green"
                    subtitle="Acumulado histórico"
                />
                <KpiCard
                    label="Toneladas"
                    val={(stats.totalKilos / 1000).toFixed(1) + "t"}
                    icon={Scale}
                    color="blue"
                    subtitle="Movimiento total"
                />
                <KpiCard
                    label="Vendedores"
                    val={stats.totalSellers}
                    icon={ShieldCheck}
                    color="purple"
                    subtitle="Consignatarios únicos"
                />
                <KpiCard
                    label="Sucursales"
                    val={stats.recintoCount}
                    icon={MapPin}
                    color="orange"
                    subtitle="Puntos de remate"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Col: Activity & Recintos */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Latest Upload Card */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group hover:border-green-200 transition-all">
                        <div className="p-6 flex items-center justify-between border-b border-slate-50 bg-slate-50/30">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-green-500" /> Última Actividad
                            </h3>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 bg-white rounded-full border border-slate-100 shadow-sm">
                                Recién actualizado
                            </span>
                        </div>
                        <div className="p-8 flex flex-col md:flex-row gap-10 items-center">
                            <div className="relative shrink-0 group">
                                <div className="absolute inset-0 bg-green-500 blur-2xl opacity-10 group-hover:opacity-20 transition-all rounded-full" />
                                <div className="relative w-28 h-28 bg-gradient-to-br from-green-50 to-emerald-50 rounded-[2.5rem] flex items-center justify-center text-green-600 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                    <FileCheck className="w-12 h-12" />
                                </div>
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-4">
                                <div>
                                    <h4 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">{stats.latest.recinto}</h4>
                                    <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <p className="text-slate-500 font-medium">Remate procesado el <span className="text-slate-800 font-bold">{stats.latest.fecha}</span></p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                    <div className="text-[11px] font-black text-slate-600 bg-slate-100/80 px-4 py-2 rounded-xl backdrop-blur-sm">
                                        {stats.latest.totalAnimales} ANIMALES
                                    </div>
                                    <div className="text-[11px] font-black text-slate-600 bg-slate-100/80 px-4 py-2 rounded-xl backdrop-blur-sm">
                                        {(stats.latest.totalKilos / 1000).toFixed(1)} TONELADAS
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={() => onNavigate("analisis")}
                                className="rounded-2xl h-14 px-8 bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all hover:translate-y-[-2px] active:translate-y-0"
                            >
                                Ver Análisis <ArrowUpRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Recintos Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" /> Cobertura Geográfica
                            </h3>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-2 custom-scrollbar">
                                {stats.recintos.map(r => (
                                    <div key={r} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-colors group">
                                        <span className="font-bold text-slate-700 uppercase text-xs group-hover:text-blue-600 transition-colors">{r}</span>
                                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg uppercase tracking-wider">Activo</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-orange-500" /> Especies Dominantes
                            </h3>
                            <div className="space-y-6">
                                {stats.topSpecies.map(([name, count], i) => (
                                    <div key={name} className="flex items-center gap-5">
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <div className="text-2xl font-black text-slate-100 leading-none">0{i + 1}</div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-[11px] font-black text-slate-700 uppercase mb-2 tracking-wide">
                                                <span>{name}</span>
                                                <span className="text-slate-400">{count} unidades</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                <div
                                                    className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.3)] transition-all duration-1000"
                                                    style={{ width: `${(count / stats.totalAnimales) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Col: System Highlights & Actions */}
                <div className="space-y-8">
                    <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group border border-slate-800">
                        <div className="absolute -right-10 -top-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-[80px] group-hover:bg-emerald-500/30 transition-all duration-700" />
                        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-all duration-700" />

                        <h3 className="text-xl font-bold mb-6 relative z-10 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Estado del Sistema
                        </h3>
                        <div className="space-y-6 relative z-10">
                            <StatusItem label="Procesamiento XML" status="Online" color="green" />
                            <StatusItem label="Widgets Embebidos" status="Activos" color="green" />
                            <StatusItem label="Supabase DB" status="Conectado" color="blue" />
                            <StatusItem label="Seguridad JWT" status="Activada" color="green" />
                        </div>
                        <Button
                            onClick={() => onNavigate("insertar")}
                            className="w-full mt-10 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-2xl h-14 shadow-lg shadow-emerald-500/20 group/btn transition-all active:scale-95"
                        >
                            Configurar Widget <ExternalLink className="ml-2 w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                        </Button>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-purple-500" /> Acciones Rápidas
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <QuickAction icon={PlusCircle} label="Subir" onClick={() => onNavigate("subir")} color="green" />
                            <QuickAction icon={MapPin} label="Sucursales" onClick={() => { }} color="blue" />
                            <QuickAction icon={TrendingUp} label="Tendencias" onClick={() => onNavigate("analisis")} color="orange" />
                            <QuickAction icon={Calendar} label="Historial" onClick={() => onNavigate("historial")} color="purple" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ label, val, icon: Icon, color, subtitle }: any) {
    const variants: any = {
        green: { bg: "bg-emerald-50 text-emerald-600", border: "group-hover:border-emerald-200" },
        blue: { bg: "bg-blue-50 text-blue-600", border: "group-hover:border-blue-200" },
        purple: { bg: "bg-purple-50 text-purple-600", border: "group-hover:border-purple-200" },
        orange: { bg: "bg-orange-50 text-orange-600", border: "group-hover:border-orange-200" },
    };
    return (
        <div className={cn("bg-white p-7 rounded-[2.2rem] border border-slate-50 shadow-xl shadow-slate-200/40 group transition-all hover:shadow-2xl hover:translate-y-[-4px]", variants[color].border)}>
            <div className="flex justify-between items-start mb-5">
                <div className={cn("p-4 rounded-2xl shadow-sm transition-transform group-hover:scale-110", variants[color].bg)}>
                    <Icon className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-300 uppercase tracking-[0.1em] bg-slate-50 px-2 py-1 rounded-lg">
                    <span>Live</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300 animate-pulse" />
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{val}</h4>
                <p className="text-[10px] font-medium text-slate-400 mt-2">{subtitle}</p>
            </div>
        </div>
    );
}

function StatusItem({ label, status, color }: any) {
    const dots: any = {
        green: "bg-emerald-400",
        blue: "bg-blue-400",
        orange: "bg-orange-400",
    };
    return (
        <div className="flex items-center justify-between group/item">
            <span className="text-sm font-medium text-slate-400 group-hover/item:text-slate-300 transition-colors">{label}</span>
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter group-hover/item:text-slate-200 transition-colors">{status}</span>
                <div className="relative flex h-2 w-2">
                    <div className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dots[color])} />
                    <div className={cn("relative inline-flex rounded-full h-2 w-2", dots[color])} />
                </div>
            </div>
        </div>
    );
}

function QuickAction({ icon: Icon, label, onClick, color }: any) {
    const colors: any = {
        green: "text-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-600",
        blue: "text-blue-500 bg-blue-50/50 hover:bg-blue-50 hover:text-blue-600",
        orange: "text-orange-500 bg-orange-50/50 hover:bg-orange-50 hover:text-orange-600",
        purple: "text-purple-500 bg-purple-50/50 hover:bg-purple-50 hover:text-purple-600",
    }
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-5 rounded-2xl transition-all border border-slate-100 hover:border-transparent hover:shadow-lg active:scale-95 group",
                colors[color]
            )}
        >
            <Icon className="w-6 h-6 mb-3 transition-transform group-hover:scale-110" />
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        </button>
    );
}
