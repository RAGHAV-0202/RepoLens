import { useMemo, useState, useCallback } from "react"
import useAppStore from "../../store/useAppStore"

// ── language → color map (warm editorial palette) ──────────────────────
const LANG_COLORS = {
    JavaScript: "#c9a227",
    TypeScript: "#3178c6",
    Python:     "#3572A5",
    Go:         "#00ADD8",
    Rust:       "#dea584",
    Java:       "#b07219",
    "C++":      "#f34b7d",
    C:          "#555555",
    "C#":       "#68217a",
    Ruby:       "#CC342D",
    PHP:        "#4F5D95",
    Swift:      "#F05138",
    Kotlin:     "#A97BFF",
    HTML:       "#e34c26",
    CSS:        "#563d7c",
    Shell:      "#89e051",
    Markdown:   "#b0a990",
    JSON:       "#b0a990",
    YAML:       "#cb171e",
    TOML:       "#9c4221",
    SQL:        "#e38c00",
    XML:        "#0060ac",
    Scala:      "#c22d40",
    R:          "#198ce7",
}

const FALLBACK_COLOR = "#c4bfb3"

function getFileColor(fileName) {
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop().toLowerCase() : ""
    const extMap = {
        ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
        ".ts": "TypeScript", ".tsx": "TypeScript",
        ".py": "Python", ".go": "Go", ".rs": "Rust",
        ".java": "Java", ".cpp": "C++", ".c": "C", ".cs": "C#",
        ".rb": "Ruby", ".php": "PHP", ".swift": "Swift", ".kt": "Kotlin",
        ".html": "HTML", ".css": "CSS", ".scss": "CSS",
        ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
        ".md": "Markdown", ".json": "JSON",
        ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
        ".sql": "SQL", ".xml": "XML", ".scala": "Scala", ".r": "R",
    }
    const lang = extMap[ext]
    return lang ? (LANG_COLORS[lang] || FALLBACK_COLOR) : FALLBACK_COLOR
}

function getLangFromFile(fileName) {
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop().toLowerCase() : ""
    const extMap = {
        ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
        ".ts": "TypeScript", ".tsx": "TypeScript",
        ".py": "Python", ".go": "Go", ".rs": "Rust",
        ".java": "Java", ".cpp": "C++", ".c": "C", ".cs": "C#",
        ".rb": "Ruby", ".php": "PHP", ".swift": "Swift", ".kt": "Kotlin",
        ".html": "HTML", ".css": "CSS", ".scss": "CSS",
        ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
        ".md": "Markdown", ".json": "JSON",
        ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
        ".sql": "SQL", ".xml": "XML", ".scala": "Scala", ".r": "R",
    }
    return extMap[ext] || "Other"
}

// ── flatten tree into file list ────────────────────────────────────────
function flattenTree(node) {
    const files = []
    function walk(n, prefix) {
        if (n.type === "file") {
            files.push({
                name: n.name,
                path: n.path,
                lines: n.lines || 1,
                size: n.size || 0,
                badge: n.badge,
                color: getFileColor(n.name),
                lang: getLangFromFile(n.name),
            })
        }
        if (n.children) {
            for (const child of n.children) {
                walk(child, prefix ? `${prefix}/${n.name}` : n.name)
            }
        }
    }
    if (node) walk(node, "")
    return files
}

// ── squarified treemap layout ──────────────────────────────────────────
function layoutTreemap(items, x, y, w, h) {
    if (items.length === 0) return []

    const totalValue = items.reduce((sum, f) => sum + f.lines, 0)
    if (totalValue === 0) return []

    const rects = []
    const sorted = [...items].sort((a, b) => b.lines - a.lines)

    let cx = x, cy = y, cw = w, ch = h
    let remaining = [...sorted]
    let remainingValue = totalValue

    while (remaining.length > 0) {
        const isWide = cw >= ch
        const side = isWide ? ch : cw

        // find best row
        let row = [remaining[0]]
        let rowValue = remaining[0].lines
        let bestAspect = Infinity

        for (let i = 1; i < remaining.length; i++) {
            const testRow = [...row, remaining[i]]
            const testValue = rowValue + remaining[i].lines
            const rowFraction = testValue / remainingValue
            const rowSize = isWide ? cw * rowFraction : ch * rowFraction

            let worstAspect = 0
            for (const item of testRow) {
                const itemFraction = item.lines / testValue
                const itemSize = side * itemFraction
                const aspect = Math.max(rowSize / itemSize, itemSize / rowSize)
                worstAspect = Math.max(worstAspect, aspect)
            }

            if (worstAspect < bestAspect) {
                bestAspect = worstAspect
                row = testRow
                rowValue = testValue
            } else {
                break
            }
        }

        // lay out the row
        const rowFraction = rowValue / remainingValue
        const rowSize = isWide ? cw * rowFraction : ch * rowFraction
        let offset = 0

        for (const item of row) {
            const itemFraction = item.lines / rowValue
            const itemSize = side * itemFraction

            if (isWide) {
                rects.push({
                    ...item,
                    rx: cx,
                    ry: cy + offset,
                    rw: rowSize,
                    rh: itemSize,
                })
                offset += itemSize
            } else {
                rects.push({
                    ...item,
                    rx: cx + offset,
                    ry: cy,
                    rw: itemSize,
                    rh: rowSize,
                })
                offset += itemSize
            }
        }

        // update remaining area
        if (isWide) {
            cx += rowSize
            cw -= rowSize
        } else {
            cy += rowSize
            ch -= rowSize
        }

        remaining = remaining.slice(row.length)
        remainingValue -= rowValue
    }

    return rects
}

