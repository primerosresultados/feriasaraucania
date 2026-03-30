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

// GET: List comments for a stream
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const { data, error } = await getSupabase()
        .from("stream_comments")
        .select("*")
        .eq("stream_id", id)
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST: Add a new comment
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await req.json();
    const { author_name, message } = body;

    if (!author_name || !message) {
        return NextResponse.json({ error: "author_name y message son requeridos" }, { status: 400 });
    }

    const { data, error } = await getSupabase()
        .from("stream_comments")
        .insert({ stream_id: id, author_name, message })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
