import { useEffect, useMemo, useState } from "react"
import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"
import { API_BASE_URL, getAuthHeaders } from "../../services/api"

function flattenFiles(node, acc = []) {
    if (!node) return acc
    if (node.type === "file") {
        acc.push(node)
        return acc
    }
    if (Array.isArray(node.children)) {
        node.children.forEach((c) => flattenFiles(c, acc))
    }
    return acc
}

function pickPaths(files, matcher, limit = 3) {
    return files
        .filter((f) => matcher((f.path || "").toLowerCase(), (f.name || "").toLowerCase()))
        .slice(0, limit)
        .map((f) => f.path)
}

function calcQuality(files, stats, depScore) {
    const top = files.map((f) => (f.path || "").toLowerCase())

    const layerSignals = ["/routes/", "/controllers/", "/services/", "/models/", "/components/", "/pages/"]
    const layersFound = layerSignals.filter((token) => top.some((p) => p.includes(token))).length
    const structure = Math.round(Math.min(100, 38 + layersFound * 10))

    const hasReadme = top.some((p) => /(^|\/)readme\.md$/.test(p))
    const hasDocs = top.some((p) => p.includes("/docs/") || p.includes("/documentation/"))
    const docs = Math.min(100, (hasReadme ? 70 : 40) + (hasDocs ? 20 : 0) + (stats?.totalFiles > 30 ? 10 : 0))

    const testFiles = files.filter((f) => /test|spec|__tests__|cypress|playwright/i.test(f.path || "")).length
    const tests = Math.min(100, testFiles === 0 ? 28 : Math.round(35 + Math.min(55, testFiles * 7)))

    const hasEntry = files.some((f) => f.badge === "entry")
    const hasFlowLayers = ["/routes/", "/controllers/", "/services/", "/models/"].filter((token) => top.some((p) => p.includes(token))).length
    const execution = Math.min(100, (hasEntry ? 52 : 36) + hasFlowLayers * 10)

    const dependency = Number.isFinite(depScore) ? depScore : 70

    const overall = Math.round((structure + docs + tests + execution + dependency) / 5)

    return {
        overall,
        grade: overall >= 85 ? "A" : overall >= 72 ? "B" : overall >= 58 ? "C" : "D",
        rows: [
            { name: "structure", score: structure },
            { name: "docs", score: docs },
            { name: "tests", score: tests },
            { name: "execution", score: execution },
            { name: "dependency hygiene", score: dependency },
        ],
    }
}

function inferFlows(files) {
    const backend = [
        {
            step: "entry",
            files: pickPaths(files, (p, n) => /(^|\/)(app|server|main|index)\.(js|ts|py|go|java|rs)$/.test(p) || n === "manage.py"),
        },
        { step: "routes", files: pickPaths(files, (p) => p.includes("/routes/")) },
        { step: "controllers", files: pickPaths(files, (p) => p.includes("/controllers/") || p.includes("controller")) },
        { step: "services", files: pickPaths(files, (p) => p.includes("/services/") || p.includes("service")) },
        { step: "data", files: pickPaths(files, (p) => /\/models\/|schema|prisma|entity|migration/.test(p)) },
    ]

    const frontend = [
        {
            step: "entry",
            files: pickPaths(files, (p) => /(^|\/)src\/(main\.(jsx|tsx|js|ts)|index\.(jsx|tsx|js|ts))$/.test(p) || /(^|\/)(main\.(jsx|tsx))$/.test(p)),
        },
        { step: "pages/routes", files: pickPaths(files, (p) => p.includes("/pages/") || p.includes("router")) },
        { step: "components", files: pickPaths(files, (p) => p.includes("/components/")) },
        { step: "hooks/store", files: pickPaths(files, (p) => p.includes("/hooks/") || p.includes("/store/")) },
        { step: "api/services", files: pickPaths(files, (p) => p.includes("/services/") || /api\.(js|ts)$/.test(p)) },
    ]

    return {
        backend: backend.filter((s) => s.files.length > 0),
        frontend: frontend.filter((s) => s.files.length > 0),
    }
}

