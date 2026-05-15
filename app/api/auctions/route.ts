import { NextResponse, type NextRequest } from 'next/server';
import { getAuctions, saveAuction, findAuctionByRecintoFecha } from '@/lib/db';
import { Auction, Lot, TipoLoteSummary } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'papaparse';
import { XMLParser } from 'fast-xml-parser';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const recinto = searchParams.get('recinto');
        let auctions = await getAuctions();
        if (recinto) {
            auctions = auctions.filter(a => a.recinto.toUpperCase() === recinto.toUpperCase());
        }
        return NextResponse.json(auctions);
    } catch (err: any) {
        console.error('GET /api/auctions error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Initialize authenticated Supabase client (shared between JSON and file flows)
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

        // JSON flow (AI-extracted auction submitted by the IA tab)
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => null);
            if (!body || typeof body !== 'object') {
                return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
            }
            const {
                recinto,
                fecha,
                totalAnimales,
                totalKilos,
                totalVista,
                lots: rawLots,
                summaries: rawSummaries,
            } = body as Partial<Auction> & { lots?: Lot[]; summaries?: TipoLoteSummary[] };

            if (!recinto || !fecha) {
                return NextResponse.json({ error: 'Faltan campos: recinto y fecha' }, { status: 400 });
            }

            const finalRecinto = String(recinto).toUpperCase();
            const summaries: TipoLoteSummary[] = Array.isArray(rawSummaries)
                ? rawSummaries.map((s) => ({
                    descripcion: String(s.descripcion),
                    cantidadtotal: Number(s.cantidadtotal || 0),
                    pesototal: Number(s.pesototal || 0),
                    pptotal: Number(s.pptotal || 0),
                    ...(s.cantidad5pp != null ? { cantidad5pp: Number(s.cantidad5pp) } : {}),
                    ...(s.peso5pp != null ? { peso5pp: Number(s.peso5pp) } : {}),
                    ...(s.pp5pp != null ? { pp5pp: Number(s.pp5pp) } : {}),
                }))
                : [];

            const lots: Lot[] = Array.isArray(rawLots)
                ? rawLots.map((l) => ({
                    numeroLote: Number(l.numeroLote || 0),
                    cantidad: Number(l.cantidad || 0),
                    peso: Number(l.peso || 0),
                    precio: Number(l.precio || 0),
                    vendedor: String(l.vendedor || ''),
                    tipoLote: String(l.tipoLote || 'DESCONOCIDO'),
                }))
                : [];

            // Mirror the XML behavior: embed each summary as a sentinel lot so summaries persist
            // even if the 'summaries' column is missing in older deployments.
            const lotsWithSummarySentinels: Lot[] = [...lots];
            summaries.forEach((s) => {
                lotsWithSummarySentinels.unshift({
                    numeroLote: -1,
                    cantidad: s.cantidadtotal,
                    peso: s.pesototal,
                    precio: s.pptotal,
                    vendedor: '__SUMMARY__',
                    tipoLote: s.descripcion,
                });
            });

            const computedAnimales = lots.reduce((sum, l) => sum + l.cantidad, 0);
            const computedKilos = lots.reduce((sum, l) => sum + l.peso, 0);

            const newAuction: Auction = {
                id: uuidv4(),
                recinto: finalRecinto,
                fecha: String(fecha),
                totalAnimales: Number(totalAnimales ?? computedAnimales),
                totalKilos: Number(totalKilos ?? computedKilos),
                ...(totalVista != null ? { totalVista: Number(totalVista) } : {}),
                lots: lotsWithSummarySentinels,
                ...(summaries.length > 0 ? { summaries } : {}),
            };

            const existing = await findAuctionByRecintoFecha(
                newAuction.recinto,
                newAuction.fecha,
                session ? supabase : undefined
            );
            if (existing) {
                return NextResponse.json({
                    success: false,
                    duplicate: true,
                    error: `Ya existe un remate para ${newAuction.recinto} el ${newAuction.fecha}`,
                    existingId: existing.id,
                }, { status: 409 });
            }

            await saveAuction(newAuction, session ? supabase : undefined);
            return NextResponse.json({ success: true, auction: newAuction });
        }

        // File flow (XML / CSV upload)
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        let fallbackRecinto = (formData.get('recinto') as string | null) ?? 'DESCONOCIDO';
        let fallbackFecha = (formData.get('fecha') as string | null) ?? '01/01/70';

        if (!file) {
            return NextResponse.json({ error: 'Archivo no provisto' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const content = buffer.toString('utf-8');
        let lots: Lot[] = [];
        let summaries: TipoLoteSummary[] = [];
        let finalRecinto = fallbackRecinto;
        let finalFecha = fallbackFecha;
        let xmlTotalAnimales: number | null = null;
        let xmlTotalKilos: number | null = null;
        let xmlTotalVista: number | null = null;

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

                // Extract pre-computed summary metadata from the XML
                if (t.cantidadtotal !== undefined || t.pptotal !== undefined) {
                    const cantTotal = Number(t.cantidadtotal || 0);
                    const pesoTotal = Number(t.pesototal || 0);
                    const ppTotal = Number(t.pptotal || 0);
                    const cant5pp = t.cantidad5pp !== undefined ? Number(t.cantidad5pp) : undefined;
                    const peso5pp = t.peso5pp !== undefined ? Number(t.peso5pp) : undefined;
                    const pp5pp = t.pp5pp !== undefined ? Number(t.pp5pp) : undefined;

                    summaries.push({
                        descripcion,
                        cantidadtotal: cantTotal,
                        pesototal: pesoTotal,
                        pptotal: ppTotal,
                        ...(cant5pp !== undefined ? { cantidad5pp: cant5pp } : {}),
                        ...(peso5pp !== undefined ? { peso5pp } : {}),
                        ...(pp5pp !== undefined ? { pp5pp } : {}),
                    });

                    // Workaround: embed summary as a special lot to guarantee storage
                    lots.push({
                        numeroLote: -1,
                        cantidad: cantTotal,
                        peso: pesoTotal,
                        precio: ppTotal,
                        vendedor: '__SUMMARY__',
                        tipoLote: descripcion,
                    });
                }

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

            // Use XML root totals as authoritative values (the item list is incomplete)
            if (root.totanimales !== undefined) xmlTotalAnimales = Number(root.totanimales);
            if (root.totkilo !== undefined) xmlTotalKilos = Number(root.totkilo);
            if (root.totvista !== undefined) xmlTotalVista = Number(root.totvista);
        } else {
            return NextResponse.json({ error: 'Formato de archivo no soportado' }, { status: 400 });
        }

        // Use XML totals if available, otherwise calculate from items
        const totalAnimales = xmlTotalAnimales ?? lots.reduce((sum, l) => sum + l.cantidad, 0);
        const totalKilos = xmlTotalKilos ?? lots.reduce((sum, l) => sum + l.peso, 0);

        const newAuction: Auction = {
            id: uuidv4(),
            recinto: finalRecinto,
            fecha: finalFecha,
            totalAnimales,
            totalKilos,
            ...(xmlTotalVista !== null ? { totalVista: xmlTotalVista } : {}),
            lots,
            ...(summaries.length > 0 ? { summaries } : {}),
        };

        // Duplicate check: same recinto + fecha
        const existing = await findAuctionByRecintoFecha(
            newAuction.recinto,
            newAuction.fecha,
            session ? supabase : undefined
        );
        if (existing) {
            return NextResponse.json({
                success: false,
                duplicate: true,
                error: `Ya existe un remate para ${newAuction.recinto} el ${newAuction.fecha}`,
                existingId: existing.id,
            }, { status: 409 });
        }

        // Pass the authenticated client to the save function
        // If the user isn't logged in (no session), this will use the anonymous client and fail if RLS blocks it.
        await saveAuction(newAuction, session ? supabase : undefined);
        return NextResponse.json({ success: true, auction: newAuction });
    } catch (err: any) {
        console.error('POST /api/auctions error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const all = searchParams.get('all');

        if (!id && all !== 'true') {
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

        if (all === 'true') {
            const { deleteAllAuctions } = await import('@/lib/db');
            await deleteAllAuctions(session ? supabase : undefined);
            return NextResponse.json({ success: true, deletedAll: true });
        }

        const { deleteAuction } = await import('@/lib/db');
        await deleteAuction(id!, session ? supabase : undefined);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('DELETE /api/auctions error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}
