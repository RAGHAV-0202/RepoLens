import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"

// ── language → color map ────────────────────────────────────────────────
const LANG_COLORS = {
    ".js": "#c9a227", ".jsx": "#c9a227", ".mjs": "#c9a227",
    ".ts": "#3178c6", ".tsx": "#3178c6",
    ".py": "#3572A5", ".go": "#00ADD8", ".rs": "#dea584",
    ".java": "#b07219", ".cpp": "#f34b7d", ".c": "#555555",
    ".cs": "#68217a", ".rb": "#CC342D", ".php": "#4F5D95",
    ".swift": "#F05138", ".kt": "#A97BFF",
    ".html": "#e34c26", ".css": "#563d7c", ".scss": "#563d7c",
    ".sh": "#89e051", ".md": "#b0a990", ".json": "#b0a990",
}
const FALLBACK_COLOR = "#8a8578"

const NODE_W = 140
const NODE_H = 32
const PADDING = 60

// Simple force-directed-ish layout using a grid with layering
function layoutNodes(nodes, edges) {
    if (nodes.length === 0) return []

    // Build adjacency: who imports whom
    const outgoing = new Map() // file → files it imports
    const incoming = new Map() // file → files that import it
    const pathToIdx = new Map()
    nodes.forEach((n, i) => pathToIdx.set(n.path, i))

    for (const [src, tgt] of edges) {
        if (!pathToIdx.has(src) || !pathToIdx.has(tgt)) continue
        if (!outgoing.has(src)) outgoing.set(src, [])
        outgoing.get(src).push(tgt)
        if (!incoming.has(tgt)) incoming.set(tgt, [])
        incoming.get(tgt).push(src)
    }

    // Topological-ish layering: files with no incoming edges go first
    const layers = []
    const placed = new Set()

    // Layer 0: root files (no incoming)
    const roots = nodes.filter(n => !incoming.has(n.path) || incoming.get(n.path).length === 0)
    if (roots.length > 0) {
        layers.push(roots.map(n => n.path))
        roots.forEach(n => placed.add(n.path))
    }

    // Subsequent layers: BFS from roots
    let maxIter = 20
    while (placed.size < nodes.length && maxIter-- > 0) {
        const nextLayer = []
        const prevLayer = layers[layers.length - 1] || []
        for (const path of prevLayer) {
            const deps = outgoing.get(path) || []
            for (const dep of deps) {
                if (!placed.has(dep)) {
                    placed.add(dep)
                    nextLayer.push(dep)
                }
            }
        }
        // Also add any unplaced nodes
        if (nextLayer.length === 0) {
            for (const n of nodes) {
                if (!placed.has(n.path)) {
                    placed.add(n.path)
                    nextLayer.push(n.path)
                }
            }
        }
        if (nextLayer.length > 0) layers.push(nextLayer)
    }

    // Assign positions
    const positions = new Map()
    const colSpacing = NODE_W + PADDING
    const rowSpacing = NODE_H + PADDING

    for (let row = 0; row < layers.length; row++) {
        const layer = layers[row]
        const totalWidth = layer.length * colSpacing
        const startX = -totalWidth / 2 + colSpacing / 2
        for (let col = 0; col < layer.length; col++) {
            positions.set(layer[col], {
                x: startX + col * colSpacing,
                y: row * rowSpacing,
            })
        }
    }

    return positions
}

