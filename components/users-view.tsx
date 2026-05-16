"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Users, UserPlus, Trash2, Loader2, KeyRound, Mail, Lock } from "lucide-react";

type AdminUser = {
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
};

export default function UsersView() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [savingPwd, setSavingPwd] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            setUsers(data.users || []);
        } catch (err: any) {
            toast.error(err.message || "Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            toast.error("La contraseña debe tener al menos 8 caracteres");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Usuario creado");
            setEmail("");
            setPassword("");
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (u: AdminUser) => {
        if (!confirm(`¿Eliminar el usuario ${u.email}? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Usuario eliminado");
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleChangePassword = async (id: string) => {
        if (newPassword.length < 8) {
            toast.error("La contraseña debe tener al menos 8 caracteres");
            return;
        }
        setSavingPwd(true);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error");
            toast.success("Contraseña actualizada");
            setEditingId(null);
            setNewPassword("");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSavingPwd(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-green-50 rounded-2xl text-green-600">
                        <UserPlus className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Crear Usuario Administrativo</h3>
                        <p className="text-slate-400 text-sm">El nuevo usuario podrá iniciar sesión en el panel.</p>
                    </div>
                </div>
                <form onSubmit={handleCreate} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-300" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@ejemplo.com"
                            required
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña (mín. 8)"
                            required
                            minLength={8}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-green-500/10 focus:outline-none font-mono text-sm"
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={creating}
                        className="h-12 px-6 bg-slate-900 hover:bg-black text-white rounded-xl font-bold"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" />Crear</>}
                    </Button>
                </form>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Usuarios ({users.length})</h3>
                        <p className="text-slate-400 text-sm">Todos los usuarios con acceso al panel.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                ) : users.length === 0 ? (
                    <p className="py-8 text-center text-slate-400">Sin usuarios.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {users.map((u) => (
                            <div key={u.id} className="py-4">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-800 truncate">{u.email}</p>
                                        <p className="text-xs text-slate-400">
                                            Creado: {new Date(u.created_at).toLocaleDateString('es-CL')} ·{" "}
                                            Último ingreso: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-CL') : 'Nunca'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl"
                                            onClick={() => { setEditingId(editingId === u.id ? null : u.id); setNewPassword(""); }}
                                        >
                                            <KeyRound className="w-4 h-4 mr-1" /> Contraseña
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl text-red-500 hover:bg-red-50"
                                            onClick={() => handleDelete(u)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                {editingId === u.id && (
                                    <div className="mt-3 flex gap-2">
                                        <input
                                            type="text"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Nueva contraseña (mín. 8)"
                                            minLength={8}
                                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-mono text-sm focus:outline-none focus:ring-4 focus:ring-green-500/10"
                                        />
                                        <Button
                                            size="sm"
                                            className="rounded-xl bg-slate-900 hover:bg-black text-white"
                                            onClick={() => handleChangePassword(u.id)}
                                            disabled={savingPwd}
                                        >
                                            {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
