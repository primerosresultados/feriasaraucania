import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;
function getSupabase() {
    if (!_supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Supabase not configured");
        }
        _supabase = createClient(supabaseUrl, supabaseKey);
    }
    return _supabase;
}

// GET: List all active streams
export async function GET() {
    const { data, error } = await getSupabase()
        .from("live_streams")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST: Create a new stream
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { youtube_url, title } = body;

    if (!youtube_url) {
        return NextResponse.json({ error: "youtube_url es requerido" }, { status: 400 });
    }

    const { data, error } = await getSupabase()
        .from("live_streams")
        .insert({ youtube_url, title: title || "Remate en Vivo" })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE: Deactivate a stream
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    const { error } = await getSupabase()
        .from("live_streams")
        .update({ is_active: false })
        .eq("id", id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