export default function DependencyGraph() {
    const depGraph = useAppStore((s) => s.dependencyGraph)
    const selectFile = useAppStore((s) => s.selectFile)
    const selectedFile = useAppStore((s) => s.selectedFile)
    const sessionId = useAppStore((s) => s.sessionId)
    const { explain } = useFileExplain()

    const svgRef = useRef(null)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [dragging, setDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [hovered, setHovered] = useState(null)

    const { nodes, edges } = depGraph || { nodes: [], edges: [] }

    const positions = useMemo(() => layoutNodes(nodes, edges), [nodes, edges])

    // Center the graph on mount
    useEffect(() => {
        if (positions.size === 0 || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        // Find bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const pos of positions.values()) {
            minX = Math.min(minX, pos.x)
            maxX = Math.max(maxX, pos.x + NODE_W)
            minY = Math.min(minY, pos.y)
            maxY = Math.max(maxY, pos.y + NODE_H)
        }
        const graphW = maxX - minX + PADDING * 2
        const graphH = maxY - minY + PADDING * 2
        const scaleX = rect.width / graphW
        const scaleY = rect.height / graphH
        const scale = Math.min(scaleX, scaleY, 1.2)
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        setZoom(scale)
        setPan({ x: rect.width / 2 - cx * scale, y: rect.height / 2 - cy * scale })
    }, [positions])

    const handleWheel = useCallback((e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(z => Math.min(3, Math.max(0.2, z * delta)))
    }, [])

    const handleMouseDown = useCallback((e) => {
        if (e.target.closest(".dep-node")) return
        setDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }, [pan])

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }, [dragging, dragStart])

    const handleMouseUp = useCallback(() => setDragging(false), [])

    const handleNodeClick = useCallback((node) => {
        selectFile({ name: node.name, path: node.path, ext: node.ext })
        useAppStore.getState().setSidebarView("files")
        if (sessionId) explain(sessionId, node.path)
    }, [selectFile, sessionId, explain])

    if (nodes.length === 0) {
        return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🔗</span>
                <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>no import dependencies detected</span>
                <span style={{ fontSize: "10px", color: "var(--color-ghost)", maxWidth: "260px", textAlign: "center", lineHeight: 1.6 }}>
                    Try re-analyzing the repository to generate the dependency graph.
                </span>
            </div>
        )
    }

    // Build edge path data
    const edgePaths = edges.map(([src, tgt], i) => {
        const srcPos = positions.get(src)
        const tgtPos = positions.get(tgt)
        if (!srcPos || !tgtPos) return null

        const x1 = srcPos.x + NODE_W / 2
        const y1 = srcPos.y + NODE_H
        const x2 = tgtPos.x + NODE_W / 2
        const y2 = tgtPos.y
        const cy1 = y1 + (y2 - y1) * 0.4
        const cy2 = y2 - (y2 - y1) * 0.4

        const isHighlighted = hovered === src || hovered === tgt ||
            selectedFile?.path === src || selectedFile?.path === tgt

        return {
            key: i,
            d: `M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}`,
            highlighted: isHighlighted,
            src, tgt
        }
    }).filter(Boolean)

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-ink)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Dependency Graph
                </div>
                <div style={{ fontSize: "10px", color: "var(--color-ghost)" }}>
                    {nodes.length} files · {edges.length} imports · scroll to zoom · drag to pan
                </div>
            </div>

            {/* canvas */}
            <div
                ref={svgRef}
                style={{ flex: 1, overflow: "hidden", cursor: dragging ? "grabbing" : "grab", position: "relative", background: "var(--color-base)" }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <svg width="100%" height="100%" style={{ display: "block" }}>
                    <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                        {/* marker for arrowheads */}
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                                <path d="M0,0 L10,3 L0,6 Z" fill="var(--color-ghost)" />
                            </marker>
                            <marker id="arrow-hl" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                                <path d="M0,0 L10,3 L0,6 Z" fill="var(--color-ink)" />
                            </marker>
                        </defs>

                        {/* edges */}
                        {edgePaths.map(ep => (
                            <path
                                key={ep.key}
                                d={ep.d}
                                fill="none"
                                stroke={ep.highlighted ? "var(--color-ink)" : "var(--color-border)"}
                                strokeWidth={ep.highlighted ? 1.5 : 1}
                                opacity={ep.highlighted ? 0.9 : 0.5}
                                markerEnd={ep.highlighted ? "url(#arrow-hl)" : "url(#arrow)"}
                                style={{ transition: "stroke 0.15s, opacity 0.15s" }}
                            />
                        ))}

                        {/* nodes */}
                        {nodes.map((node) => {
                            const pos = positions.get(node.path)
                            if (!pos) return null
                            const isSelected = selectedFile?.path === node.path
                            const isHovered = hovered === node.path
                            const color = LANG_COLORS[node.ext] || FALLBACK_COLOR

                            return (
                                <g
                                    key={node.path}
                                    className="dep-node"
                                    transform={`translate(${pos.x},${pos.y})`}
                                    style={{ cursor: "pointer" }}
                                    onMouseEnter={() => setHovered(node.path)}
                                    onMouseLeave={() => setHovered(null)}
                                    onClick={() => handleNodeClick(node)}
                                >
                                    <rect
                                        width={NODE_W}
                                        height={NODE_H}
                                        rx="6"
                                        fill="var(--color-surface)"
                                        stroke={isSelected ? color : isHovered ? "var(--color-ink)" : "var(--color-border)"}
                                        strokeWidth={isSelected ? 2 : 1}
                                    />
                                    {/* color accent bar on left edge */}
                                    <rect x="0" y="4" width="3" height={NODE_H - 8} rx="1.5" fill={color} />
                                    {/* file name */}
                                    <text
                                        x="12" y={NODE_H / 2}
                                        dominantBaseline="central"
                                        fill="var(--color-ink)"
                                        fontSize="10"
                                        fontFamily="var(--font-mono)"
                                        fontWeight={isSelected ? "600" : "400"}
                                    >
                                        {node.name.length > 16 ? node.name.slice(0, 15) + "…" : node.name}
                                    </text>
                                </g>
                            )
                        })}
                    </g>
                </svg>
            </div>
        </div>
    )
}
