import { NextResponse, type NextRequest } from 'next/server';
import { getAuctions, saveAuction } from '@/lib/db';
import { Auction, Lot } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'papaparse';
import { XMLParser } from 'fast-xml-parser';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const recinto = searchParams.get('recinto');
    let auctions = await getAuctions();
    if (recinto) {
        auctions = auctions.filter(a => a.recinto.toUpperCase() === recinto.toUpperCase());
    }
    return NextResponse.json(auctions);
}

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    let fallbackRecinto = (formData.get('recinto') as string | null) ?? 'DESCONOCIDO';
    let fallbackFecha = (formData.get('fecha') as string | null) ?? '01/01/70';

    if (!file) {
        return NextResponse.json({ error: 'Archivo no provisto' }, { status: 400 });
    }

    // Initialize authenticated Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    // Verify session
    const { data: { session } } = await supabase.auth.getSession();

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString('utf-8');
    let lots: Lot[] = [];
    let finalRecinto = fallbackRecinto;
    let finalFecha = fallbackFecha;

    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const parsed = parse<any>(content, {
            header: true,
            skipEmptyLines: true,
        });
        if (parsed.errors.length) {
            return NextResponse.json({ error: 'Error al parsear CSV', details: parsed.errors }, { status: 400 });
        }
        lots = parsed.data.map(row => ({
            numeroLote: Number(row.NumeroLote || row.lugar || 0),
            cantidad: Number(row.Cantidad || row.cantidad || 0),
            peso: Number(row.Peso || row.peso || 0),
            precio: Number(row.Precio || row.precio || 0),
            vendedor: String(row.Vendedor || row.vendedor || ''),
            tipoLote: String(row.TipoLote || row.tipolote || row.tipoLote || 'DESCONOCIDO'),
        }));
    } else if (file.type === 'application/xml' || file.name.endsWith('.xml')) {
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
        const jsonObj = parser.parse(content);

        const root = jsonObj?.root || jsonObj?.remate;
        if (!root) {
            return NextResponse.json({ error: 'XML no tiene la estructura esperada (root o remate)' }, { status: 400 });
        }

        if (root.recinto) finalRecinto = String(root.recinto).toUpperCase();
        if (root.fecha) finalFecha = String(root.fecha);

        const tipos = root.tipolote || root.tiposLote?.tipoLote;
        if (!tipos) {
            return NextResponse.json({ error: 'XML no tiene tipos de lote' }, { status: 400 });
        }

        const tipoArray = Array.isArray(tipos) ? tipos : [tipos];
        tipoArray.forEach((t: any) => {
            const descripcion = t.descripcion || t.TipoLote || 'DESCONOCIDO';
            const items = t.item ? (Array.isArray(t.item) ? t.item : [t.item]) : [];
            items.forEach((it: any) => {
                lots.push({
                    numeroLote: Number(it.lugar || it.numeroLote || 0),
                    cantidad: Number(it.cantidad || 0),
                    peso: Number(it.peso || 0),
                    precio: Number(it.precio || 0),
                    vendedor: String(it.vendedor || ''),
                    tipoLote: descripcion,
                });
            });
        });
    } else {
        return NextResponse.json({ error: 'Formato de archivo no soportado' }, { status: 400 });
    }

    const totalAnimales = lots.reduce((sum, l) => sum + l.cantidad, 0);
    const totalKilos = lots.reduce((sum, l) => sum + l.peso, 0);

    const newAuction: Auction = {
        id: uuidv4(),
        recinto: finalRecinto,
        fecha: finalFecha,
        totalAnimales,
        totalKilos,
        lots,
    };

    // Pass the authenticated client to the save function
    // If the user isn't logged in (no session), this will use the anonymous client and fail if RLS blocks it.
    await saveAuction(newAuction, session ? supabase : undefined);
    return NextResponse.json({ success: true, auction: newAuction });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID no provisto' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) { },
                remove(name: string, options: CookieOptions) { },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    const { deleteAuction } = await import('@/lib/db');
    await deleteAuction(id, session ? supabase : undefined);

    return NextResponse.json({ success: true });
}
