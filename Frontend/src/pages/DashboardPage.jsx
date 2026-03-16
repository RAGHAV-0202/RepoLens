import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useAppStore from "../store/useAppStore"
import useAnalyze from "../hooks/useAnalyze"
import api, { clearStoredAuthTokens } from "../services/api"

export default function DashboardPage() {
    const navigate = useNavigate()
    const user = useAppStore((s) => s.user)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const darkMode = useAppStore((s) => s.darkMode)
    const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
    
    const [history, setHistory] = useState([])
    const [trendingRepos, setTrendingRepos] = useState([])
    const [topRepos, setTopRepos] = useState([])
    const [myRepos, setMyRepos] = useState([])
    
    const [isLoadingHistory, setIsLoadingHistory] = useState(true)
    const [isLoadingTrending, setIsLoadingTrending] = useState(true)
    const [isLoadingTop, setIsLoadingTop] = useState(true)
    const [isLoadingMyRepos, setIsLoadingMyRepos] = useState(true)
    
    const [activeTab, setActiveTab] = useState("top") // "top" | "trending"
    
    const [repoUrl, setRepoUrl] = useState("")
    const [error, setError] = useState("")
    const { analyze } = useAnalyze()

    useEffect(() => {
        if (!user) {
            navigate("/login", { replace: true })
            return
        }
        
        // 1. Fetch user's last analyses
        api.get("/analyze/history")
            .then(res => {
                if (res.data?.success) setHistory(res.data.data)
            })
            .catch(err => console.error("Failed to load history:", err))
            .finally(() => setIsLoadingHistory(false))

        // 2a. Fetch trending repos from GitHub (Recent)
        api.get("/github/trending?type=trending")
            .then(res => {
                if (res.data?.success) setTrendingRepos(res.data.data)
            })
            .catch(err => console.error("Failed to load trending:", err))
            .finally(() => setIsLoadingTrending(false))

        // 2b. Fetch top repos from GitHub (All-time)
        api.get("/github/trending?type=top")
            .then(res => {
                if (res.data?.success) setTopRepos(res.data.data)
            })
            .catch(err => console.error("Failed to load top repos:", err))
            .finally(() => setIsLoadingTop(false))

        // 3. Fetch user's own GitHub repos if they linked GitHub
        if (user.githubId) {
            api.get("/github/my-repos")
                .then(res => {
                    if (res.data?.success) setMyRepos(res.data.data)
                })
                .catch(err => console.error("Failed to load user repos:", err))
                .finally(() => setIsLoadingMyRepos(false))
        } else {
            setIsLoadingMyRepos(false)
        }

    }, [user, navigate])

    const handleAnalyzeNew = async (e, directUrl = null) => {
        if (e) e.preventDefault()
        if (isAnalyzing) return
        setError("")

        const urlToAnalyze = directUrl || repoUrl.trim()
        if (!urlToAnalyze) return

        try {
            await analyze(urlToAnalyze)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleResume = (sessionId) => {
        if (isAnalyzing) return
        navigate(`/app?session=${sessionId}`)
    }

    if (!user) return null

    const displayedRepos = activeTab === "top" ? topRepos : trendingRepos
    const isLoadingDisplayedRepos = activeTab === "top" ? isLoadingTop : isLoadingTrending

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-base)", color: "var(--color-ink)", display: "flex", flexDirection: "column" }}>
            {/* Topbar */}
            <header style={{ height: "60px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", background: "var(--color-surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "0.02em", cursor: "pointer" }} onClick={() => navigate("/")}>RepoLens</div>
                    <form onSubmit={handleAnalyzeNew} style={{ display: "flex", alignItems: "center", position: "relative" }}>
                        <input 
                            type="text" 
                            placeholder="Analyze a GitHub repository URL..."
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            disabled={isAnalyzing}
                            style={{ 
                                width: "350px", 
                                background: "var(--color-base)", 
                                border: "1px solid var(--color-border)", 
                                borderRadius: "6px", 
                                padding: "6px 12px", 
                                fontSize: "12px",
                                outline: "none",
                                color: "var(--color-ink)",
                                fontFamily: "var(--font-mono)"
                            }}
                        />
                        <button 
                            type="submit" 
                            disabled={isAnalyzing || !repoUrl.trim()}
                            style={{ 
                                background: "var(--color-ink)", 
                                color: "var(--color-base)", 
                                border: "none", 
                                borderRadius: "6px", 
                                padding: "6px 14px", 
                                fontSize: "11px", 
                                cursor: isAnalyzing ? "wait" : "pointer", 
                                fontWeight: 600,
                                opacity: (isAnalyzing || !repoUrl.trim()) ? 0.5 : 1,
                                marginLeft: "8px"
                            }}
                        >
                            {isAnalyzing ? "Analyzing…" : "Analyze"}
                        </button>
                    </form>
                    {error && (
                        <span style={{ fontSize: "11px", color: "var(--color-err, #e55)", marginLeft: "16px" }}>{error}</span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" }}>
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
                    <span style={{ color: "var(--color-ghost)" }}>{user.email}</span>
                    <button 
                        onClick={async () => {
                            await api.post("/auth/logout")
                            clearStoredAuthTokens()
                            useAppStore.getState().setUser(null)
                            navigate("/")
                        }}
                        style={{ border: "1px solid var(--color-border)", background: "var(--color-base)", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", cursor: "pointer", color: "var(--color-secondary)" }}
                    >
                        logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, display: "flex", maxWidth: "1200px", margin: "0 auto", width: "100%", padding: "32px 24px", gap: "32px" }}>
                
                {/* Left Sidebar (Profile & My Repos) */}
                <aside style={{ width: "260px", flexShrink: 0 }}>
                    <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--color-surface)", border: "1px solid var(--color-border)", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "var(--color-ink)" }}>
                        {user.email.charAt(0).toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 4px 0" }}>{user.email.split("@")[0]}</h2>
                    <p style={{ fontSize: "14px", color: "var(--color-secondary)", margin: 0 }}>{user.email}</p>
                    
                    <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "24px 0" }} />
                    
                    <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-ghost)" }}>
                        {user.githubId ? "My GitHub Repos" : "Recent Analyses"}
                    </h3>

                    {user.githubId ? (
                        /* Show GitHub Repos */
                        isLoadingMyRepos ? (
                            <div style={{ fontSize: "12px", color: "var(--color-ghost)" }}>Loading repositories...</div>
                        ) : myRepos.length === 0 ? (
                            <div style={{ fontSize: "12px", color: "var(--color-secondary)" }}>No public repositories found.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {myRepos.slice(0, 8).map(repo => (
                                    <div 
                                        key={repo.id} 
                                        style={{ fontSize: "13px", color: "var(--color-ink)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }} 
                                        onClick={() => handleAnalyzeNew(null, repo.htmlUrl)}
                                    >
                                        <svg height="14" width="14" viewBox="0 0 16 16" fill="var(--color-ghost)"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 11-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z"></path></svg>
                                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repo.name}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        /* Fallback to History if strictly email login */
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {history.slice(0, 8).map(h => (
                                <div key={h.sessionId} style={{ fontSize: "13px", color: "var(--color-ink)", cursor: "pointer" }} onClick={() => handleResume(h.sessionId)}>
                                    {h.repoName}
                                </div>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Main Feed */}
                <section style={{ flex: 1, display: "flex", flexDirection: "column", gap: "32px" }}>
                    
                    {/* Trending Repositories Section */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                                <h2 
                                    onClick={() => setActiveTab("top")}
                                    style={{ 
                                        fontSize: "16px", 
                                        fontWeight: 600, 
                                        margin: 0, 
                                        cursor: "pointer",
                                        color: activeTab === "top" ? "var(--color-ink)" : "var(--color-ghost)",
                                        borderBottom: activeTab === "top" ? "2px solid var(--color-ink)" : "2px solid transparent",
                                        paddingBottom: "13px",
                                        marginBottom: "-13px" 
                                    }}
                                >
                                    Top Repos (All-time)
                                </h2>
                                <h2 
                                    onClick={() => setActiveTab("trending")}
                                    style={{ 
                                        fontSize: "16px", 
                                        fontWeight: 600, 
                                        margin: 0, 
                                        cursor: "pointer",
                                        color: activeTab === "trending" ? "var(--color-ink)" : "var(--color-ghost)",
                                        borderBottom: activeTab === "trending" ? "2px solid var(--color-ink)" : "2px solid transparent",
                                        paddingBottom: "13px",
                                        marginBottom: "-13px"
                                    }}
                                >
                                    Trending Repos (Recent)
                                </h2>
                            </div>
                        </div>
                        
                        {isLoadingDisplayedRepos ? (
                            <div style={{ fontSize: "13px", color: "var(--color-ghost)" }}>Loading repositories...</div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                                {displayedRepos.map(repo => (
                                    <div 
                                        key={repo.id} 
                                        onClick={() => handleAnalyzeNew(null, repo.htmlUrl)}
                                        style={{ 
                                            padding: "16px", 
                                            border: "1px solid var(--color-border)", 
                                            borderRadius: "8px", 
                                            background: "var(--color-surface)",
                                            cursor: "pointer",
                                            display: "flex",
                                            flexDirection: "column",
                                            transition: "border-color 0.15s, transform 0.15s",
                                            position: "relative",
                                            overflow: "hidden"
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = "var(--color-ink)"
                                            e.currentTarget.style.transform = "translateY(-2px)"
                                            e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.03)"
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = "var(--color-border)"
                                            e.currentTarget.style.transform = "translateY(0)"
                                            e.currentTarget.style.boxShadow = "none"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                            <img src={repo.ownerAvatar} alt="owner" style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
                                            <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--color-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {repo.fullName}
                                            </h3>
                                        </div>
                                        <p style={{ fontSize: "12px", color: "var(--color-prose)", margin: "0 0 16px 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1 }}>
                                            {repo.description || "No description provided."}
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <svg height="12" width="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path></svg>
                                                {repo.stars.toLocaleString()}
                                            </span>
                                            {repo.language && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)", display: "inline-block" }} />
                                                    {repo.language}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                    {/* Recent Analyses Section */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Recent Analyses</h2>
                        </div>
                        
                        {isLoadingHistory ? (
                            <div style={{ fontSize: "13px", color: "var(--color-ghost)" }}>Loading history...</div>
                        ) : history.length === 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", border: "1px dashed var(--color-border)", borderRadius: "8px" }}>
                                <p style={{ fontSize: "13px", color: "var(--color-secondary)", marginBottom: "8px" }}>You haven't analyzed any repositories yet.</p>
                                <p style={{ fontSize: "11px", color: "var(--color-ghost)" }}>Click on a trending repository above to give it a try.</p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {history.map(item => (
                                    <div 
                                        key={item.sessionId} 
                                        onClick={() => handleResume(item.sessionId)}
                                        style={{ 
                                            padding: "16px", 
                                            border: "1px solid var(--color-border)", 
                                            borderRadius: "8px", 
                                            background: "var(--color-surface)",
                                            cursor: "pointer",
                                            transition: "border-color 0.15s",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--color-ink)"}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--color-border)"}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                                            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--color-ink)" }}>
                                                {item.repoName}
                                            </h3>
                                            <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: "13px", color: "var(--color-secondary)", margin: "0 0 12px 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                            {item.summary || "No summary available."}
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                                            {item.stats?.primaryLanguage && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-secondary)", display: "inline-block" }} />
                                                    {item.stats.primaryLanguage}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    )
}
