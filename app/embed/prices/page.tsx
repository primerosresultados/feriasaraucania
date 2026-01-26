import { getAuctions } from "@/lib/db";
import WidgetView from "@/components/widget-view";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';

export default async function EmbedPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const allAuctions = await getAuctions();

    // Cast searchParams safely
    const recinto = typeof searchParams.recinto === 'string' ? searchParams.recinto : undefined;
    const color = typeof searchParams.color === 'string' ? searchParams.color : undefined;

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
