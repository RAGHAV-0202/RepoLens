import { useMemo, useState } from "react"
import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

function getLanguageFromPath(path) {
    if (!path) return "javascript"
    const ext = path.split(".").pop().toLowerCase()
    const map = {
        js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
        py: "python", go: "go", rs: "rust", java: "java",
        cpp: "cpp", c: "c", cs: "csharp", rb: "ruby",
        php: "php", html: "html", css: "css", json: "json",
        md: "markdown", yaml: "yaml", yml: "yaml", sh: "bash"
    }
    return map[ext] || "javascript"
}

export default function DetailPanel() {
    const selectedFile = useAppStore((s) => s.selectedFile)
    const selectFile = useAppStore((s) => s.selectFile)
    const sessionId = useAppStore((s) => s.sessionId)
    const repoName = useAppStore((s) => s.repoName)
    const tree = useAppStore((s) => s.tree)
    const summary = useAppStore((s) => s.summary)
    const architecture = useAppStore((s) => s.architecture)
    const stats = useAppStore((s) => s.stats)
    const fileExplanation = useAppStore((s) => s.fileExplanation)
    const isExplaining = useAppStore((s) => s.isExplainingFile)
    const rawFileContent = useAppStore((s) => s.rawFileContent)
    const isFetchingRaw = useAppStore((s) => s.isFetchingRaw)
    const { explain } = useFileExplain()

    const [activeTab, setActiveTab] = useState("explain")

    const keyModules = useMemo(
        () => getKeyModules(architecture, tree),
        [architecture, tree]
    )
    const keyFolders = useMemo(() => getTopFolders(tree, 8), [tree])
    const mainFeatures = useMemo(() => inferMainFeatures(summary), [summary])
    const startHereFiles = useMemo(() => getStartHereFiles(tree), [tree])
    const inferredArchitecture = useMemo(() => inferStack(tree, stats), [tree, stats])
    const inferredLanguages = useMemo(() => getLanguageBreakdown(stats, tree), [stats, tree])

    // reset tab when file changes
    const prevFile = useAppStore(s => s.previousSelectedFile)
    if (selectedFile !== prevFile) {
        useAppStore.setState({ previousSelectedFile: selectedFile })
        setActiveTab("explain")
    }

    const openFileFromGuide = (file) => {
        if (!file) return
        selectFile({ name: file.name, path: file.path, ext: file.ext, badge: file.badge })
        if (sessionId) explain(sessionId, file.path)
    }

    const goBackToOverview = () => {
        selectFile(null)
    }

    if (!selectedFile) {
        return (
            <div className="detail">
                <div className="detail-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="breadcrumb">
                        <b>{repoName || "Repository"}</b> / quick understanding
                    </div>
                    <div className="kind-tag" style={{ marginTop: 0 }}>START HERE</div>
                </div>

                <div className="detail-body">
                    <div className="section">
                        <div className="section-label">Architecture Overview</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            {inferredArchitecture.rows.map((row) => (
                                <div className="kv" key={row.label}>
                                    <div className="kv-k">{row.label}</div>
                                    <div className="kv-v">{row.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="section">
                        <div className="section-label">Languages</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            <div className="pills" style={{ marginTop: 0 }}>
                                {inferredLanguages.map((lang) => (
                                    <span key={lang.name} className="pill pill-b">
                                        {lang.name} {lang.percent}%
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="section">
                        <div className="section-label">Main Features</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                                {mainFeatures.map((item, i) => (
                                    <li key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                        <span style={{ color: "var(--color-ghost)", marginTop: "2px" }}>•</span>
                                        <span className="ov-prose" style={{ display: "inline" }}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="section">
                        <div className="section-label">Key Modules</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            {keyModules.map((m) => (
                                <div className="module-row" key={m.name + m.why}>
                                    <div className="module-name">{m.name}</div>
                                    <div className="module-why">{m.why}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="section">
                        <div className="section-label">Key Folders</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            <div className="pills">
                                {keyFolders.map((folder) => (
                                    <span key={folder} className="pill pill-c">{folder}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {summary && (
                        <div className="section" style={{ marginBottom: 0 }}>
                            <div className="section-label">Repository Summary</div>
                            <div className="ov-card" style={{ marginBottom: 0 }}>
                                <div className="prose" style={{ fontSize: "13.5px", lineHeight: 1.9 }}>
                                    <MarkdownBlock text={summary} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="section" style={{ marginBottom: 0 }}>
                        <div className="section-label">Start Here Guide</div>
                        <div className="ov-card" style={{ marginBottom: 0 }}>
                            <div className="ov-prose" style={{ marginBottom: "10px" }}>
                                Open these files first to understand the project flow quickly.
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {startHereFiles.map((file) => (
                                    <button
                                        key={file.path}
                                        onClick={() => openFileFromGuide(file)}
                                        style={{
                                            border: "1px solid var(--color-border)",
                                            background: "var(--color-base)",
                                            color: "var(--color-ink)",
                                            borderRadius: "6px",
                                            padding: "6px 10px",
                                            fontSize: "11px",
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {file.path}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const pathParts = selectedFile.path.split("/")
    const fileName = pathParts.pop()
    const parentPath = pathParts.join(" / ")

    // parse LLM response into sections by detecting **Section Name** headers
    const sections = parseMarkdownSections(fileExplanation)

    return (
        <div className="detail">
            {/* header */}
            <div className="detail-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="breadcrumb">
                        {parentPath && <>{parentPath} / </>}
                        <b>{fileName}</b>
                    </div>
                    {selectedFile.badge && (
                        <div className="kind-tag" style={{ marginTop: 0 }}>{selectedFile.badge.toUpperCase()}</div>
                    )}
                </div>

                <div className="tab-pills" style={{ marginBottom: 0 }}>
                    <button
                        className="otab"
                        onClick={goBackToOverview}
                        title="Back to repository overview"
                    >
                        overview
                    </button>
                    <button
                        className={`otab ${activeTab === "explain" ? "on" : ""}`}
                        onClick={() => setActiveTab("explain")}
                    >
                        explain
                    </button>
                    <button
                        className={`otab ${activeTab === "code" ? "on" : ""}`}
                        onClick={() => setActiveTab("code")}
                    >
                        code
                    </button>
                </div>
            </div>

            {/* body */}
            <div className="detail-body" style={activeTab === "code" ? { padding: 0, backgroundColor: "#1e1e1e" } : {}}>
                {activeTab === "code" ? (
                    <div style={{ height: "100%", overflow: "auto" }}>
                        {isFetchingRaw ? (
                            <div style={{ padding: "20px", color: "var(--color-faint)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                                Loading code...
                            </div>
                        ) : (
                            <SyntaxHighlighter
                                language={getLanguageFromPath(selectedFile.path)}
                                style={vscDarkPlus}
                                customStyle={{ margin: 0, padding: "20px", fontSize: "12.5px", background: "transparent", lineHeight: 1.5 }}
                                showLineNumbers
                            >
                                {rawFileContent || "// no content"}
                            </SyntaxHighlighter>
                        )}
                    </div>
                ) : (
                    <>
                        {/* loading skeleton */}
                        {isExplaining && !fileExplanation && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                                <div className="skeleton-line" style={{ width: "90%" }} />
                                <div className="skeleton-line" style={{ width: "70%" }} />
                                <div className="skeleton-line" style={{ width: "80%" }} />
                                <div className="skeleton-line" style={{ width: "50%" }} />
                            </div>
                        )}

                        {/* rendered sections */}
                        {sections.map((section, i) => (
                            <div className="section" key={i}>
                                {section.title && (
                                    <div className="section-label">{section.title}</div>
                                )}
                                <div className="prose">
                                    <MarkdownBlock text={section.body} />
                                </div>
                            </div>
                        ))}

                        {/* blinking cursor while streaming */}
                        {isExplaining && fileExplanation && (
                            <span className="cursor-blink" style={{ fontSize: "12px" }}>▋</span>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}


/**
 * Parse the LLM response into sections.
 * The LLM uses **Section Title** as headers at the start of paragraphs.
 */
function parseMarkdownSections(text) {
    if (!text) return []

    const sections = []
    // split on **Header** lines (must be at line start)
    const lines = text.split("\n")
    let currentTitle = ""
    let currentBody = []

    for (const line of lines) {
        const headerMatch = line.match(/^\*\*(.+?)\*\*\s*$/)
        if (headerMatch) {
            // flush previous section
            if (currentBody.length > 0 || currentTitle) {
                sections.push({ title: currentTitle, body: currentBody.join("\n") })
            }
            currentTitle = headerMatch[1]
            currentBody = []
        } else {
            currentBody.push(line)
        }
    }

    // flush last section
    if (currentBody.length > 0 || currentTitle) {
        sections.push({ title: currentTitle, body: currentBody.join("\n") })
    }

    return sections
}


/**
 * Render markdown-ish text into React nodes:
 * - **bold** → <strong>
 * - `code` → <code>
 * - Lines starting with - or * → bullet list
 * - Empty lines → paragraph break
 * - \n → line break
 */
function MarkdownBlock({ text }) {
    if (!text) return null

    const trimmed = text.trim()
    if (!trimmed) return null

    // split into paragraphs on double newlines
    const paragraphs = trimmed.split(/\n\n+/)

    return (
        <>
            {paragraphs.map((para, pi) => {
                const lines = para.split("\n").filter((l) => l.trim() !== "")

                // detect markdown table: lines contain | and at least one separator row
                const isTable = lines.length >= 2 &&
                    lines.every((l) => l.trim().startsWith("|")) &&
                    lines.some((l) => /^\|[\s-:|]+\|$/.test(l.trim()))

                if (isTable) {
                    const dataRows = lines.filter((l) => !/^\|[\s-:|]+\|$/.test(l.trim()))
                    const headerRow = dataRows[0]
                    const bodyRows = dataRows.slice(1)

                    const parseCells = (row) =>
                        row.split("|").slice(1, -1).map((c) => c.trim())

                    const headers = parseCells(headerRow)

                    return (
                        <table className="fn-table" key={pi}>
                            <thead>
                                <tr>
                                    {headers.map((h, hi) => (
                                        <td key={hi} className="fn-name" style={{ fontWeight: 600 }}>
                                            <InlineFormat text={h} />
                                        </td>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bodyRows.map((row, ri) => {
                                    const cells = parseCells(row)
                                    return (
                                        <tr key={ri}>
                                            {cells.map((cell, ci) => (
                                                <td key={ci} className={ci === 0 ? "fn-name" : "fn-desc"}>
                                                    <InlineFormat text={cell} />
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )
                }

                // check if this paragraph is a bullet list
                const isList = lines.length > 0 && lines.every(
                    (l) => /^[-*•]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim())
                )

                if (isList) {
                    return (
                        <ul key={pi} style={{ paddingLeft: "16px", margin: "6px 0", listStyle: "none" }}>
                            {lines.map((line, li) => (
                                <li key={li} style={{ padding: "2px 0", display: "flex", gap: "6px", alignItems: "flex-start" }}>
                                    <span style={{ color: "var(--color-ghost)", flexShrink: 0, fontSize: "8px", marginTop: "4px" }}>●</span>
                                    <span><InlineFormat text={line.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "")} /></span>
                                </li>
                            ))}
                        </ul>
                    )
                }

                // regular paragraph
                return (
                    <p key={pi} style={{ margin: pi > 0 ? "8px 0 0" : "0" }}>
                        {lines.map((line, li) => (
                            <span key={li}>
                                <InlineFormat text={line} />
                                {li < lines.length - 1 && <br />}
                            </span>
                        ))}
                    </p>
                )
            })}
        </>
    )
}


/** Render **bold** and `code` inline */
function InlineFormat({ text }) {
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

function flattenFiles(node, acc = []) {
    if (!node) return acc
    if (node.type === "file") {
        acc.push(node)
        return acc
    }
    if (node.children?.length) {
        for (const child of node.children) {
            flattenFiles(child, acc)
        }
    }
    return acc
}

function flattenDirs(node, acc = []) {
    if (!node) return acc
    if (node.type === "directory") {
        acc.push(node)
    }
    if (node.children?.length) {
        for (const child of node.children) {
            flattenDirs(child, acc)
        }
    }
    return acc
}

function getTopFolders(tree, limit = 6) {
    if (!tree?.children) return []
    return tree.children
        .filter((n) => n.type === "directory")
        .map((n) => n.name)
        .slice(0, limit)
}

function getKeyModules(architecture, tree) {
    const fromLlm = []
    const moduleKeys = ["keyModules", "modules", "coreModules"]
    for (const key of moduleKeys) {
        const arr = architecture?.[key]
        if (!Array.isArray(arr)) continue
        for (const item of arr) {
            if (typeof item === "string" && item.trim()) {
                const value = item.trim()
                fromLlm.push({
                    key: value,
                    name: humanModuleName(value),
                    why: formatModuleWhy("Mentioned in architecture analysis", value),
                })
            } else if (item && typeof item === "object" && (item.path || item.name)) {
                const value = item.path || item.name
                fromLlm.push({
                    key: value,
                    name: humanModuleName(value),
                    why: formatModuleWhy(item.role || item.reason || "Mentioned in architecture analysis", value),
                })
            }
        }
    }

    if (fromLlm.length >= 3) return dedupeModules(fromLlm).slice(0, 8)

    const files = flattenFiles(tree, [])
    const dirs = flattenDirs(tree, []).filter((d) => d.path && d.path !== "/")
    const candidates = []

    const dirSignals = [
        { token: "routes", why: "Endpoint map and HTTP surface", score: 230 },
        { token: "controllers", why: "Request handling and API orchestration", score: 220 },
        { token: "services", why: "Business logic and integrations", score: 215 },
        { token: "models", why: "Data schema and persistence layer", score: 205 },
        { token: "components", why: "Reusable UI building blocks", score: 195 },
        { token: "pages", why: "Screen-level user flows", score: 190 },
        { token: "middleware", why: "Cross-cutting request behavior", score: 185 },
        { token: "store", why: "State management hub", score: 180 },
        { token: "api", why: "External/internal API boundary", score: 175 },
        { token: "prisma", why: "ORM schema and data access", score: 180 },
        { token: "db", why: "Database-facing logic", score: 170 },
        { token: "hooks", why: "App-specific behavior composition", score: 165 },
    ]

    for (const dir of dirs) {
        const pathLower = (dir.path || "").toLowerCase()
        const depth = (dir.path.match(/\//g) || []).length
        for (const signal of dirSignals) {
            if (!pathLower.includes(signal.token)) continue
            const score = signal.score + Math.max(0, 24 - depth * 3)
            candidates.push({
                key: dir.path,
                name: humanModuleName(dir.path),
                why: formatModuleWhy(signal.why, dir.path),
                score,
                kind: "core",
            })
            break
        }
    }

    const fileSignals = [
        { test: (f) => /(router|routes|controller|service|model|schema|store|provider)/i.test(f.path), why: "Core domain module", score: 180, kind: "core" },
        { test: (f) => /(^|\/)(app|server|main|index)\.(js|ts|py|go|java|rs)$/i.test(f.path), why: "Core startup flow", score: 160, kind: "core" },
        { test: (f) => f.badge === "entry", why: "Likely execution entry point", score: 145, kind: "core" },
        { test: (f) => f.badge === "config", why: "Project configuration anchor", score: 70, kind: "meta" },
        { test: (f) => /^readme\.md$/i.test(f.name), why: "Project intent and setup guide", score: 45, kind: "meta" },
    ]

    for (const f of files) {
        const depth = (f.path.match(/\//g) || []).length
        for (const signal of fileSignals) {
            if (!signal.test(f)) continue
            const score = signal.score + Math.max(0, 20 - depth * 2)
            candidates.push({
                key: f.path,
                name: humanModuleName(f.path),
                why: formatModuleWhy(signal.why, f.path),
                score,
                kind: signal.kind,
            })
            break
        }
    }

    if (candidates.length === 0) {
        return getTopFolders(tree, 8).map((folder) => ({
            key: folder,
            name: humanModuleName(folder),
            why: formatModuleWhy("Top-level module folder", folder),
        }))
    }

    const sorted = candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    const core = dedupeModules(sorted.filter((m) => m.kind !== "meta"))
    const meta = dedupeModules(sorted.filter((m) => m.kind === "meta"))

    const result = core.slice(0, 8)
    if (result.length < 5) {
        result.push(...meta.slice(0, 8 - result.length))
    }

    return result.slice(0, 8).map(({ name, why }) => ({ name, why }))
}

function dedupeModules(items) {
    const out = []
    const seen = new Set()
    for (const item of items) {
        const key = (item.key || item.name || "").toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        out.push(item)
    }
    return out
}

function humanModuleName(value) {
    const text = String(value || "").replace(/^\/+|\/+$/g, "")
    if (!text) return "module"

    const parts = text.split("/")
    if (parts.length === 1) return text

    const tail = parts[parts.length - 1]
    const prev = parts[parts.length - 2]
    const lowTail = tail.toLowerCase()

    if (["index.js", "index.ts", "app.js", "server.js", "main.py", "main.ts"].includes(lowTail)) {
        return `${prev}/${tail}`
    }

    return tail
}

function formatModuleWhy(reason, location) {
    const loc = String(location || "")
    if (!loc) return reason
    return `${reason} (${loc})`
}

function getStartHereFiles(tree) {
    const files = flattenFiles(tree, [])
    if (files.length === 0) return []

    const scored = files.map((f) => {
        const lower = f.name.toLowerCase()
        const depth = (f.path.match(/\//g) || []).length
        let score = 0

        if (lower === "readme.md") score += 300
        if (f.badge === "entry") score += 220
        if (f.badge === "config") score += 160
        if (["package.json", "main.py", "app.js", "index.js", "main.ts", "server.js", "dockerfile", "pyproject.toml"].includes(lower)) score += 140
        if (["routes", "controller", "service", "model", "app", "main", "index"].some(k => lower.includes(k))) score += 60
        score += Math.max(0, 24 - depth * 4)

        return { ...f, score }
    })

    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

    const unique = []
    const seen = new Set()
    for (const file of scored) {
        if (seen.has(file.path)) continue
        seen.add(file.path)
        unique.push(file)
        if (unique.length >= 6) break
    }

    return unique
}

function inferMainFeatures(summary) {
    if (!summary || typeof summary !== "string") {
        return [
            "Repository architecture and module responsibilities",
            "Primary execution flow from entry points",
            "Key configuration and integration points",
        ]
    }

    const cleaned = summary
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim()

    const bullets = cleaned
        .split(/\n+/)
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter((l) => l.length > 18)

    const candidates = bullets.length > 0
        ? bullets
        : cleaned
            .split(/[.;]\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 18)

    return candidates.slice(0, 4)
}

function inferStack(tree, stats) {
    const files = flattenFiles(tree, [])
    const topFolders = getTopFolders(tree, 40).map((f) => f.toLowerCase())
    const paths = files.map((f) => (f.path || "").toLowerCase())
    const names = files.map((f) => (f.name || "").toLowerCase())

    const hasName = (name) => names.includes(name)
    const hasExt = (exts) => files.some((f) => exts.includes((f.ext || "").toLowerCase()))
    const hasPathToken = (tokens) => paths.some((p) => tokens.some((t) => p.includes(t)))
    const hasFolderToken = (tokens) => topFolders.some((f) => tokens.some((t) => f.includes(t)))

    const dominantCodeLanguage = inferDominantCodeLanguage(files, stats)

    const hasReactLike = hasExt([".jsx", ".tsx"]) || hasName("vite.config.js") || hasName("vite.config.ts")
    const hasNext = hasName("next.config.js") || hasName("next.config.mjs")
    const hasFrontendSignals =
        (hasReactLike ? 2 : 0) +
        (hasPathToken(["/components/", "/pages/", "/app/"]) ? 1 : 0) +
        (hasName("index.html") ? 1 : 0) +
        (hasFolderToken(["frontend", "client", "web", "ui"]) ? 1 : 0)

    const hasBackendSignals =
        (hasPathToken(["/routes/", "/controllers/", "/services/", "/middlewares/"]) ? 2 : 0) +
        (hasName("server.js") || hasName("app.js") || hasName("main.py") || hasName("manage.py") ? 1 : 0) +
        (hasFolderToken(["backend", "api", "server"]) ? 1 : 0)

    const isNodeRuntime = hasName("package.json") && hasExt([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"])
    const isPythonRuntime = hasExt([".py"]) || hasName("requirements.txt") || hasName("pyproject.toml")
    const isJavaRuntime = hasExt([".java"]) || hasName("pom.xml") || hasName("build.gradle")
    const isGoRuntime = hasExt([".go"]) || hasName("go.mod")

    let runtime = "No strong runtime signal found"
    if (isNodeRuntime) runtime = "Node.js"
    else if (isPythonRuntime) runtime = "Python"
    else if (isJavaRuntime) runtime = "Java/JVM"
    else if (isGoRuntime) runtime = "Go"

    let uiLayer = "No strong frontend signal"
    if (hasNext) uiLayer = "Next.js"
    else if (hasReactLike) uiLayer = hasName("vite.config.js") || hasName("vite.config.ts") ? "React + Vite" : "React-style UI"
    else if (hasFrontendSignals >= 2) uiLayer = "Web UI present"

    let apiLayer = "No strong backend signal"
    if (hasPathToken(["/routes/", "/controllers/"]) && isNodeRuntime) apiLayer = "Node.js API (Express-style structure)"
    else if (isPythonRuntime && hasName("manage.py")) apiLayer = "Django-style backend"
    else if (isPythonRuntime && hasName("app.py")) apiLayer = "Python app backend"
    else if (hasBackendSignals >= 2) apiLayer = "Backend service present"

    let dataLayer = "No strong database signal"
    if (hasName("schema.prisma")) dataLayer = "Prisma ORM"
    else if (hasPathToken(["mongo", "mongoose"]) || hasFolderToken(["mongo", "mongodb"])) dataLayer = "MongoDB-style data layer"
    else if (hasExt([".sql"]) || hasPathToken(["/migrations/", "schema.sql"])) dataLayer = "SQL database layer"
    else if (hasPathToken(["/models/"]) || hasFolderToken(["models"])) dataLayer = "Model layer present (DB not explicit)"

    let shape = "Mixed codebase"
    if (hasFrontendSignals >= 2 && hasBackendSignals >= 2) shape = "Full-stack application"
    else if (hasBackendSignals >= 2) shape = "Backend/API service"
    else if (hasFrontendSignals >= 2) shape = "Frontend application"

    const entryPoints = files
        .filter((f) => f.badge === "entry")
        .map((f) => f.path)
    const configFiles = files
        .filter((f) => f.badge === "config")
        .map((f) => f.path)
    const languageLabel = getLanguageBreakdown(stats, tree)
        .slice(0, 3)
        .map((l) => `${l.name} ${l.percent}%`)
        .join(" · ") || dominantCodeLanguage

    return {
        rows: [
            { label: "shape", value: shape },
            { label: "runtime", value: runtime },
            { label: "ui layer", value: uiLayer },
            { label: "api layer", value: apiLayer },
            { label: "data layer", value: dataLayer },
            { label: "languages", value: languageLabel },
            { label: "entry points", value: summarizePathList(entryPoints, 3, "No explicit entry file tagged") },
            { label: "key configs", value: summarizePathList(configFiles, 3, "No primary config detected") },
        ]
    }
}

function summarizePathList(list, limit = 3, fallback = "None") {
    if (!Array.isArray(list) || list.length === 0) return fallback
    const head = list.slice(0, limit)
    const remaining = list.length - head.length
    return remaining > 0 ? `${head.join(", ")} +${remaining} more` : head.join(", ")
}

function getLanguageBreakdown(stats, tree) {
    const fromStats = stats?.languages && typeof stats.languages === "object"
        ? Object.entries(stats.languages)
            .filter(([, pct]) => Number.isFinite(Number(pct)) && Number(pct) > 0)
            .map(([name, percent]) => ({ name, percent: Number(percent) }))
            .sort((a, b) => b.percent - a.percent)
        : []

    if (fromStats.length > 0) return fromStats.slice(0, 6)

    const files = flattenFiles(tree, [])
    const extToLang = {
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".py": "Python",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".cpp": "C++",
        ".c": "C",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
    }
    const counts = new Map()
    for (const f of files) {
        const lang = extToLang[(f.ext || "").toLowerCase()]
        if (!lang) continue
        counts.set(lang, (counts.get(lang) || 0) + 1)
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    if (!total) return [{ name: "Unknown", percent: 100 }]

    return [...counts.entries()]
        .map(([name, count]) => ({ name, percent: Math.round((count / total) * 100) }))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 6)
}

function inferDominantCodeLanguage(files, stats) {
    const extToLang = {
        ".js": "JavaScript",
        ".jsx": "JavaScript/React",
        ".ts": "TypeScript",
        ".tsx": "TypeScript/React",
        ".py": "Python",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".cpp": "C++",
        ".c": "C",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
        ".kt": "Kotlin",
        ".swift": "Swift",
    }

    const ignoreExt = new Set([
        ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".xml",
        ".css", ".scss", ".html", ".lock", ".svg"
    ])

    const score = new Map()
    for (const file of files) {
        const ext = (file.ext || "").toLowerCase()
        if (!ext || ignoreExt.has(ext) || !extToLang[ext]) continue
        const lang = extToLang[ext]
        const weight = Math.max(1, Number(file.lines) || 1)
        score.set(lang, (score.get(lang) || 0) + weight)
    }

    if (score.size === 0) {
        const fallback = stats?.primaryLanguage
        if (!fallback || fallback.toLowerCase() === "markdown") return "Unknown (docs-heavy repository)"
        return fallback
    }

    return [...score.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
