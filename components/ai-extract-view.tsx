"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
    Sparkles,
    Loader2,
    ImagePlus,
    Save,
    Trash2,
    X,
    Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CANONICAL_RECINTOS, CANONICAL_SPECIES } from "@/lib/auction-schema";
import type { Lot, TipoLoteSummary } from "@/types";

interface Extraction {
    recinto: string;
    fecha: string;
    totalAnimales: number;
    totalKilos: number;
    totalVista: number | null;
    summaries: TipoLoteSummary[];
    lots: Lot[];
}

export default function AiExtractView({ onSaved }: { onSaved: () => void }) {
    const [text, setText] = useState("");
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [extraction, setExtraction] = useState<Extraction | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const onPickImage = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Selecciona un archivo de imagen");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setImageDataUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleExtract = async () => {
        if (!text.trim() && !imageDataUrl) {
            toast.error("Pega texto o sube una imagen");
            return;
        }
        setExtracting(true);
        try {
            const res = await fetch("/api/auctions/ai-extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: text.trim() || undefined,
                    imageDataUrl: imageDataUrl || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Error al extraer");
                return;
            }
            const ex = data.extraction as Extraction;
            setExtraction({
                recinto: (ex.recinto || "").toUpperCase(),
                fecha: ex.fecha || "",
                totalAnimales: Number(ex.totalAnimales || 0),
                totalKilos: Number(ex.totalKilos || 0),
                totalVista: ex.totalVista ?? null,
                summaries: Array.isArray(ex.summaries) ? ex.summaries : [],
                lots: Array.isArray(ex.lots) ? ex.lots : [],
            });
            toast.success("Extracción lista. Revisa y guarda.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error de conexión");
        } finally {
            setExtracting(false);
        }
    };

    const handleSave = async () => {
        if (!extraction) return;
        if (!extraction.recinto || !extraction.fecha) {
            toast.error("Recinto y fecha son obligatorios");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/auctions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(extraction),
            });
            const data = await res.json();
            if (res.status === 409 && data.duplicate) {
                toast.error(data.error || "Remate duplicado");
                return;
            }
            if (!res.ok) {
                toast.error(data.error || "Error al guardar");
                return;
            }
            toast.success("Remate guardado");
            setExtraction(null);
            setText("");
            setImageDataUrl(null);
            if (fileRef.current) fileRef.current.value = "";
            onSaved();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof Extraction>(k: K, v: Extraction[K]) => {
        setExtraction((prev) => (prev ? { ...prev, [k]: v } : prev));
    };

    const updateSummary = (idx: number, patch: Partial<TipoLoteSummary>) => {
        setExtraction((prev) => {
            if (!prev) return prev;
            const next = [...prev.summaries];
            next[idx] = { ...next[idx], ...patch };
            return { ...prev, summaries: next };
        });
    };

    const removeSummary = (idx: number) => {
        setExtraction((prev) => {
            if (!prev) return prev;
            return { ...prev, summaries: prev.summaries.filter((_, i) => i !== idx) };
        });
    };

    const updateLot = (idx: number, patch: Partial<Lot>) => {
        setExtraction((prev) => {
            if (!prev) return prev;
            const next = [...prev.lots];
            next[idx] = { ...next[idx], ...patch };
            return { ...prev, lots: next };
        });
    };

    const removeLot = (idx: number) => {
        setExtraction((prev) => {
            if (!prev) return prev;
            return { ...prev, lots: prev.lots.filter((_, i) => i !== idx) };
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Extracción con IA</h3>
                        <p className="text-slate-400">
                            Pega el texto del informe o sube una foto. La IA identifica el recinto y completa todos los campos.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Texto del informe
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Pega aquí el texto del remate (recinto, fecha, lotes, vendedores, precios...)"
                            className="w-full h-56 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Imagen del informe
                        </label>
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onPickImage(e.dataTransfer.files?.[0] || null);
                            }}
                            className="relative border-2 border-dashed border-slate-200 rounded-2xl h-56 flex items-center justify-center overflow-hidden hover:border-purple-400 transition-colors"
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {imageDataUrl ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={imageDataUrl}
                                        alt="preview"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageDataUrl(null);
                                            if (fileRef.current) fileRef.current.value = "";
                                        }}
                                        className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow hover:bg-red-50 text-red-500 z-10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center px-4">
                                    <ImagePlus className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-500">Arrastra o haz clic para subir</p>
                                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Button
                    onClick={handleExtract}
                    disabled={extracting || (!text.trim() && !imageDataUrl)}
                    className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold h-14 rounded-2xl shadow-lg shadow-purple-100"
                >
                    {extracting ? (
                        <Loader2 className="animate-spin mr-2" />
                    ) : (
                        <Wand2 className="mr-2 w-5 h-5" />
                    )}
                    {extracting ? "Extrayendo..." : "Extraer con IA"}
                </Button>
            </div>

            {extraction && (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 underline decoration-purple-500 underline-offset-4 decoration-2">
                            Revisa y edita antes de guardar
                        </h3>
                        <button
                            onClick={() => setExtraction(null)}
                            className="text-slate-300 hover:text-red-500"
                            title="Descartar extracción"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recinto</label>
                            <select
                                value={extraction.recinto}
                                onChange={(e) => updateField("recinto", e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                            >
                                <option value="">— Seleccionar —</option>
                                {CANONICAL_RECINTOS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                                {extraction.recinto && !(CANONICAL_RECINTOS as readonly string[]).includes(extraction.recinto) && (
                                    <option value={extraction.recinto}>{extraction.recinto}</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha (DD/MM/YY)</label>
                            <input
                                value={extraction.fecha}
                                onChange={(e) => updateField("fecha", e.target.value)}
                                placeholder="03/02/26"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total animales</label>
                            <input
                                type="number"
                                value={extraction.totalAnimales}
                                onChange={(e) => updateField("totalAnimales", Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total kilos</label>
                            <input
                                type="number"
                                value={extraction.totalKilos}
                                onChange={(e) => updateField("totalKilos", Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a la vista</label>
                            <input
                                type="number"
                                value={extraction.totalVista ?? ""}
                                onChange={(e) =>
                                    updateField(
                                        "totalVista",
                                        e.target.value === "" ? null : Number(e.target.value)
                                    )
                                }
                                placeholder="opcional"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700">
                            Resúmenes por categoría ({extraction.summaries.length})
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest">
                                    <tr>
                                        <th className="p-2 text-left">Categoría</th>
                                        <th className="p-2 text-right">Cant.</th>
                                        <th className="p-2 text-right">Peso</th>
                                        <th className="p-2 text-right">PP Total</th>
                                        <th className="p-2 text-right">Cant. 5pp</th>
                                        <th className="p-2 text-right">Peso 5pp</th>
                                        <th className="p-2 text-right">PP 5pp</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {extraction.summaries.map((s, i) => (
                                        <tr key={i}>
                                            <td className="p-1">
                                                <select
                                                    value={s.descripcion}
                                                    onChange={(e) => updateSummary(i, { descripcion: e.target.value })}
                                                    className="w-full px-2 py-1 bg-white border border-slate-100 rounded"
                                                >
                                                    {CANONICAL_SPECIES.map((sp) => (
                                                        <option key={sp} value={sp}>{sp}</option>
                                                    ))}
                                                    {!(CANONICAL_SPECIES as readonly string[]).includes(s.descripcion) && (
                                                        <option value={s.descripcion}>{s.descripcion}</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.cantidadtotal}
                                                    onChange={(e) => updateSummary(i, { cantidadtotal: Number(e.target.value) })}
                                                    className="w-20 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.pesototal}
                                                    onChange={(e) => updateSummary(i, { pesototal: Number(e.target.value) })}
                                                    className="w-24 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.pptotal}
                                                    onChange={(e) => updateSummary(i, { pptotal: Number(e.target.value) })}
                                                    className="w-24 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.cantidad5pp ?? ""}
                                                    onChange={(e) => updateSummary(i, { cantidad5pp: e.target.value === "" ? undefined : Number(e.target.value) })}
                                                    className="w-20 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.peso5pp ?? ""}
                                                    onChange={(e) => updateSummary(i, { peso5pp: e.target.value === "" ? undefined : Number(e.target.value) })}
                                                    className="w-24 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={s.pp5pp ?? ""}
                                                    onChange={(e) => updateSummary(i, { pp5pp: e.target.value === "" ? undefined : Number(e.target.value) })}
                                                    className="w-24 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button onClick={() => removeSummary(i)} className="p-1 text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {extraction.summaries.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-3 text-center text-slate-400 italic">Sin resúmenes</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700">
                            Lotes individuales ({extraction.lots.length})
                        </h4>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-widest sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">#</th>
                                        <th className="p-2 text-left">Categoría</th>
                                        <th className="p-2 text-right">Cant.</th>
                                        <th className="p-2 text-right">Peso</th>
                                        <th className="p-2 text-right">Precio</th>
                                        <th className="p-2 text-left">Vendedor</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {extraction.lots.map((l, i) => (
                                        <tr key={i}>
                                            <td className="p-1">
                                                <input type="number" value={l.numeroLote}
                                                    onChange={(e) => updateLot(i, { numeroLote: Number(e.target.value) })}
                                                    className="w-14 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <select value={l.tipoLote}
                                                    onChange={(e) => updateLot(i, { tipoLote: e.target.value })}
                                                    className="w-full px-2 py-1 bg-white border border-slate-100 rounded">
                                                    {CANONICAL_SPECIES.map((sp) => (
                                                        <option key={sp} value={sp}>{sp}</option>
                                                    ))}
                                                    {!(CANONICAL_SPECIES as readonly string[]).includes(l.tipoLote) && (
                                                        <option value={l.tipoLote}>{l.tipoLote}</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={l.cantidad}
                                                    onChange={(e) => updateLot(i, { cantidad: Number(e.target.value) })}
                                                    className="w-16 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={l.peso}
                                                    onChange={(e) => updateLot(i, { peso: Number(e.target.value) })}
                                                    className="w-20 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input type="number" value={l.precio}
                                                    onChange={(e) => updateLot(i, { precio: Number(e.target.value) })}
                                                    className="w-20 px-2 py-1 bg-white border border-slate-100 rounded text-right" />
                                            </td>
                                            <td className="p-1">
                                                <input value={l.vendedor}
                                                    onChange={(e) => updateLot(i, { vendedor: e.target.value })}
                                                    className="w-full min-w-[200px] px-2 py-1 bg-white border border-slate-100 rounded" />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button onClick={() => removeLot(i)} className="p-1 text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {extraction.lots.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-3 text-center text-slate-400 italic">Sin lotes</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className={cn(
                            "w-full bg-green-600 hover:bg-green-700 text-white font-bold h-14 rounded-2xl shadow-lg shadow-green-100"
                        )}
                    >
                        {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 w-5 h-5" />}
                        {saving ? "Guardando..." : "Guardar Remate"}
                    </Button>
                </div>
            )}
        </div>
    );
}
