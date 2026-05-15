import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
    AuctionExtractionSchema,
    CANONICAL_RECINTOS,
    CANONICAL_SPECIES,
} from "@/lib/auction-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

function buildSystemPrompt() {
    return `Eres un extractor experto de informes de remates ganaderos chilenos (Feria Araucanía).
Tu tarea: convertir el contenido (texto o imagen) en un JSON estricto con la estructura del remate.

Reglas:
- recinto: debe ser uno EXACTO de: ${CANONICAL_RECINTOS.join(", ")}. Detéctalo por encabezado, logo o texto "FERIA DE X" / "REMATE X". Si no estás seguro, devuelve el más probable.
- fecha: en formato DD/MM/YY (dos dígitos para el año, ej: 03/02/26).
- tipoLote / descripcion: NORMALIZA a uno EXACTO de: ${CANONICAL_SPECIES.join(", ")}. Sin tildes, mayúsculas, "VACAS CON CRIAS" (no "CRÍAS").
- vendedor: nombre tal cual aparece (mayúsculas si así está). NO inventes vendedores.
- numeroLote: posición del lote dentro de su categoría (1, 2, 3...).
- cantidad: número de animales del lote.
- peso: peso total del lote en kg (entero).
- precio: precio por kg en pesos chilenos (entero).
- summaries: una fila resumen POR cada tipoLote presente. cantidadtotal/pesototal/pptotal corresponden al total de la categoría (todos los animales). cantidad5pp/peso5pp/pp5pp corresponden a los "primeros precios" (top 5-13 lotes listados). Si no aparecen, usa null.
- totalAnimales / totalKilos: totales del remate completo. Si el documento los muestra, úsalos; si no, suma los summaries.
- totalVista: animales transados "a la vista". null si no aparece.
- lots: incluye SOLO los lotes individuales que aparecen explícitamente listados. No inventes filas.

Devuelve únicamente el JSON conforme al schema. No agregues texto, comentarios ni markdown.`;
}

async function extract(input: {
    text?: string;
    imageDataUrl?: string;
}): Promise<unknown> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

    const client = new OpenAI({ apiKey });

    const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
    > = [];

    if (input.text && input.text.trim()) {
        userContent.push({ type: "text", text: input.text.trim() });
    }
    if (input.imageDataUrl) {
        userContent.push({
            type: "image_url",
            image_url: { url: input.imageDataUrl },
        });
    }
    if (userContent.length === 0) {
        throw new Error("Debes enviar texto o imagen");
    }

    const completion = await client.chat.completions.parse({
        model: MODEL,
        messages: [
            { role: "system", content: buildSystemPrompt() },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { role: "user", content: userContent as any },
        ],
        response_format: zodResponseFormat(
            AuctionExtractionSchema,
            "auction_extraction"
        ),
        temperature: 0,
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
        throw new Error("El modelo no devolvió una extracción válida");
    }
    return parsed;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { error: "Body inválido. Envía JSON con { text?, imageDataUrl? }" },
                { status: 400 }
            );
        }

        const { text, imageDataUrl } = body as {
            text?: string;
            imageDataUrl?: string;
        };

        if (!text && !imageDataUrl) {
            return NextResponse.json(
                { error: "Falta input: envía 'text' o 'imageDataUrl'" },
                { status: 400 }
            );
        }

        const extraction = await extract({ text, imageDataUrl });
        return NextResponse.json({ success: true, extraction });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error en extracción";
        console.error("POST /api/auctions/ai-extract error:", err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
