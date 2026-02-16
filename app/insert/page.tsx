"use client";

import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Settings,
    Upload as UploadIcon,
    History,
    BarChart3,
    Code2,
    Sun,
    Moon,
    Copy,
    ExternalLink,
    CheckCircle2,
    FileText,
    Loader2,
    LogOut,
    Trash2,
    Radio,
    Play,
    Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "react-hot-toast";
import { Auction } from "@/types";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import AnalysisView from "@/components/analysis-view";
import DashboardView from "@/components/dashboard-view";
import { createBrowserClient } from "@supabase/ssr";
import WidgetView from "@/components/widget-view";

export default function InsertPage() {
    const router = useRouter();
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [mounted, setMounted] = useState(false);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        setMounted(true);
        fetchAuctions();
    }, []);

    const fetchAuctions = async () => {
        try {
            const res = await fetch("/api/auctions");
            const data = await res.json();
            setAuctions(data);
            if (data.length > 0 && !selectedAuctionId) {
                setSelectedAuctionId(data[0].id);
            }
        } catch (err) {
            toast.error("Error cargando datos");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar este remate? Esta acción no se puede deshacer.")) return;

        try {
            const res = await fetch(`/api/auctions?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Remate eliminado correctamente");
                fetchAuctions();
                if (selectedAuctionId === id) setSelectedAuctionId(null);
            } else {
                toast.error("Error al eliminar");
            }
        } catch (err) {
            toast.error("Error de conexión");
        }
    };
    const [activeTab, setActiveTab] = useState("insertar");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpload, setLastUpload] = useState<Auction | null>(null);

    // Widget customization
    const [width, setWidth] = useState("100%");
    const [height, setHeight] = useState("600");
    const [selectedColor, setSelectedColor] = useState("22c55e");
    const [selectedRecinto, setSelectedRecinto] = useState("");

    const colors = [
        { name: "Verde", hex: "22c55e" },
        { name: "Azul", hex: "3b82f6" },
        { name: "Rojo", hex: "ef4444" },
        { name: "Naranja", hex: "f97316" },
        { name: "Amarillo", hex: "eab308" },
        { name: "Púrpura", hex: "8b5cf6" },
        { name: "Rosa", hex: "ec4899" },
        { name: "Cyan", hex: "06b6d4" },
        { name: "Gris", hex: "6b7280" },
        { name: "Negro", hex: "1f2937" },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push("/login");
        toast.success("Sesión cerrada");
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch("/api/auctions", { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) {
                toast.success("¡Remate procesado!");
                setLastUpload(data.auction);
                setSelectedRecinto(data.auction.recinto);
                setFile(null);
                fetchAuctions(); // Refresh data
                setActiveTab("insertar");
            } else {
                toast.error(data.error);
            }
        } catch (err) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const getWidgetUrl = () => {
        // Use relative URL on server and during initial client render to match hydration
        const baseUrl = mounted ? window.location.origin : "";
        let url = `${baseUrl}/embed/prices?color=${selectedColor}`;
        if (selectedRecinto) url += `&recinto=${selectedRecinto}`;
        return url;
    };

    const iframeCode = `<iframe 
  src="${getWidgetUrl()}"
  width="${width}" 
  height="${height}" 
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="Precios de Remates Ganaderos"
></iframe>`;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-800 leading-none">Remates</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Gestión Ganadera</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <p className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navegación</p>
                    {[
                        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                        { id: "precios", label: "Precios", icon: FileText },
                        { id: "subir", label: "Subir Archivo", icon: UploadIcon },
                        { id: "historial", label: "Historial", icon: History },
                        { id: "analisis", label: "Análisis", icon: BarChart3 },
                        { id: "insertar", label: "Insertar", icon: Code2 },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                activeTab === item.id
                                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}

                    {/* Separator */}
                    <div className="my-4 border-t border-slate-100" />
                    <p className="px-2 mb-2 text-[10px] font-bold text-red-400 uppercase tracking-widest">Streaming</p>
                    <button
                        onClick={() => setActiveTab("envivo")}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                            activeTab === "envivo"
                                ? "bg-red-600 text-white shadow-md shadow-red-200"
                                : "text-slate-500 hover:bg-red-50 hover:text-red-600"
                        )}
                    >
                        <Radio className="w-4 h-4" />
                        En Vivo
                        {activeTab === "envivo" && <span className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                        <span>Admin Central</span>
                        <button className="p-2 hover:bg-slate-50 rounded-lg"><Moon className="w-4 h-4" /></button>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                <header className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 capitalize">
                        {activeTab}
                    </h2>
                    <div className="flex items-center gap-4">
                        {auctions.length > 0 && (
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global</p>
                                <p className="text-sm font-black text-slate-700">{auctions.length} Remates Totales</p>
                            </div>
                        )}
                        <Button variant="outline" size="sm" className="bg-white rounded-xl h-10 px-4 border-slate-200">
                            <Sun className="w-4 h-4 mr-2 text-amber-500" /> Tema
                        </Button>
                    </div>
                </header>

                {activeTab === "subir" && (
                    <div className="max-w-2xl bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-green-50 rounded-2xl text-green-600">
                                <UploadIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Carga de Remates</h3>
                                <p className="text-slate-400">Suelta tu archivo XML o CSV para procesarlo automáticamente.</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-6">
                            <div className="relative group border-2 border-dashed border-slate-200 rounded-3xl p-12 hover:border-green-500 hover:bg-green-50/50 transition-all text-center">
                                <input type="file" accept=".xml,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 group-hover:text-green-500 group-hover:bg-green-100 transition-colors">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{file ? file.name : "Selecciona un archivo"}</p>
                                        <p className="text-slate-400 text-sm mt-1">Formatos soportados: XML, CSV</p>
                                    </div>
                                </div>
                            </div>

                            <Button disabled={!file || loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-14 rounded-2xl shadow-lg shadow-green-100">
                                {loading ? <Loader2 className="animate-spin mr-2" /> : <UploadIcon className="mr-2" />}
                                {loading ? "Procesando..." : "Subir Remate"}
                            </Button>
                        </form>
                    </div>
                )}

                {activeTab === "insertar" && (
                    <div className="grid lg:grid-cols-2 gap-8">
                        {/* Customization */}
                        <div className="space-y-8">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                                <h3 className="font-bold text-slate-800 underline decoration-green-500 underline-offset-4 decoration-2">Configuración del Widget</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ancho</label>
                                        <input type="text" value={width} onChange={(e) => setWidth(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alto (px)</label>
                                        <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Color Personalizado</label>
                                    <div className="flex flex-wrap gap-2">
                                        {colors.map(c => (
                                            <button
                                                key={c.hex}
                                                onClick={() => setSelectedColor(c.hex)}
                                                className={cn("w-8 h-8 rounded-lg transition-transform hover:scale-110", selectedColor === c.hex && "ring-2 ring-slate-900 ring-offset-2")}
                                                style={{ backgroundColor: `#${c.hex}` }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={`#${selectedColor}`}
                                            onChange={(e) => setSelectedColor(e.target.value.replace('#', ''))}
                                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-mono text-sm"
                                        />
                                        <div className="w-10 h-10 rounded-xl border border-slate-100" style={{ backgroundColor: `#${selectedColor}` }} />
                                    </div>
                                </div>

                                <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200" onClick={() => window.open(getWidgetUrl(), '_blank')}>
                                    <ExternalLink className="w-4 h-4 mr-2" /> Vista Previa
                                </Button>
                            </div>

                            {/* URL card */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
                                <h3 className="font-bold text-slate-800">URL del Widget</h3>
                                <div className="flex gap-2">
                                    <input readOnly value={getWidgetUrl()} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs overflow-hidden text-ellipsis" />
                                    <Button variant="secondary" onClick={() => copyToClipboard(getWidgetUrl())}><Copy className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        </div>

                        {/* Code Generation */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6 flex flex-col">
                            <h3 className="font-bold text-slate-800 underline decoration-green-500 underline-offset-4 decoration-2">Código para Insertar</h3>
                            <p className="text-sm text-slate-400">Copia y pega este código en tu página web para mostrar el widget.</p>

                            <Tabs defaultValue="iframe" className="flex-1 flex flex-col">
                                <TabsList className="grid grid-cols-2 mb-6">
                                    <TabsTrigger value="iframe">Iframe (Recomendado)</TabsTrigger>
                                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                                </TabsList>

                                <TabsContent value="iframe" className="flex-1 flex flex-col space-y-4">
                                    <div className="flex-1 bg-slate-900 rounded-2xl p-6 font-mono text-[11px] text-green-400 border border-slate-800 relative group">
                                        <pre className="whitespace-pre-wrap leading-relaxed">{iframeCode}</pre>
                                    </div>
                                    <Button className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl" onClick={() => copyToClipboard(iframeCode)}>
                                        <Copy className="w-4 h-4 mr-2" /> Copiar Código
                                    </Button>
                                </TabsContent>

                                <TabsContent value="javascript" className="flex-1 flex flex-col space-y-4 text-center py-10 text-slate-400 italic">
                                    Próximamente... Usa el Iframe por ahora.
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Live Preview Section */}
                        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 underline decoration-green-500 underline-offset-4 decoration-2">Vista Previa en Tiempo Real</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Como se verá en tu web</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 min-h-[400px] flex items-center justify-center relative overflow-hidden">
                                {/* Decorative elements to simulate a browser/web context */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                    <div className="w-10 h-1.5 rounded-full bg-slate-200" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                </div>

                                <div
                                    className="bg-white shadow-2xl rounded-2xl overflow-hidden border border-slate-200/60 transition-all duration-500"
                                    style={{
                                        width: width.includes('%') ? width : `${width}px`,
                                        maxWidth: '100%',
                                        margin: '0 auto'
                                    }}
                                >
                                    <iframe
                                        src={getWidgetUrl()}
                                        width="100%"
                                        height={height}
                                        frameBorder="0"
                                        title="Precios de Remates Ganaderos"
                                        key={`${selectedColor}-${selectedRecinto}-${width}-${height}`} // Force refresh on config change
                                        className="transition-opacity duration-300"
                                    ></iframe>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "analisis" && (
                    <AnalysisView
                        auctions={auctions}
                        selectedAuctionId={selectedAuctionId}
                        onSelectAuction={setSelectedAuctionId}
                    />
                )}

                {activeTab === "precios" && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Detalle de Lotes - {auctions.find(a => a.id === selectedAuctionId)?.recinto}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-4">Lote</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Cantidad</th>
                                        <th className="p-4">Peso</th>
                                        <th className="p-4">Precio</th>
                                        <th className="p-4">Vendedor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {auctions.find(a => a.id === selectedAuctionId)?.lots.map((lot, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">#{lot.numeroLote}</td>
                                            <td className="p-4">{lot.tipoLote}</td>
                                            <td className="p-4">{lot.cantidad}</td>
                                            <td className="p-4">{lot.peso} kg</td>
                                            <td className="p-4 font-bold text-green-600">${lot.precio}</td>
                                            <td className="p-4 text-slate-500">{lot.vendedor}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "dashboard" && (
                    <DashboardView
                        auctions={auctions}
                        onNavigate={(tab) => setActiveTab(tab)}
                    />
                )}

                {activeTab === "historial" && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                <tr>
                                    <th className="p-4">Remate</th>
                                    <th className="p-4">Recinto</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4 text-center">Lotes</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {auctions.map((a) => (
                                    <tr key={a.id} className="hover:bg-slate-50/50">
                                        <td className="p-4 font-bold text-slate-800 uppercase text-xs tracking-tighter">REM_{a.id.slice(0, 6)}</td>
                                        <td className="p-4"><span className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-600">{a.recinto}</span></td>
                                        <td className="p-4 text-slate-500 font-medium">{a.fecha}</td>
                                        <td className="p-4 text-center text-slate-500">{a.lots.length}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setSelectedAuctionId(a.id); setActiveTab("analisis"); }}>
                                                    Ver Análisis
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                    onClick={() => handleDelete(a.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === "envivo" && (
                    <LiveStreamSection mounted={mounted} />
                )}
            </main>
        </div>
    );
}

// Live Stream Management Component
interface Stream {
    id: string;
    youtube_url: string;
    title: string;
    is_active: boolean;
    created_at: string;
}


function LiveStreamSection({ mounted }: { mounted: boolean }) {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [title, setTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
    const [width, setWidth] = useState("100%");
    const [height, setHeight] = useState("600");

    const fetchStreams = async () => {
        try {
            const res = await fetch("/api/streams");
            const data = await res.json();
            setStreams(data);
            if (data.length > 0 && !selectedStream) {
                setSelectedStream(data[0]);
            }
        } catch (err) {
            toast.error("Error cargando streams");
        }
    };

    useEffect(() => {
        fetchStreams();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl) return;

        setIsCreating(true);
        try {
            const res = await fetch("/api/streams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ youtube_url: youtubeUrl, title: title || "Remate en Vivo" }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("¡Transmisión creada!");
                setYoutubeUrl("");
                setTitle("");
                fetchStreams();
                setSelectedStream(data);
            } else {
                toast.error(data.error);
            }
        } catch (err) {
            toast.error("Error de conexión");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm("¿Seguro que quieres desactivar esta transmisión?")) return;

        try {
            const res = await fetch(`/api/streams?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Transmisión desactivada");
                fetchStreams();
                if (selectedStream?.id === id) setSelectedStream(null);
            }
        } catch (err) {
            toast.error("Error de conexión");
        }
    };

    const getEmbedUrl = () => {
        if (!selectedStream) return "";
        const baseUrl = mounted ? window.location.origin : "";
        return `${baseUrl}/embed/live?streamId=${selectedStream.id}`;
    };

    const iframeCode = selectedStream
        ? `<iframe 
  src="${getEmbedUrl()}"
  width="${width}" 
  height="${height}" 
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="Remate en Vivo - ${selectedStream.title}"
></iframe>`
        : "";

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    return (
        <div className="space-y-8">
            {/* Create New Stream */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-red-50 rounded-2xl text-red-600">
                        <Radio className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Nueva Transmisión en Vivo</h3>
                        <p className="text-slate-400">Pega el enlace de YouTube para crear una transmisión con chat en vivo.</p>
                    </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título (opcional)</label>
                            <input
                                type="text"
                                placeholder="Remate en Vivo - Temuco"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL de YouTube *</label>
                            <input
                                type="text"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-mono text-sm"
                                required
                            />
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={!youtubeUrl || isCreating}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 rounded-xl"
                    >
                        {isCreating ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 w-4 h-4" />}
                        {isCreating ? "Creando..." : "Crear Transmisión"}
                    </Button>
                </form>
            </div>

            {/* Active Streams */}
            {streams.length > 0 && (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Stream List */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            Transmisiones Activas
                        </h3>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {streams.map((stream) => (
                                <div
                                    key={stream.id}
                                    onClick={() => setSelectedStream(stream)}
                                    className={cn(
                                        "p-4 rounded-2xl border cursor-pointer transition-all",
                                        selectedStream?.id === stream.id
                                            ? "border-red-200 bg-red-50"
                                            : "border-slate-100 hover:border-slate-200"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-800">{stream.title}</p>
                                            <p className="text-xs text-slate-400 mt-1 font-mono truncate max-w-[200px]">
                                                {stream.youtube_url}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl border-red-100 text-red-500 hover:bg-red-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeactivate(stream.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Embed Code */}
                    {selectedStream && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-red-500" />
                                Código para Insertar
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ancho</label>
                                    <input
                                        type="text"
                                        value={width}
                                        onChange={(e) => setWidth(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alto (px)</label>
                                    <input
                                        type="text"
                                        value={height}
                                        onChange={(e) => setHeight(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">URL Directa</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={getEmbedUrl()}
                                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs"
                                    />
                                    <Button variant="secondary" onClick={() => copyToClipboard(getEmbedUrl())}>
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" onClick={() => window.open(getEmbedUrl(), "_blank")}>
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Código Iframe</label>
                                <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-green-400 border border-slate-800">
                                    <pre className="whitespace-pre-wrap leading-relaxed">{iframeCode}</pre>
                                </div>
                                <Button
                                    className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl"
                                    onClick={() => copyToClipboard(iframeCode)}
                                >
                                    <Copy className="w-4 h-4 mr-2" /> Copiar Código
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Live Video Preview - Full Component */}
            {selectedStream && (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 underline decoration-red-500 underline-offset-4 decoration-2 flex items-center gap-2">
                            <Radio className="w-5 h-5 text-red-500" />
                            Vista Previa de Transmisión
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                {selectedStream.title}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-slate-200"
                                onClick={() => window.open(getEmbedUrl(), "_blank")}
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir completo
                            </Button>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                        <iframe
                            src={getEmbedUrl()}
                            width="100%"
                            height="600"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            title={`Preview - ${selectedStream.title}`}
                            className="w-full"
                            key={selectedStream.id}
                        />
                    </div>
                </div>
            )}

            {/* Empty State */}
            {streams.length === 0 && (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                    <Radio className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">No hay transmisiones activas</p>
                    <p className="text-slate-300 text-sm mt-1">Crea una nueva transmisión arriba para comenzar.</p>
                </div>
            )}
        </div>
    );
}
