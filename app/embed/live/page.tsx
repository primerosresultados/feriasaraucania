"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Send, MessageCircle, Radio, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

interface Comment {
    id: string;
    stream_id: string;
    author_name: string;
    message: string;
    created_at: string;
}

interface Stream {
    id: string;
    youtube_url: string;
    title: string;
    is_active: boolean;
    created_at: string;
}

// Ferias Araucanía Brand Colors
const COLORS = {
    primary: "#F1C93E",      // Gold/Yellow
    primaryHover: "#d9b42e",
    dark: "#0c1e2c",         // Dark Navy Blue
    darkLight: "#04141A",
    darkLighter: "#1a3245",
    text: "#ffffff",
    textMuted: "#8b9eb3",
};

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
        /youtube\.com\/live\/([^&\s?]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export default function LiveStreamEmbedPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.dark }}>
                <div className="flex items-center gap-3 text-white">
                    <Radio className="w-6 h-6 animate-pulse" style={{ color: COLORS.primary }} />
                    <span className="font-bold">Cargando transmisión...</span>
                </div>
            </div>
        }>
            <LiveStreamEmbed />
        </Suspense>
    );
}

function LiveStreamEmbed() {
    const searchParams = useSearchParams();
    const streamId = searchParams.get("streamId");

    const [stream, setStream] = useState<Stream | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [authorName, setAuthorName] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    // Load stream and comments
    useEffect(() => {
        if (!streamId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch stream
                const { data: streamData } = await supabase
                    .from("live_streams")
                    .select("*")
                    .eq("id", streamId)
                    .single();
                setStream(streamData);

                // Fetch comments
                const { data: commentsData } = await supabase
                    .from("stream_comments")
                    .select("*")
                    .eq("stream_id", streamId)
                    .order("created_at", { ascending: true });
                setComments(commentsData || []);
            } catch (err) {
                console.error("Error loading stream:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Subscribe to realtime comments
        const channel = supabase
            .channel(`stream-${streamId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "stream_comments",
                    filter: `stream_id=eq.${streamId}`,
                },
                (payload) => {
                    setComments((prev) => [...prev, payload.new as Comment]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [streamId, supabase]);

    // Auto-scroll to bottom when new comments arrive
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [comments]);

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !authorName.trim() || !streamId) return;

        setIsSending(true);
        try {
            await fetch(`/api/streams/${streamId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author_name: authorName, message }),
            });
            setMessage("");
            // Store author name in localStorage for convenience
            localStorage.setItem("stream_author_name", authorName);
        } catch (err) {
            console.error("Error sending comment:", err);
        } finally {
            setIsSending(false);
        }
    };

    // Load saved author name
    useEffect(() => {
        const saved = localStorage.getItem("stream_author_name");
        if (saved) setAuthorName(saved);
    }, []);

    const videoId = stream?.youtube_url ? extractYouTubeId(stream.youtube_url) : null;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.dark }}>
                <div className="flex items-center gap-3 text-white">
                    <Radio className="w-6 h-6 animate-pulse" style={{ color: COLORS.primary }} />
                    <span className="font-bold">Cargando transmisión...</span>
                </div>
            </div>
        );
    }

    if (!stream || !videoId) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.dark }}>
                <div className="text-center text-white">
                    <Radio className="w-16 h-16 mx-auto mb-4" style={{ color: COLORS.textMuted }} />
                    <h2 className="text-xl font-bold mb-2">Transmisión no encontrada</h2>
                    <p style={{ color: COLORS.textMuted }}>El enlace puede estar inactivo o no existe.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: COLORS.dark }}>
            {/* Video Section */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ backgroundColor: COLORS.primary }}
                >
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
                        <span className="font-bold text-xs uppercase tracking-widest" style={{ color: COLORS.dark }}>
                            En Vivo
                        </span>
                    </div>
                    <h1 className="font-bold truncate" style={{ color: COLORS.dark }}>{stream.title}</h1>
                </div>

                {/* Video Player */}
                <div className="flex-1 bg-black flex items-center justify-center">
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1`}
                        className="w-full h-full min-h-[300px] lg:min-h-[500px]"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            </div>

            {/* Comments Section */}
            <div
                className="w-full lg:w-[380px] flex flex-col"
                style={{ backgroundColor: COLORS.darkLight, borderLeft: `1px solid ${COLORS.darkLighter}` }}
            >
                {/* Comments Header */}
                <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{ borderBottom: `1px solid ${COLORS.darkLighter}` }}
                >
                    <MessageCircle className="w-5 h-5" style={{ color: COLORS.primary }} />
                    <h2 className="text-white font-bold">Chat en Vivo</h2>
                    <span
                        className="ml-auto text-xs px-2 py-1 rounded-full"
                        style={{ backgroundColor: COLORS.darkLighter, color: COLORS.textMuted }}
                    >
                        {comments.length} mensajes
                    </span>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px] lg:max-h-none">
                    {comments.length === 0 ? (
                        <div className="text-center py-10" style={{ color: COLORS.textMuted }}>
                            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Sé el primero en comentar</p>
                        </div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3 animate-in slide-in-from-bottom-2">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: COLORS.primary }}
                                >
                                    <User className="w-4 h-4" style={{ color: COLORS.dark }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span
                                            className="font-bold text-sm truncate"
                                            style={{ color: COLORS.primary }}
                                        >
                                            {comment.author_name}
                                        </span>
                                        <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
                                            {new Date(comment.created_at).toLocaleTimeString("es-CL", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                    <p className="text-sm break-words" style={{ color: "#d1dae6" }}>{comment.message}</p>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={commentsEndRef} />
                </div>

                {/* Comment Input */}
                <form
                    onSubmit={handleSendComment}
                    className="p-4 space-y-3"
                    style={{ borderTop: `1px solid ${COLORS.darkLighter}` }}
                >
                    <input
                        type="text"
                        placeholder="Tu nombre..."
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg text-white text-sm focus:outline-none focus:ring-2"
                        style={{
                            backgroundColor: COLORS.darkLighter,
                            border: `1px solid ${COLORS.darkLighter}`,
                            '--tw-ring-color': COLORS.primary
                        } as React.CSSProperties}
                        required
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Escribe un comentario..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-lg text-white text-sm focus:outline-none focus:ring-2"
                            style={{
                                backgroundColor: COLORS.darkLighter,
                                border: `1px solid ${COLORS.darkLighter}`,
                                '--tw-ring-color': COLORS.primary
                            } as React.CSSProperties}
                            required
                        />
                        <button
                            type="submit"
                            disabled={isSending || !message.trim() || !authorName.trim()}
                            className={cn(
                                "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                            )}
                            style={{
                                backgroundColor: isSending || !message.trim() || !authorName.trim()
                                    ? COLORS.darkLighter
                                    : COLORS.primary,
                                color: isSending || !message.trim() || !authorName.trim()
                                    ? COLORS.textMuted
                                    : COLORS.dark,
                                cursor: isSending || !message.trim() || !authorName.trim()
                                    ? "not-allowed"
                                    : "pointer"
                            }}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
