import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import useAppStore from "../store/useAppStore"
import useAnalyze from "../hooks/useAnalyze"
import api, { clearStoredAuthTokens } from "../services/api"

const REPOS_PER_PAGE = 6
const HISTORY_PER_PAGE = 5
const SIDEBAR_REPO_LIMIT = 8

// Client-side cache TTL: 10 minutes
const CLIENT_TRENDING_CACHE_TTL_MS = 10 * 60 * 1000
const TRENDING_CACHE_KEY = "repolens_trending_repos"
const TOP_CACHE_KEY = "repolens_top_repos"

function getClientCachedRepos(key) {
    try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return null
        const { repos, expiresAt } = JSON.parse(raw)
        if (Date.now() > expiresAt) {
            sessionStorage.removeItem(key)
            return null
        }
        return repos
    } catch {
        return null
    }
}

function setClientCachedRepos(key, repos) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ repos, expiresAt: Date.now() + CLIENT_TRENDING_CACHE_TTL_MS }))
    } catch (err) {
        console.warn("Failed to cache repos in sessionStorage:", err)
    }
}

export default function DashboardPage() {
    const navigate = useNavigate()
    const user = useAppStore((s) => s.user)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const analyzeProgress = useAppStore((s) => s.analyzeProgress)
    const analyzeStage = useAppStore((s) => s.analyzeStage)
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

    const [activeTab, setActiveTab] = useState("top")
    const [reposPage, setReposPage] = useState(1)
    const [historyPage, setHistoryPage] = useState(1)

    const [repoUrl, setRepoUrl] = useState("")
    const [error, setError] = useState("")
    const { analyze } = useAnalyze()

    useEffect(() => {
        if (!user) {
            navigate("/login", { replace: true })
            return
        }

        let cancelled = false

        api.get("/analyze/history")
            .then((res) => {
                if (!cancelled && res.data?.success) {
                    setHistory(Array.isArray(res.data.data) ? res.data.data : [])
                }
            })
            .catch((err) => console.error("Failed to load history:", err))
            .finally(() => {
                if (!cancelled) setIsLoadingHistory(false)
            })

        // Use client-side cache for trending repos to reduce API calls and avoid rate limits
        const cachedTrending = getClientCachedRepos(TRENDING_CACHE_KEY)
        if (cachedTrending) {
            setTrendingRepos(cachedTrending)
            setIsLoadingTrending(false)
        } else {
            api.get("/github/trending?type=trending")
                .then((res) => {
                    if (!cancelled && res.data?.success) {
                        const repos = Array.isArray(res.data.data) ? res.data.data : []
                        setTrendingRepos(repos)
                        setClientCachedRepos(TRENDING_CACHE_KEY, repos)
                    }
                })
                .catch((err) => console.error("Failed to load trending repositories:", err))
                .finally(() => {
                    if (!cancelled) setIsLoadingTrending(false)
                })
        }

        // Use client-side cache for top repos to reduce API calls and avoid rate limits
        const cachedTop = getClientCachedRepos(TOP_CACHE_KEY)
        if (cachedTop) {
            setTopRepos(cachedTop)
            setIsLoadingTop(false)
        } else {
            api.get("/github/trending?type=top")
                .then((res) => {
                    if (!cancelled && res.data?.success) {
                        const repos = Array.isArray(res.data.data) ? res.data.data : []
                        setTopRepos(repos)
                        setClientCachedRepos(TOP_CACHE_KEY, repos)
                    }
                })
                .catch((err) => console.error("Failed to load top repositories:", err))
                .finally(() => {
                    if (!cancelled) setIsLoadingTop(false)
                })
        }

        if (user.githubId) {
            api.get("/github/my-repos")
                .then((res) => {
                    if (!cancelled && res.data?.success) {
                        setMyRepos(Array.isArray(res.data.data) ? res.data.data : [])
                    }
                })
                .catch((err) => console.error("Failed to load user repositories:", err))
                .finally(() => {
                    if (!cancelled) setIsLoadingMyRepos(false)
                })
        } else {
            setIsLoadingMyRepos(false)
        }

        return () => {
            cancelled = true
        }
    }, [user, navigate])

    const handleAnalyzeNew = async (e, directUrl = null) => {
        if (e) e.preventDefault()
        if (isAnalyzing) return

        setError("")
        const urlToAnalyze = (directUrl || repoUrl).trim()

        if (!urlToAnalyze) {
            setError("Enter a valid repository URL.")
            return
        }

        try {
            await analyze(urlToAnalyze)
        } catch (err) {
            setError(err?.message || "Failed to start analysis.")
        }
    }

    const handleResume = (sessionId) => {
        if (isAnalyzing) return
        navigate(`/app?session=${sessionId}`)
    }

    const handleLogout = async () => {
        try {
            await api.post("/auth/logout")
        } catch (err) {
            console.error("Logout request failed:", err)
        } finally {
            clearStoredAuthTokens()
            useAppStore.getState().setUser(null)
            navigate("/")
        }
    }

    const displayedRepos = activeTab === "top" ? topRepos : trendingRepos
    const isLoadingDisplayedRepos = activeTab === "top" ? isLoadingTop : isLoadingTrending

    const totalRepoPages = Math.max(1, Math.ceil(displayedRepos.length / REPOS_PER_PAGE))
    const safeReposPage = Math.min(Math.max(1, reposPage), totalRepoPages)

    const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE))
    const safeHistoryPage = Math.min(Math.max(1, historyPage), totalHistoryPages)

    const visibleRepos = useMemo(() => {
        const start = (safeReposPage - 1) * REPOS_PER_PAGE
        return displayedRepos.slice(start, start + REPOS_PER_PAGE)
    }, [displayedRepos, safeReposPage])

    const visibleHistory = useMemo(() => {
        const start = (safeHistoryPage - 1) * HISTORY_PER_PAGE
        return history.slice(start, start + HISTORY_PER_PAGE)
    }, [history, safeHistoryPage])

    useEffect(() => {
        setReposPage(1)
    }, [activeTab])

    useEffect(() => {
        setReposPage((page) => Math.min(page, totalRepoPages))
    }, [totalRepoPages])

    useEffect(() => {
        setHistoryPage((page) => Math.min(page, totalHistoryPages))
    }, [totalHistoryPages])

    if (!user) return null

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "var(--color-base)",
                color: "var(--color-ink)",
                display: "flex",
                flexDirection: "column"
            }}
        >
            <header
                style={{
                    height: "60px",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    background: "var(--color-surface)",
                    gap: "16px"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                    <div
                        style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "0.02em", cursor: "pointer", flexShrink: 0 }}
                        onClick={() => navigate("/")}
                    >
                        RepoLens
                    </div>

                    <form onSubmit={handleAnalyzeNew} style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Analyze a GitHub repository URL..."
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            disabled={isAnalyzing}
                            style={{
                                width: "100%",
                                maxWidth: "420px",
                                minWidth: "180px",
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
                                fontWeight: 600,
                                marginLeft: "8px",
                                opacity: isAnalyzing || !repoUrl.trim() ? 0.5 : 1,
                                cursor: isAnalyzing ? "wait" : "pointer",
                                flexShrink: 0
                            }}
                        >
                            {isAnalyzing ? "Analyzing..." : "Analyze"}
                        </button>

                        {isAnalyzing && (
                            <AnalyzeProgressWidget
                                active={isAnalyzing}
                                progress={analyzeProgress}
                                stage={analyzeStage}
                            />
                        )}
                    </form>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <button
                        onClick={toggleDarkMode}
                        className="theme-toggle"
                        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {darkMode ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>
                    <span style={{ fontSize: "13px", color: "var(--color-ghost)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user.email}
                    </span>
                    <button
                        onClick={handleLogout}
                        style={{
                            border: "1px solid var(--color-border)",
                            background: "var(--color-base)",
                            color: "var(--color-secondary)",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            cursor: "pointer"
                        }}
                    >
                        logout
                    </button>
                </div>
            </header>

            {error && (
                <div style={{ maxWidth: "1200px", width: "100%", margin: "12px auto 0", padding: "0 24px", color: "var(--color-err, #e55)", fontSize: "12px" }}>
                    {error}
                </div>
            )}

            <main
                style={{
                    flex: 1,
                    width: "100%",
                    maxWidth: "1200px",
                    margin: "0 auto",
                    padding: "28px 24px 32px",
                    display: "flex",
                    gap: "24px"
                }}
            >
                <aside style={{ width: "260px", flexShrink: 0 }}>
                    <div
                        style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "50%",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            marginBottom: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                            color: "var(--color-ink)"
                        }}
                    >
                        {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 4px 0" }}>{user.email?.split("@")[0]}</h2>
                    <p style={{ fontSize: "13px", color: "var(--color-secondary)", margin: 0 }}>{user.email}</p>

                    <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "22px 0" }} />

                    <h3
                        style={{
                            fontSize: "12px",
                            color: "var(--color-ghost)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            margin: "0 0 10px 0",
                            fontWeight: 600
                        }}
                    >
                        {user.githubId ? "My GitHub Repos" : "GitHub Repos"}
                    </h3>

                    {!user.githubId ? (
                        <p style={{ fontSize: "12px", color: "var(--color-secondary)", lineHeight: 1.6, margin: 0 }}>
                            Sign in with GitHub to load your personal repositories here.
                        </p>
                    ) : isLoadingMyRepos ? (
                        <SidebarRepoSkeleton count={6} />
                    ) : myRepos.length === 0 ? (
                        <p style={{ fontSize: "12px", color: "var(--color-secondary)", margin: 0 }}>No repositories found in your account.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {myRepos.slice(0, SIDEBAR_REPO_LIMIT).map((repo) => (
                                <button
                                    key={repo.id}
                                    onClick={() => handleAnalyzeNew(null, repo.htmlUrl)}
                                    disabled={isAnalyzing}
                                    style={{
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-surface)",
                                        borderRadius: "8px",
                                        padding: "10px",
                                        textAlign: "left",
                                        cursor: isAnalyzing ? "wait" : "pointer",
                                        opacity: isAnalyzing ? 0.6 : 1
                                    }}
                                >
                                    <div style={{ fontSize: "12px", color: "var(--color-ink)", fontWeight: 600, marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {repo.fullName || repo.name}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                                        {repo.language || "Unknown"}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                                <button
                                    onClick={() => setActiveTab("top")}
                                    style={tabButtonStyle(activeTab === "top")}
                                >
                                    Top Repositories
                                </button>
                                <button
                                    onClick={() => setActiveTab("trending")}
                                    style={tabButtonStyle(activeTab === "trending")}
                                >
                                    Trending Repositories
                                </button>
                            </div>
                        </div>

                        {isLoadingDisplayedRepos ? (
                            <RepoGridSkeleton count={REPOS_PER_PAGE} />
                        ) : displayedRepos.length === 0 ? (
                            <EmptyState text="No repositories available right now." />
                        ) : (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                                    {visibleRepos.map((repo) => (
                                        <RepoCard
                                            key={repo.id}
                                            repo={repo}
                                            disabled={isAnalyzing}
                                            onAnalyze={() => handleAnalyzeNew(null, repo.htmlUrl)}
                                        />
                                    ))}
                                </div>

                                {displayedRepos.length > REPOS_PER_PAGE && (
                                    <PaginationRow
                                        page={safeReposPage}
                                        totalPages={totalRepoPages}
                                        onChange={setReposPage}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}>
                            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Recent Analyses</h2>
                        </div>

                        {isLoadingHistory ? (
                            <HistorySkeletonList count={HISTORY_PER_PAGE} />
                        ) : history.length === 0 ? (
                            <EmptyState text="You have not analyzed any repositories yet." subText="Pick a repository above to get started." />
                        ) : (
                            <>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {visibleHistory.map((item) => (
                                        <button
                                            key={item.sessionId}
                                            onClick={() => handleResume(item.sessionId)}
                                            disabled={isAnalyzing}
                                            style={{
                                                border: "1px solid var(--color-border)",
                                                background: "var(--color-surface)",
                                                borderRadius: "8px",
                                                textAlign: "left",
                                                padding: "14px 16px",
                                                cursor: isAnalyzing ? "wait" : "pointer",
                                                opacity: isAnalyzing ? 0.65 : 1
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                                                <h3 style={{ fontSize: "14px", margin: 0, color: "var(--color-ink)", fontWeight: 600 }}>{item.repoName || "Unknown repository"}</h3>
                                                <span style={{ fontSize: "11px", color: "var(--color-ghost)", flexShrink: 0 }}>
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                                                </span>
                                            </div>
                                            <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--color-secondary)", lineHeight: 1.5 }}>
                                                {item.summary || "No summary available."}
                                            </p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                                                <span>{item.stats?.primaryLanguage || "Unknown language"}</span>
                                                {item.status && <span>{item.status}</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {history.length > HISTORY_PER_PAGE && (
                                    <PaginationRow
                                        page={safeHistoryPage}
                                        totalPages={totalHistoryPages}
                                        onChange={setHistoryPage}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </section>
            </main>
        </div>
    )
}

function AnalyzeProgressWidget({ active, progress, stage }) {
    const normalized = Math.max(0, Math.min(100, Math.round(progress || 0)))
    const currentStage = stage || (active ? "Starting analysis..." : "")

    return (
        <div
            title={currentStage}
            style={{
                width: "240px",
                flexShrink: 0,
                marginLeft: "10px"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "var(--color-ghost)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
                    {currentStage}
                </span>
                <span style={{ fontSize: "10px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>{normalized}%</span>
            </div>

            <div
                style={{
                    height: "8px",
                    borderRadius: "999px",
                    background: "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                    overflow: "hidden",
                    marginBottom: "6px"
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${normalized}%`,
                        background: "linear-gradient(90deg, var(--color-core-text), var(--color-ink))",
                        transition: "width 0.45s ease"
                    }}
                />
            </div>
        </div>
    )
}

function RepoCard({ repo, onAnalyze, disabled }) {
    return (
        <button
            onClick={onAnalyze}
            disabled={disabled}
            style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                borderRadius: "8px",
                padding: "16px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                cursor: disabled ? "wait" : "pointer",
                minHeight: "140px",
                opacity: disabled ? 0.7 : 1
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {repo.ownerAvatar ? (
                    <img src={repo.ownerAvatar} alt="owner" style={{ width: "20px", height: "20px", borderRadius: "50%" }} />
                ) : (
                    <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--color-muted)", display: "inline-block" }} />
                )}
                <h3 style={{ margin: 0, fontSize: "14px", color: "var(--color-ink)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {repo.fullName || repo.name || "Unknown repository"}
                </h3>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--color-prose)", lineHeight: 1.5, flex: 1 }}>
                {repo.description || "No description provided."}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                <span>{typeof repo.stars === "number" ? `${repo.stars.toLocaleString()} stars` : "No stars data"}</span>
                <span>{repo.language || "Unknown"}</span>
            </div>
        </button>
    )
}

function EmptyState({ text, subText }) {
    return (
        <div
            style={{
                border: "1px dashed var(--color-border)",
                borderRadius: "8px",
                padding: "36px 20px",
                textAlign: "center",
                color: "var(--color-secondary)",
                background: "var(--color-surface)"
            }}
        >
            <div style={{ fontSize: "13px", marginBottom: subText ? "6px" : 0 }}>{text}</div>
            {subText && <div style={{ fontSize: "11px", color: "var(--color-ghost)" }}>{subText}</div>}
        </div>
    )
}

function SkeletonBlock({ height = "12px", width = "100%", radius = "6px", style = {} }) {
    return (
        <div
            style={{
                height,
                width,
                borderRadius: radius,
                background: "linear-gradient(90deg, var(--color-muted) 25%, var(--color-surface) 50%, var(--color-muted) 75%)",
                backgroundSize: "200% 100%",
                animation: "reposkeleton 1.2s ease-in-out infinite",
                ...style
            }}
        />
    )
}

function RepoGridSkeleton({ count = 6 }) {
    return (
        <>
            <style>{"@keyframes reposkeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }"}</style>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {Array.from({ length: count }).map((_, index) => (
                    <div
                        key={`repo-skeleton-${index}`}
                        style={{
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            borderRadius: "8px",
                            padding: "16px",
                            minHeight: "140px",
                            display: "flex",
                            flexDirection: "column"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                            <SkeletonBlock height="20px" width="20px" radius="999px" />
                            <SkeletonBlock height="14px" width="70%" />
                        </div>
                        <SkeletonBlock height="11px" width="95%" style={{ marginBottom: "6px" }} />
                        <SkeletonBlock height="11px" width="80%" style={{ marginBottom: "12px" }} />
                        <div style={{ marginTop: "auto", display: "flex", gap: "12px" }}>
                            <SkeletonBlock height="11px" width="80px" />
                            <SkeletonBlock height="11px" width="70px" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

function HistorySkeletonList({ count = 5 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={`history-skeleton-${index}`}
                    style={{
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        borderRadius: "8px",
                        padding: "14px 16px"
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        <SkeletonBlock height="14px" width="45%" />
                        <SkeletonBlock height="11px" width="70px" />
                    </div>
                    <SkeletonBlock height="11px" width="95%" style={{ marginBottom: "6px" }} />
                    <SkeletonBlock height="11px" width="75%" style={{ marginBottom: "10px" }} />
                    <SkeletonBlock height="11px" width="90px" />
                </div>
            ))}
        </div>
    )
}

function SidebarRepoSkeleton({ count = 6 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={`sidebar-skeleton-${index}`}
                    style={{
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        borderRadius: "8px",
                        padding: "10px"
                    }}
                >
                    <SkeletonBlock height="12px" width="85%" style={{ marginBottom: "6px" }} />
                    <SkeletonBlock height="10px" width="45%" />
                </div>
            ))}
        </div>
    )
}

function PaginationRow({ page, totalPages, onChange }) {
    const buttonStyle = {
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-secondary)",
        borderRadius: "6px",
        padding: "4px 10px",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        cursor: "pointer"
    }

    return (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "12px" }}>
            <button
                style={buttonStyle}
                disabled={page <= 1}
                onClick={() => onChange(Math.max(1, page - 1))}
            >
                Prev
            </button>
            <span style={{ minWidth: "66px", textAlign: "center", fontSize: "11px", color: "var(--color-ghost)" }}>
                {page} / {totalPages}
            </span>
            <button
                style={buttonStyle}
                disabled={page >= totalPages}
                onClick={() => onChange(Math.min(totalPages, page + 1))}
            >
                Next
            </button>
        </div>
    )
}

function tabButtonStyle(active) {
    return {
        border: "none",
        background: "transparent",
        padding: "0 0 8px 0",
        margin: 0,
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        color: active ? "var(--color-ink)" : "var(--color-ghost)",
        borderBottom: active ? "2px solid var(--color-ink)" : "2px solid transparent"
    }
}
