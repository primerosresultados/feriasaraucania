"use client";

import { useEffect } from "react";

export default function IframeResizer() {
    useEffect(() => {
        const sendHeight = () => {
            const height = document.documentElement.scrollHeight;
            window.parent.postMessage({ type: "feriasaraucania-resize", height }, "*");
        };

        // Observe body size changes
        const observer = new ResizeObserver(() => sendHeight());
        observer.observe(document.body);

        // Send initial height after a short delay to ensure content is rendered
        sendHeight();
        const timer = setTimeout(sendHeight, 500);

        return () => {
            observer.disconnect();
            clearTimeout(timer);
        };
    }, []);

    return null;
}