function parsePackageJson(raw, fileNames) {
    let obj
    try {
        obj = JSON.parse(raw)
    } catch {
        return {
            score: 55,
            risks: [{ level: "warn", text: "package.json could not be parsed" }],
            packages: [],
        }
    }

    const all = {
        ...(obj.dependencies || {}),
        ...(obj.devDependencies || {}),
        ...(obj.peerDependencies || {}),
    }

    const entries = Object.entries(all)
    const count = entries.length
    const lockPresent = fileNames.has("package-lock.json") || fileNames.has("yarn.lock") || fileNames.has("pnpm-lock.yaml")

    let score = 100
    const risks = []

    if (!lockPresent && count > 0) {
        score -= 24
        risks.push({ level: "high", text: "No lockfile found for Node dependencies" })
    }

    if (count > 80) {
        score -= 18
        risks.push({ level: "warn", text: `Large dependency surface (${count} packages)` })
    } else if (count > 40) {
        score -= 10
        risks.push({ level: "warn", text: `Moderate dependency surface (${count} packages)` })
    }

    const loose = entries.filter(([, v]) => /^(\^|~|>=|>|<)|\*|x|latest|\|\|/i.test(String(v).trim())).length
    if (loose > 0) {
        const pct = Math.round((loose / Math.max(1, count)) * 100)
        score -= pct > 60 ? 14 : 8
        risks.push({ level: "warn", text: `Loose version ranges used in ${loose} packages (${pct}%)` })
    }

    const preOne = entries.filter(([, v]) => /(^|[^\d])0\.\d+/.test(String(v))).length
    if (preOne > 0) {
        score -= 6
        risks.push({ level: "info", text: `${preOne} packages pinned to pre-1.0 versions` })
    }

    const packages = entries
        .slice(0, 10)
        .map(([name, version]) => ({ name, version: String(version) }))

    return { score: Math.max(25, Math.round(score)), risks, packages }
}

function parseRequirements(raw) {
    const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))

    const parsed = lines.map((line) => {
        const m = line.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~]{1,2})\s*([^\s;]+)/)
        if (!m) return { name: line, op: "", version: "" }
        return { name: m[1], op: m[2], version: m[3] }
    })

    const count = parsed.length
    let score = 100
    const risks = []

    const unpinned = parsed.filter((d) => d.op !== "==").length
    if (unpinned > 0) {
        const pct = Math.round((unpinned / Math.max(1, count)) * 100)
        score -= pct > 60 ? 16 : 9
        risks.push({ level: "warn", text: `Unpinned python deps: ${unpinned}/${count}` })
    }

    return {
        score: Math.max(30, Math.round(score)),
        risks,
        packages: parsed.slice(0, 10).map((d) => ({ name: d.name, version: d.op ? `${d.op}${d.version}` : "unparsed" })),
    }
}

