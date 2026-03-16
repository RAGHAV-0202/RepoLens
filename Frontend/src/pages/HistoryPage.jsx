import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../services/api"

export default function HistoryPage() {
    const [analyses, setAnalyses] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        api.get("/analyze/history")
            .then((res) => setAnalyses(res.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const handleClick = (item) => {
        navigate(`/app?session=${item.sessionId}`)
    }

    return (
        <div className="h-full w-full flex flex-col bg-base">
            {/* top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <p className="font-mono text-[12px] text-ink tracking-tight">
                    repo<span className="text-faint">lens</span>
                    <span className="text-ghost mx-2">/</span>
                    <span className="text-faint">history</span>
                </p>
                <Link to="/" className="font-mono text-[10px] text-faint hover:text-ink transition-colors">
                    ← back
                </Link>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {loading && (
                    <div className="flex flex-col gap-2.5 mt-4">
                        <div className="skeleton-line w-[60%]" />
                        <div className="skeleton-line w-[45%]" />
                        <div className="skeleton-line w-[55%]" />
                    </div>
                )}

                {!loading && analyses.length === 0 && (
                    <p className="text-[11px] text-ghost text-center mt-12">no past analyses</p>
                )}

                {!loading && analyses.length > 0 && (
                    <div className="flex flex-col gap-1">
                        {analyses.map((item) => (
                            <button
                                key={item._id}
                                onClick={() => handleClick(item)}
                                className="flex items-center justify-between px-3 py-2.5 rounded-[7px] text-left hover:bg-muted transition-colors group"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-mono text-[11.5px] text-ink group-hover:text-ink">
                                        {item.repoName}
                                    </span>
                                    <span className="text-[10px] text-ghost">
                                        {item.stats?.primaryLanguage || "—"}
                                        {" · "}
                                        {new Date(item.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded-[4px] font-mono text-[9px] uppercase tracking-wider ${
                                    item.status === "ready"
                                        ? "bg-muted text-ok"
                                        : "bg-muted text-ghost"
                                }`}>
                                    {item.status}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
