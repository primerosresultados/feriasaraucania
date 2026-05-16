import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

async function requireAuth() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value; },
                set(name: string, value: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value, ...options }); } catch {}
                },
                remove(name: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value: "", ...options }); } catch {}
                },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor");
    }
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function GET() {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const admin = getAdminClient();
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const users = data.users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
        }));
        return NextResponse.json({ users });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
        }
        if (typeof password !== "string" || password.length < 8) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
        }

        const admin = getAdminClient();
        const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const { id, password } = await request.json();
        if (!id || !password) {
            return NextResponse.json({ error: "ID y contraseña requeridos" }, { status: 400 });
        }
        if (typeof password !== "string" || password.length < 8) {
            return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
        }
        const admin = getAdminClient();
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const user = await requireAuth();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        if (id === user.id) {
            return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 });
        }
        const admin = getAdminClient();
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
