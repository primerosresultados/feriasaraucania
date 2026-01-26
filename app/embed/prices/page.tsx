import { getAuctions } from "@/lib/db";
import WidgetView from "@/components/widget-view";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export default async function EmbedPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const allAuctions = await getAuctions();
    const resolvedSearchParams = await searchParams;

    // Cast searchParams safely
    const recinto = typeof resolvedSearchParams.recinto === 'string' ? resolvedSearchParams.recinto : undefined;
    const color = typeof resolvedSearchParams.color === 'string' ? resolvedSearchParams.color : undefined;

    return (
        <Suspense fallback={<div className="p-4">Cargando...</div>}>
            <WidgetView
                allAuctions={allAuctions}
                initialRecinto={recinto}
                color={color}
            />
        </Suspense>
    );
}
