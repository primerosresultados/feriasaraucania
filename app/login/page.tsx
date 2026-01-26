"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2, ShieldCheck, Lock } from "lucide-react";
import { toast } from "react-hot-toast";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error(error);
            toast.error("Credenciales incorrectas o usuario no registrado");
            setLoading(false);
        } else {
            toast.success("¡Bienvenido!");
            router.refresh();
            router.push("/insert");
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-green-500/20 mx-auto mb-4">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Acceso Admin</h1>
                    <p className="text-slate-400 mt-2">Sistema de Gestión de Remates Ganaderos</p>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute right-4 top-3.5 w-4 h-4 text-slate-300" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:outline-none transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5 mr-2" /> Iniciar Sesión
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="pt-4 text-center border-t border-slate-100">
                        <p className="text-xs text-slate-400">¿No tienes cuenta? <span className="font-bold">Contacta al administrador</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
