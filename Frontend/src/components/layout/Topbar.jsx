import { useState } from "react"
import useAppStore from "../../store/useAppStore"
import useAnalyze from "../../hooks/useAnalyze"
import { useNavigate } from "react-router-dom"

export default function Topbar() {
    const repoUrl = useAppStore((s) => s.repoUrl)
    const cached = useAppStore((s) => s.cached)
    const sizeMB = useAppStore((s) => s.sizeMB)
    const analyzeTime = useAppStore((s) => s.analyzeTime)
    const user = useAppStore((s) => s.user)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const darkMode = useAppStore((s) => s.darkMode)
    const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
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

    // build status text
    const statusParts = []
    if (cached) statusParts.push("cached")
    else statusParts.push("cloned")
    if (sizeMB) statusParts.push(`${sizeMB} mb`)
    if (analyzeTime) statusParts.push(`${analyzeTime}s`)
    const statusText = statusParts.join(" · ")

    return (
        <div className="topbar">
            <div className="logo" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
                repo<em>lens</em>
            </div>

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

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                {/* dark mode toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="theme-toggle"
                    title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                    {darkMode ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    )}
                </button>

                {user && (
                    <span className="meta">{user.email}</span>
                )}
            </div>
        </div>
    )
}
