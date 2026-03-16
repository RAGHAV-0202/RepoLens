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

// Component-aware layered layout with neighbor ordering.
// This keeps weakly connected groups separated and reduces edge crossings.
function layoutNodes(nodes, edges) {
    if (nodes.length === 0) return new Map()

    const nodeByPath = new Map(nodes.map(n => [n.path, n]))
    const paths = nodes.map(n => n.path)

    // Directed + undirected adjacency
    const outgoing = new Map(paths.map(p => [p, new Set()]))
    const incoming = new Map(paths.map(p => [p, new Set()]))
    const undirected = new Map(paths.map(p => [p, new Set()]))

    for (const [src, tgt] of edges) {
        if (!nodeByPath.has(src) || !nodeByPath.has(tgt) || src === tgt) continue
        outgoing.get(src).add(tgt)
        incoming.get(tgt).add(src)
        undirected.get(src).add(tgt)
        undirected.get(tgt).add(src)
    }

    // Find weakly connected components so unrelated groups are separated.
    const visited = new Set()
    const components = []
    for (const start of paths) {
        if (visited.has(start)) continue
        const queue = [start]
        const comp = []
        visited.add(start)
        while (queue.length) {
            const cur = queue.shift()
            comp.push(cur)
            for (const next of undirected.get(cur)) {
                if (visited.has(next)) continue
                visited.add(next)
                queue.push(next)
            }
        }
        components.push(comp)
    }

    const rowSpacing = NODE_H + Math.round(PADDING * 0.95)
    const colSpacing = NODE_W + Math.round(PADDING * 0.8)

    const componentLayouts = []

    for (const comp of components.sort((a, b) => b.length - a.length)) {
        const compSet = new Set(comp)

        // Prefer entry files as roots, then fallback to 0-indegree files.
        const entryRoots = comp.filter(path => nodeByPath.get(path)?.badge === "entry")
        const zeroInRoots = comp.filter(path => {
            let inCount = 0
            for (const src of incoming.get(path)) {
                if (compSet.has(src)) inCount++
            }
            return inCount === 0
        })
        const roots = entryRoots.length > 0
            ? entryRoots
            : (zeroInRoots.length > 0 ? zeroInRoots : [comp[0]])

        // Layer assignment using BFS distance from roots.
        const level = new Map()
        const queue = [...roots]
        for (const r of roots) level.set(r, 0)

        while (queue.length) {
            const cur = queue.shift()
            const curLevel = level.get(cur)
            for (const next of outgoing.get(cur)) {
                if (!compSet.has(next)) continue
                const candidate = curLevel + 1
                if (!level.has(next) || candidate < level.get(next)) {
                    level.set(next, candidate)
                    queue.push(next)
                }
            }
        }

        // Attach unresolved (cyclic/disconnected-in-direction) nodes near known neighbors.
        let safety = comp.length * 3
        while (level.size < comp.length && safety-- > 0) {
            let progressed = false
            for (const path of comp) {
                if (level.has(path)) continue

                let bestFromIncoming = Infinity
                for (const src of incoming.get(path)) {
                    if (compSet.has(src) && level.has(src)) {
                        bestFromIncoming = Math.min(bestFromIncoming, level.get(src) + 1)
                    }
                }

                let bestFromOutgoing = -Infinity
                for (const tgt of outgoing.get(path)) {
                    if (compSet.has(tgt) && level.has(tgt)) {
                        bestFromOutgoing = Math.max(bestFromOutgoing, level.get(tgt) - 1)
                    }
                }

                if (bestFromIncoming !== Infinity) {
                    level.set(path, bestFromIncoming)
                    progressed = true
                } else if (bestFromOutgoing !== -Infinity) {
                    level.set(path, bestFromOutgoing)
                    progressed = true
                }
            }

            if (!progressed) break
        }

        for (const path of comp) {
            if (!level.has(path)) level.set(path, 0)
        }

        const minLevel = Math.min(...level.values())
        for (const path of comp) {
            level.set(path, level.get(path) - minLevel)
        }

        const maxLevel = Math.max(...level.values())
        const layers = Array.from({ length: maxLevel + 1 }, () => [])
        for (const path of comp) {
            layers[level.get(path)].push(path)
        }
        for (const layer of layers) layer.sort((a, b) => a.localeCompare(b))

        // Barycentric sweeps reduce arbitrary left/right placement.
        const order = new Map()
        const rebuildOrder = () => {
            for (const layer of layers) {
                for (let i = 0; i < layer.length; i++) order.set(layer[i], i)
            }
        }
        rebuildOrder()

        const sortLayerByNeighbors = (layerIndex, neighborLayerIndex) => {
            if (neighborLayerIndex < 0 || neighborLayerIndex >= layers.length) return
            const neighborSet = new Set(layers[neighborLayerIndex])
            layers[layerIndex].sort((a, b) => {
                const score = (path) => {
                    const neighbors = []
                    for (const src of incoming.get(path)) if (neighborSet.has(src)) neighbors.push(src)
                    for (const tgt of outgoing.get(path)) if (neighborSet.has(tgt)) neighbors.push(tgt)
                    if (neighbors.length === 0) return Number.POSITIVE_INFINITY
                    let sum = 0
                    for (const n of neighbors) sum += order.get(n)
                    return sum / neighbors.length
                }

                const sa = score(a)
                const sb = score(b)
                if (sa === sb) return a.localeCompare(b)
                return sa - sb
            })
        }

        for (let iter = 0; iter < 5; iter++) {
            for (let l = 1; l < layers.length; l++) sortLayerByNeighbors(l, l - 1)
            rebuildOrder()
            for (let l = layers.length - 2; l >= 0; l--) sortLayerByNeighbors(l, l + 1)
            rebuildOrder()
        }

        const local = new Map()
        let minX = Infinity
        let maxX = -Infinity
        let maxY = 0

        for (let row = 0; row < layers.length; row++) {
            const layer = layers[row]
            const totalWidth = (layer.length - 1) * colSpacing
            for (let col = 0; col < layer.length; col++) {
                const x = col * colSpacing - totalWidth / 2
                const y = row * rowSpacing
                const path = layer[col]
                local.set(path, { x, y })
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x + NODE_W)
                maxY = Math.max(maxY, y + NODE_H)
            }
        }

        componentLayouts.push({
            local,
            minX,
            width: maxX - minX,
            height: maxY,
        })
    }

    // Pack components in rows so unrelated groups don't visually overlap.
    const positions = new Map()
    const maxRowWidth = 2600
    const compGapX = NODE_W + PADDING * 1.6
    const compGapY = NODE_H + PADDING * 1.4
    let cursorX = 0
    let cursorY = 0
    let rowHeight = 0

    for (const comp of componentLayouts) {
        if (cursorX > 0 && cursorX + comp.width > maxRowWidth) {
            cursorX = 0
            cursorY += rowHeight + compGapY
            rowHeight = 0
        }

        const offsetX = cursorX - comp.minX
        const offsetY = cursorY
        for (const [path, pos] of comp.local) {
            positions.set(path, {
                x: pos.x + offsetX,
                y: pos.y + offsetY,
            })
        }

        cursorX += comp.width + compGapX
        rowHeight = Math.max(rowHeight, comp.height)
    }

    // Recenter overall layout around x=0 so auto-fit behaves consistently.
    let gMinX = Infinity
    let gMaxX = -Infinity
    for (const pos of positions.values()) {
        gMinX = Math.min(gMinX, pos.x)
        gMaxX = Math.max(gMaxX, pos.x + NODE_W)
    }
    const shiftX = (gMinX + gMaxX) / 2
    for (const [path, pos] of positions) {
        positions.set(path, { x: pos.x - shiftX, y: pos.y })
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
        e.preventDefault()
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
                style={{
                    flex: 1,
                    overflow: "hidden",
                    cursor: dragging ? "grabbing" : "grab",
                    position: "relative",
                    background: "var(--color-base)",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <svg width="100%" height="100%" style={{ display: "block", userSelect: "none", WebkitUserSelect: "none" }}>
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
                                        style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
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