export default function FlowPanel() {
    const tree = useAppStore((s) => s.tree)
    const stats = useAppStore((s) => s.stats)
    const sessionId = useAppStore((s) => s.sessionId)
    const selectFile = useAppStore((s) => s.selectFile)
    const setSidebarView = useAppStore((s) => s.setSidebarView)
    const { explain } = useFileExplain()

    const files = useMemo(() => flattenFiles(tree, []), [tree])
    const fileNames = useMemo(() => new Set(files.map((f) => (f.name || "").toLowerCase())), [files])
    const flows = useMemo(() => inferFlows(files), [files])

    const [depScan, setDepScan] = useState({
        loading: false,
        score: 70,
        risks: [],
        packages: [],
        source: "heuristic",
    })

    const pkg = useMemo(
        () => files.find((f) => (f.name || "").toLowerCase() === "package.json"),
        [files]
    )
    const req = useMemo(
        () => files.find((f) => (f.name || "").toLowerCase() === "requirements.txt"),
        [files]
    )

    useEffect(() => {
        if (!sessionId || files.length === 0 || (!pkg && !req)) return

        let cancelled = false

        const fetchRaw = async (filePath) => {
            const res = await fetch(`${API_BASE_URL}/analyze/raw?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`, {
                headers: getAuthHeaders(),
                credentials: "include",
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()
            return json?.data?.content || ""
        }

        ;(async () => {
            try {
                if (pkg) {
                    const raw = await fetchRaw(pkg.path)
                    const parsed = parsePackageJson(raw, fileNames)
                    if (!cancelled) setDepScan({ loading: false, ...parsed, source: pkg.path })
                    return
                }

                if (req) {
                    const raw = await fetchRaw(req.path)
                    const parsed = parseRequirements(raw)
                    if (!cancelled) setDepScan({ loading: false, ...parsed, source: req.path })
                    return
                }
            } catch {
                if (!cancelled) {
                    setDepScan({
                        loading: false,
                        score: 65,
                        risks: [{ level: "warn", text: "Dependency scan fallback used (raw fetch failed)" }],
                        packages: [],
                        source: "heuristic",
                    })
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [sessionId, files, fileNames, pkg, req])

    const depScanView = (!pkg && !req)
        ? {
            loading: false,
            score: 72,
            risks: [{ level: "info", text: "No standard dependency manifest found" }],
            packages: [],
            source: "heuristic",
        }
        : depScan

    const quality = useMemo(() => calcQuality(files, stats, depScanView.score), [files, stats, depScanView.score])

    const openPath = (path) => {
        const file = files.find((f) => f.path === path)
        if (!file) return
        setSidebarView("files")
        selectFile({ name: file.name, path: file.path, ext: file.ext, badge: file.badge, preferredTab: "code" })
        if (sessionId) explain(sessionId, file.path)
    }

    const RiskDot = ({ level }) => {
        const color = level === "high" ? "#e55" : level === "warn" ? "#f5a623" : "#4c8"
        return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
    }

    return (
        <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ghost)", marginBottom: 10 }}>
                Flow Mode
            </div>

            <div className="ov-card" style={{ marginBottom: 12 }}>
                <div className="ov-card-title">Quality Scorecard</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{quality.overall}</div>
                    <div style={{ fontSize: 12, color: "var(--color-secondary)" }}>grade {quality.grade}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {quality.rows.map((row) => (
                        <div key={row.name}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--color-ghost)", marginBottom: 3 }}>
                                <span>{row.name}</span>
                                <span>{row.score}</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 999, background: "var(--color-active)" }}>
                                <div style={{ height: 5, borderRadius: 999, width: `${row.score}%`, background: "var(--color-ink)" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ov-card" style={{ marginBottom: 12 }}>
                <div className="ov-card-title">Dependency Risk & Outdated Scan</div>
                {depScanView.loading ? (
                    <div className="ov-prose">scanning dependency manifests...</div>
                ) : (
                    <>
                        <div style={{ fontSize: 12, marginBottom: 8, color: "var(--color-secondary)" }}>
                            hygiene score: <b style={{ color: "var(--color-ink)" }}>{depScanView.score}</b>
                            {depScanView.source ? <span style={{ color: "var(--color-ghost)" }}> · source: {depScanView.source}</span> : null}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                            {depScanView.risks.length === 0 ? (
                                <div className="ov-prose">No major dependency risk signals detected.</div>
                            ) : depScanView.risks.map((r, i) => (
                                <div key={i} style={{ display: "flex", gap: 8 }}>
                                    <RiskDot level={r.level} />
                                    <div className="ov-prose">{r.text}</div>
                                </div>
                            ))}
                        </div>
                        {depScanView.packages.length > 0 && (
                            <div>
                                <div style={{ fontSize: 10, color: "var(--color-ghost)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    sample packages
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {depScanView.packages.map((p) => (
                                        <span key={`${p.name}:${p.version}`} className="pill pill-c" style={{ fontFamily: "var(--font-mono)" }}>
                                            {p.name}@{p.version}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="ov-card" style={{ marginBottom: 0 }}>
                <div className="ov-card-title">Execution Flow Mapper</div>

                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        backend flow
                    </div>
                    {flows.backend.length === 0 ? (
                        <div className="ov-prose">No clear backend flow detected.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {flows.backend.map((row) => (
                                <div key={row.step} className="kv" style={{ padding: "6px 0" }}>
                                    <div className="kv-k" style={{ width: 88 }}>{row.step}</div>
                                    <div className="kv-v" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {row.files.map((path) => (
                                            <button
                                                key={path}
                                                onClick={() => openPath(path)}
                                                className="chat-citation"
                                                style={{ fontSize: 10.5 }}
                                                title="Open file"
                                            >
                                                {path}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div style={{ fontSize: 10, color: "var(--color-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        frontend flow
                    </div>
                    {flows.frontend.length === 0 ? (
                        <div className="ov-prose">No clear frontend flow detected.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {flows.frontend.map((row) => (
                                <div key={row.step} className="kv" style={{ padding: "6px 0" }}>
                                    <div className="kv-k" style={{ width: 88 }}>{row.step}</div>
                                    <div className="kv-v" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {row.files.map((path) => (
                                            <button
                                                key={path}
                                                onClick={() => openPath(path)}
                                                className="chat-citation"
                                                style={{ fontSize: 10.5 }}
                                                title="Open file"
                                            >
                                                {path}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