import useFileExplain from "../../hooks/useFileExplain"

// ── component ──────────────────────────────────────────────────────────
export default function RepoTreemap() {
    const tree = useAppStore((s) => s.tree)
    const selectFile = useAppStore((s) => s.selectFile)
    const sessionId = useAppStore((s) => s.sessionId)
    const { explain } = useFileExplain()

    const [hovered, setHovered] = useState(null)
    const [tooltip, setTooltip] = useState({ x: 0, y: 0 })

    const files = useMemo(() => flattenTree(tree), [tree])
    const rects = useMemo(() => layoutTreemap(files, 0, 0, 800, 500), [files])

    // build language legend
    const langCounts = useMemo(() => {
        const counts = {}
        for (const f of files) {
            counts[f.lang] = (counts[f.lang] || 0) + 1
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    }, [files])

    const handleMouseMove = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }, [])

    if (!tree || files.length === 0) {
        return (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>no data to visualize</span>
            </div>
        )
    }

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "14px" }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexShrink: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-ink)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    File Map
                </div>
                <div style={{ fontSize: "10px", color: "var(--color-ghost)" }}>
                    {files.length} files · sized by lines of code
                </div>
            </div>

            {/* treemap */}
            <div
                style={{ flex: 1, position: "relative", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--color-border)", background: "var(--color-surface)", minHeight: 0 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHovered(null)}
            >
                <svg viewBox="0 0 800 500" width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
                    {rects.map((r, i) => (
                        <g key={i}>
                            <rect
                                x={r.rx + 1}
                                y={r.ry + 1}
                                width={Math.max(0, r.rw - 2)}
                                height={Math.max(0, r.rh - 2)}
                                rx="2"
                                fill={r.color}
                                opacity={hovered === i ? 0.95 : 0.7}
                                stroke={hovered === i ? "var(--color-ink)" : "var(--color-surface)"}
                                strokeWidth={hovered === i ? 2 : 1}
                                style={{ cursor: "pointer", transition: "opacity 0.12s, stroke 0.12s" }}
                                onMouseEnter={() => setHovered(i)}
                                onClick={() => {
                                    selectFile(r)
                                    useAppStore.getState().setSidebarView("files")
                                    if (sessionId) explain(sessionId, r.path)
                                }}
                            />
                            {/* show label if rect is large enough */}
                            {r.rw > 50 && r.rh > 20 && (
                                <text
                                    x={r.rx + r.rw / 2}
                                    y={r.ry + r.rh / 2}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill="#fff"
                                    fontSize={Math.min(10, r.rw / 8)}
                                    fontFamily="var(--font-mono)"
                                    fontWeight="500"
                                    style={{ pointerEvents: "none", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                                >
                                    {r.name.length > r.rw / 7 ? r.name.slice(0, Math.floor(r.rw / 7)) + "…" : r.name}
                                </text>
                            )}
                            {r.rw > 60 && r.rh > 34 && (
                                <text
                                    x={r.rx + r.rw / 2}
                                    y={r.ry + r.rh / 2 + 12}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill="rgba(255,255,255,0.7)"
                                    fontSize={Math.min(8, r.rw / 10)}
                                    fontFamily="var(--font-mono)"
                                    style={{ pointerEvents: "none" }}
                                >
                                    {r.lines} lines
                                </text>
                            )}
                        </g>
                    ))}
                </svg>

                {/* tooltip */}
                {hovered !== null && rects[hovered] && (
                    <div style={{
                        position: "absolute",
                        left: tooltip.x + 12,
                        top: tooltip.y - 40,
                        background: "var(--color-ink)",
                        color: "var(--color-base)",
                        padding: "6px 10px",
                        borderRadius: "5px",
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        pointerEvents: "none",
                        zIndex: 100,
                        whiteSpace: "nowrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        lineHeight: 1.5,
                    }}>
                        <div style={{ fontWeight: 600 }}>{rects[hovered].path}</div>
                        <div style={{ opacity: 0.7 }}>{rects[hovered].lines} lines · {rects[hovered].lang}</div>
                    </div>
                )}
            </div>

            {/* legend */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px", flexShrink: 0 }}>
                {langCounts.map(([lang, count]) => (
                    <div key={lang} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9.5px", color: "var(--color-secondary)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: LANG_COLORS[lang] || FALLBACK_COLOR, flexShrink: 0 }} />
                        {lang} <span style={{ color: "var(--color-ghost)" }}>({count})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
