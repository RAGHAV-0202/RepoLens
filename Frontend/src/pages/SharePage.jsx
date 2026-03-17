import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { API_BASE_URL } from "../services/api"

export default function SharePage() {
    const { sessionId } = useParams()
    const navigate = useNavigate()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!sessionId) return
        fetch(`${API_BASE_URL}/analyze/share/${sessionId}`)
            .then((res) => res.json())
            .then((json) => {
                if (json?.success && json.data) {
                    setData(json.data)
                } else {
                    setError(json?.message || "Analysis not found or has expired.")
                }
            })
            .catch(() => setError("Failed to load analysis. Please try again."))
            .finally(() => setLoading(false))
    }, [sessionId])

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--color-base)", color: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>Loading analysis...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--color-base)", color: "var(--color-ink)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                <div style={{ fontSize: "13px", color: "var(--color-secondary)" }}>{error}</div>
                <button
                    onClick={() => navigate("/")}
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink)", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
                >
                    Back to RepoLens
                </button>
            </div>
        )
    }

    const stats = data.stats || {}
    const architecture = data.architecture || {}
    const suggestions = data.suggestions || []

    const dotColor = { error: "#e55", warning: "#f90", good: "#4c8" }

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-base)", color: "var(--color-ink)" }}>
            {/* Header */}
            <header style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", padding: "0 24px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span
                        style={{ fontWeight: 600, fontSize: "15px", cursor: "pointer", letterSpacing: "0.02em" }}
                        onClick={() => navigate("/")}
                    >
                        RepoLens
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                        shared analysis
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={handleCopyLink}
                        style={{
                            border: "1px solid var(--color-border)",
                            background: copied ? "var(--color-ink)" : "var(--color-surface)",
                            color: copied ? "var(--color-base)" : "var(--color-secondary)",
                            borderRadius: "6px",
                            padding: "5px 12px",
                            fontSize: "11px",
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                            transition: "background 0.15s, color 0.15s"
                        }}
                    >
                        {copied ? "✓ Copied!" : "Copy link"}
                    </button>
                    <button
                        onClick={() => navigate("/")}
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-secondary)", borderRadius: "6px", padding: "5px 12px", fontSize: "11px", cursor: "pointer" }}
                    >
                        Try RepoLens
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 24px" }}>
                {/* Repo Title + Meta */}
                <div style={{ marginBottom: "28px" }}>
                    <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0" }}>{data.repoName}</h1>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                        <a
                            href={data.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "12px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)", textDecoration: "none" }}
                        >
                            {data.repoUrl}
                        </a>
                        {data.createdAt && (
                            <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>
                                analyzed {new Date(data.createdAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                    {[
                        { label: "Total files", value: stats.totalFiles ?? "—" },
                        { label: "Total lines", value: stats.totalLines != null ? `${(stats.totalLines / 1000).toFixed(1)}k` : "—" },
                        { label: "Primary language", value: stats.primaryLanguage || "—" },
                    ].map((s) => (
                        <div key={s.label} style={{ border: "1px solid var(--color-border)", borderRadius: "8px", background: "var(--color-surface)", padding: "12px 14px" }}>
                            <div style={{ fontSize: "10px", color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{s.label}</div>
                            <div style={{ fontSize: "18px", fontWeight: 700 }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Languages */}
                {stats.languages && Object.keys(stats.languages).length > 0 && (
                    <div style={{ border: "1px solid var(--color-border)", borderRadius: "8px", background: "var(--color-surface)", padding: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Languages</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {Object.entries(stats.languages)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 10)
                                .map(([lang, pct]) => (
                                    <span key={lang} style={{ fontSize: "11px", border: "1px solid var(--color-border)", borderRadius: "999px", padding: "3px 10px", color: "var(--color-secondary)", fontFamily: "var(--font-mono)" }}>
                                        {lang} {typeof pct === "number" ? `${pct.toFixed(1)}%` : ""}
                                    </span>
                                ))}
                        </div>
                    </div>
                )}

                {/* Summary */}
                {data.summary && (
                    <div style={{ border: "1px solid var(--color-border)", borderRadius: "8px", background: "var(--color-surface)", padding: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Summary</div>
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--color-prose)", lineHeight: 1.7 }}>{data.summary}</p>
                    </div>
                )}

                {/* Architecture */}
                {(architecture.pattern || architecture.entryPoint || architecture.configFile) && (
                    <div style={{ border: "1px solid var(--color-border)", borderRadius: "8px", background: "var(--color-surface)", padding: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Architecture</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {architecture.pattern && <KV k="Pattern" v={architecture.pattern} />}
                            {architecture.entryPoint && <KV k="Entry point" v={architecture.entryPoint} />}
                            {architecture.configFile && <KV k="Config" v={architecture.configFile} />}
                        </div>
                    </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <div style={{ border: "1px solid var(--color-border)", borderRadius: "8px", background: "var(--color-surface)", padding: "16px", marginBottom: "16px" }}>
                        <div style={{ fontSize: "11px", color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Suggestions & Issues</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {suggestions.map((s, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor[s.type] || "var(--color-border)", flexShrink: 0, marginTop: "5px" }} />
                                    <span style={{ fontSize: "12px", color: "var(--color-prose)", lineHeight: 1.6 }}>{s.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CTA */}
                <div style={{ marginTop: "32px", border: "1px dashed var(--color-border)", borderRadius: "8px", padding: "20px 24px", textAlign: "center" }}>
                    <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--color-secondary)" }}>
                        Want to analyze your own repositories with full interactive views, chat, and dependency graphs?
                    </p>
                    <button
                        onClick={() => navigate("/")}
                        style={{ background: "var(--color-ink)", color: "var(--color-base)", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                        Try RepoLens for free →
                    </button>
                </div>
            </main>
        </div>
    )
}

function KV({ k, v }) {
    return (
        <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
            <span style={{ color: "var(--color-ghost)", minWidth: "90px", flexShrink: 0 }}>{k}</span>
            <span style={{ color: "var(--color-ink)", fontFamily: "var(--font-mono)" }}>{v}</span>
        </div>
    )
}
