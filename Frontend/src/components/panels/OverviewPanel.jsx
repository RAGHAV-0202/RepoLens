import useAppStore from "../../store/useAppStore"

// ── tech-stack inference ──────────────────────────────────────────────────────
const STACK_SIGNALS = [
    { label: "Next.js",         pattern: /^next\.config\.[cm]?[jt]s$/ },
    { label: "Vite",            pattern: /^vite\.config\.[cm]?[jt]s$/ },
    { label: "TypeScript",      pattern: /^tsconfig\.json$/ },
    { label: "Tailwind",        pattern: /^tailwind\.config\.[cm]?[jt]s$/ },
    { label: "Prisma",          pattern: /^schema\.prisma$/ },
    { label: "Docker",          pattern: /^(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/ },
    { label: "GitHub Actions",  pattern: /^\.github$/ },
    { label: "Jest",            pattern: /^jest\.config\.[cm]?[jt]s$/ },
    { label: "Vitest",          pattern: /^vitest\.config\.[cm]?[jt]s$/ },
    { label: "ESLint",          pattern: /^\.eslintrc(\.(json|yaml|yml|js|cjs))?$|^eslint\.config\.[cm]?[jt]s$/ },
    { label: "Go",              pattern: /^go\.mod$/ },
    { label: "Rust",            pattern: /^Cargo\.toml$/ },
    { label: "Python",          pattern: /^(requirements\.txt|pyproject\.toml|setup\.py)$/ },
    { label: "Java/Maven",      pattern: /^pom\.xml$/ },
    { label: "Gradle",          pattern: /^(build\.gradle|settings\.gradle)(\.kts)?$/ },
]

const BADGE_COLORS = {
    "Next.js":        { bg: "#000", color: "#fff" },
    "Vite":           { bg: "#9361ff22", color: "#9361ff" },
    "TypeScript":     { bg: "#3178c622", color: "#3178c6" },
    "Tailwind":       { bg: "#06b6d422", color: "#06b6d4" },
    "Prisma":         { bg: "#38bdf822", color: "#0ea5e9" },
    "Docker":         { bg: "#2496ed22", color: "#2496ed" },
    "GitHub Actions": { bg: "#2dba4e22", color: "#2dba4e" },
    "Jest":           { bg: "#c21e5622", color: "#c21e56" },
    "Vitest":         { bg: "#f59e0b22", color: "#b45309" },
    "ESLint":         { bg: "#4b32c322", color: "#4b32c3" },
    "Go":             { bg: "#00add822", color: "#00add8" },
    "Rust":           { bg: "#ce412b22", color: "#ce412b" },
    "Python":         { bg: "#3572a522", color: "#3572a5" },
    "Java/Maven":     { bg: "#b0752122", color: "#b07521" },
    "Gradle":         { bg: "#02303a22", color: "#02303a" },
}

function collectNames(node, names = new Set()) {
    if (!node) return names
    names.add(node.name)
    if (Array.isArray(node.children)) {
        node.children.forEach((c) => collectNames(c, names))
    }
    return names
}

function inferTechStack(tree) {
    const names = collectNames(tree)
    return STACK_SIGNALS
        .filter(({ pattern }) => [...names].some((n) => pattern.test(n)))
        .map(({ label }) => label)
}
// ─────────────────────────────────────────────────────────────────────────────

export default function OverviewPanel() {
    const summary = useAppStore((s) => s.summary)
    const stats = useAppStore((s) => s.stats)
    const architecture = useAppStore((s) => s.architecture)
    const suggestions = useAppStore((s) => s.suggestions)
    const tree = useAppStore((s) => s.tree)
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
                    <RepoTab stats={stats} summary={summary} architecture={architecture} tree={tree} />
                )}
                {activeTab === "issues" && (
                    <IssuesTab suggestions={suggestions} />
                )}
            </div>
        </div>
    )
}

function RepoTab({ stats, summary, architecture, tree }) {
    const primaryLang = stats?.primaryLanguage || ""
    const langPercent = stats?.languages
        ? (primaryLang && stats.languages instanceof Map
            ? stats.languages.get(primaryLang)
            : (stats.languages && typeof stats.languages === "object"
                ? Object.values(stats.languages)[0]
                : null))
        : null

    const techStack = tree ? inferTechStack(tree) : []

    // Build sorted language entries for display
    const languageEntries = stats?.languages
        ? (() => {
            const raw = stats.languages instanceof Map
                ? [...stats.languages.entries()]
                : Object.entries(stats.languages)
            return raw
                .filter(([, pct]) => typeof pct === "number" && pct >= 1)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
        })()
        : []

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

            {/* tech stack badges */}
            {techStack.length > 0 && (
                <div style={{ margin: "10px 0 2px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {techStack.map((label) => {
                        const c = BADGE_COLORS[label] || { bg: "var(--color-surface)", color: "var(--color-secondary)" }
                        return (
                            <span
                                key={label}
                                style={{
                                    background: c.bg,
                                    color: c.color,
                                    border: `1px solid ${c.color}44`,
                                    borderRadius: "4px",
                                    padding: "1px 7px",
                                    fontSize: "10px",
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 500,
                                    letterSpacing: "0.02em",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {label}
                            </span>
                        )
                    })}
                </div>
            )}

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
            {architecture && (architecture.pattern || architecture.entryPoint || architecture.configFile || architecture.startGuide || languageEntries.length > 0) && (
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

                    {/* languages breakdown */}
                    {languageEntries.length > 0 && (
                        <div style={{ marginTop: "10px" }}>
                            <div className="kv-k" style={{ marginBottom: "6px" }}>languages</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                {languageEntries.map(([lang, pct]) => (
                                    <div key={lang} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ width: "80px", fontSize: "10px", color: "var(--color-secondary)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                                            {lang}
                                        </span>
                                        <div style={{ flex: 1, height: "5px", borderRadius: "999px", background: "var(--color-muted)", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: "var(--color-ink)", borderRadius: "999px" }} />
                                        </div>
                                        <span style={{ width: "34px", textAlign: "right", fontSize: "10px", color: "var(--color-ghost)", fontFamily: "var(--font-mono)" }}>
                                            {pct}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* getting started guide */}
                    {architecture.startGuide && (
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--color-border)" }}>
                            <div className="kv-k" style={{ marginBottom: "5px" }}>getting started</div>
                            <div className="ov-prose" style={{ fontSize: "11px" }}>
                                <FormattedProse text={architecture.startGuide} />
                            </div>
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
