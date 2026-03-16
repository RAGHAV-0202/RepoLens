import useAppStore from "../../store/useAppStore"

export default function OverviewPanel() {
    const summary = useAppStore((s) => s.summary)
    const stats = useAppStore((s) => s.stats)
    const architecture = useAppStore((s) => s.architecture)
    const suggestions = useAppStore((s) => s.suggestions)
    const activeTab = useAppStore((s) => s.activeOverviewTab)
    const setTab = useAppStore((s) => s.setActiveOverviewTab)

    return (
        <div className="overview">
            <div className="overview-head">
                <span>Overview</span>
                <div className="tab-pills">
                    <button
                        className={`otab ${activeTab === "repo" ? "on" : ""}`}
                        onClick={() => setTab("repo")}
                    >
                        repo
                    </button>
                    <button
                        className={`otab ${activeTab === "issues" ? "on" : ""}`}
                        onClick={() => setTab("issues")}
                    >
                        issues
                    </button>
                </div>
            </div>

            <div className="ov-body">
                {activeTab === "repo" && (
                    <RepoTab stats={stats} summary={summary} architecture={architecture} />
                )}
                {activeTab === "issues" && (
                    <IssuesTab suggestions={suggestions} />
                )}
            </div>
        </div>
    )
}

function RepoTab({ stats, summary, architecture }) {
    const primaryLang = stats?.primaryLanguage || ""
    const langPercent = stats?.languages
        ? (primaryLang && stats.languages instanceof Map
            ? stats.languages.get(primaryLang)
            : (stats.languages && typeof stats.languages === "object"
                ? Object.values(stats.languages)[0]
                : null))
        : null

    return (
        <>
            {/* stat grid */}
            <div className="stat-grid">
                <div className="stat">
                    <div className="stat-l">files</div>
                    <div className="stat-v">{stats?.totalFiles ?? "—"}</div>
                </div>
                <div className="stat">
                    <div className="stat-l">stars</div>
                    <div className="stat-v">—</div>
                </div>
                <div className="stat">
                    <div className="stat-l">lines</div>
                    <div className="stat-v">{formatNum(stats?.totalLines)}</div>
                    {primaryLang && <div className="stat-s">{langPercent ? `${langPercent}% ` : ""}{primaryLang}</div>}
                </div>
                <div className="stat">
                    <div className="stat-l">commits</div>
                    <div className="stat-v">—</div>
                </div>
            </div>

            {/* what this repo does */}
            {summary && (
                <div className="ov-card">
                    <div className="ov-card-title">What this repo does</div>
                    <div className="ov-prose">
                        <FormattedProse text={summary} />
                    </div>
                </div>
            )}

            {/* architecture */}
            {architecture && (architecture.pattern || architecture.entryPoint || architecture.configFile) && (
                <div className="ov-card">
                    <div className="ov-card-title">Architecture</div>
                    {architecture.pattern && (
                        <div className="kv">
                            <div className="kv-k">pattern</div>
                            <div className="kv-v">{architecture.pattern}</div>
                        </div>
                    )}
                    {architecture.entryPoint && (
                        <div className="kv">
                            <div className="kv-k">entry point</div>
                            <div className="kv-v">{architecture.entryPoint}</div>
                        </div>
                    )}
                    {architecture.configFile && (
                        <div className="kv">
                            <div className="kv-k">config</div>
                            <div className="kv-v">{architecture.configFile}</div>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}

function IssuesTab({ suggestions }) {
    if (!suggestions || suggestions.length === 0) {
        return (
            <div style={{ textAlign: "center", marginTop: "32px" }}>
                <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>no issues found</span>
            </div>
        )
    }

    const dotClass = {
        error: "dot-err",
        warning: "dot-warn",
        good: "dot-ok",
    }

    return (
        <div className="ov-card">
            <div className="ov-card-title">Suggestions &amp; issues</div>
            {suggestions.map((s, i) => (
                <div className="issue-item" key={i}>
                    <div className={`issue-dot ${dotClass[s.type] || ""}`} />
                    <div className="issue-text"><FormattedProse text={s.text} /></div>
                </div>
            ))}
        </div>
    )
}

function FormattedProse({ text }) {
    if (!text) return null
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                if (part.startsWith("`") && part.endsWith("`")) {
                    return <code key={i}>{part.slice(1, -1)}</code>
                }
                return <span key={i}>{part}</span>
            })}
        </>
    )
}

function formatNum(n) {
    if (n == null) return "—"
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}
