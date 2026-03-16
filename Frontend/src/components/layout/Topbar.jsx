import { useState } from "react"
import useAppStore from "../../store/useAppStore"
import useAnalyze from "../../hooks/useAnalyze"
import api from "../../services/api"
import { useNavigate } from "react-router-dom"

export default function Topbar() {
    const repoUrl = useAppStore((s) => s.repoUrl)
    const cached = useAppStore((s) => s.cached)
    const sizeMB = useAppStore((s) => s.sizeMB)
    const analyzeTime = useAppStore((s) => s.analyzeTime)
    const user = useAppStore((s) => s.user)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const setUser = useAppStore((s) => s.setUser)
    const reset = useAppStore((s) => s.reset)
    const navigate = useNavigate()

    const [inputUrl, setInputUrl] = useState(repoUrl || "")
    const { analyze } = useAnalyze()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!inputUrl.trim() || isAnalyzing) return
        try {
            await analyze(inputUrl.trim())
        } catch {}
    }

    const handleLogout = async () => {
        try { await api.post("/auth/logout") } catch {}
        setUser(null)
        reset()
        navigate("/login")
    }

    // build status text
    const statusParts = []
    if (cached) statusParts.push("cached")
    else statusParts.push("cloned")
    if (sizeMB) statusParts.push(`${sizeMB} mb`)
    if (analyzeTime) statusParts.push(`${analyzeTime}s`)
    const statusText = statusParts.join(" · ")

    return (
        <div className="topbar">
            <div className="logo">repo<em>lens</em></div>

            <form onSubmit={handleSubmit} className="url-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                    <path d="M2 12h20"/>
                </svg>
                <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    disabled={isAnalyzing}
                    spellCheck="false"
                />
            </form>

            <button
                className="run-btn"
                onClick={handleSubmit}
                disabled={isAnalyzing || !inputUrl.trim()}
            >
                {isAnalyzing ? "Analyzing…" : "Analyze"}
            </button>

            {(sizeMB || analyzeTime) && (
                <div className="meta">{statusText}</div>
            )}

            {user && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="meta">{user.email}</span>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: "none", border: "none",
                            fontFamily: "inherit", fontSize: "10px",
                            color: "var(--color-ghost)", cursor: "pointer",
                            letterSpacing: "0.02em",
                        }}
                    >
                        logout
                    </button>
                </div>
            )}
        </div>
    )
}
