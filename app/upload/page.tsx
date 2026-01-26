"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UploadRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.push("/insert");
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-pulse text-slate-400 font-medium">Redirigiendo al panel...</div>
        </div>
    );
}
