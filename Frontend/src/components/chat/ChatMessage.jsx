import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"

export default function ChatMessage({ message, userEmail }) {
    const isUser = message.role === "user"
    const initial = userEmail ? userEmail[0].toUpperCase() : "U"
    const sessionId = useAppStore((s) => s.sessionId)
    const tree = useAppStore((s) => s.tree)
    const selectFile = useAppStore((s) => s.selectFile)
    const setSidebarView = useAppStore((s) => s.setSidebarView)
    const { explain } = useFileExplain()

    const handleCitationClick = (target) => {
        const citation = parseCitationTarget(target)
        if (!citation) return

        const file = findFileByPath(tree, citation.filePath)
        if (!file) return

        setSidebarView("files")
        selectFile({
            name: file.name,
            path: file.path,
            ext: file.ext,
            badge: file.badge,
            lineStart: citation.startLine,
            lineEnd: citation.endLine,
            preferredTab: "code",
        })

        if (sessionId) explain(sessionId, file.path)
    }

    return (
        <div className="cmsg">
            <div className={`cav ${isUser ? "cav-u" : "cav-a"}`}>
                {isUser ? initial : "AI"}
            </div>
            <div className="cmt">
                {isUser ? message.content : <ChatMarkdown text={message.content} onCitationClick={handleCitationClick} />}
            </div>
        </div>
    )
}

/** Render chat text with line breaks, **bold**, `code`, links and bullet lists */
function ChatMarkdown({ text, onCitationClick }) {
    if (!text) return null

    const trimmed = text.trim()
    if (!trimmed) return null

    const blocks = splitBlocks(trimmed)

    return (
        <>
            {blocks.map((block, bi) => {
                if (block.type === "code") {
                    return (
                        <div className="chat-code-wrap" key={bi}>
                            {block.lang && <div className="chat-code-lang">{block.lang}</div>}
                            <pre className="chat-code-block">
                                <code>{block.content}</code>
                            </pre>
                        </div>
                    )
                }

                const paragraphs = block.content
                    .split(/\n\n+/)
                    .map((p) => p.trim())
                    .filter(Boolean)

                return (
                    <>
                        {paragraphs.map((para, pi) => (
                            <RenderParagraph
                                key={`${bi}-${pi}`}
                                text={para}
                                onCitationClick={onCitationClick}
                            />
                        ))}
                    </>
                )
            })}
        </>
    )
}

function RenderParagraph({ text, onCitationClick }) {
    const lines = text.split("\n").filter((l) => l.trim() !== "")

    const table = parseMarkdownTable(lines)
    if (table) {
        return (
            <div className="chat-table-wrap">
                <table className="chat-table">
                    <thead>
                        <tr>
                            {table.headers.map((h, hi) => (
                                <th key={hi} className="chat-th">
                                    <Inline text={h} onCitationClick={onCitationClick} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((cells, ri) => {
                            const rowFilePath = extractFilePathFromText(cells[0] || "")
                            return (
                                <tr key={ri}>
                                    {cells.map((cell, ci) => (
                                        <td key={ci} className={ci === 0 ? "chat-td chat-td-key" : "chat-td"}>
                                            <Inline
                                                text={cell}
                                                onCitationClick={onCitationClick}
                                                defaultFilePath={ci > 0 ? rowFilePath : null}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    }

    const isList = lines.length > 0 && lines.every(
        (l) => /^[-*•]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim())
    )

    if (isList) {
        return (
            <ul style={{ paddingLeft: "14px", margin: "4px 0", listStyle: "none" }}>
                {lines.map((line, li) => (
                    <li key={li} style={{ padding: "1px 0", display: "flex", gap: "5px", alignItems: "flex-start" }}>
                        <span style={{ color: "var(--color-ghost)", flexShrink: 0, fontSize: "7px", marginTop: "5px" }}>●</span>
                        <span><Inline text={line.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s/, "")} onCitationClick={onCitationClick} /></span>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <p style={{ margin: "4px 0" }}>
            {lines.map((line, li) => (
                <span key={li}>
                    <Inline text={line} onCitationClick={onCitationClick} />
                    {li < lines.length - 1 && <br />}
                </span>
            ))}
        </p>
    )
}

function splitBlocks(text) {
    const lines = text.split("\n")
    const blocks = []
    let textBuffer = []
    let codeBuffer = []
    let inCode = false
    let codeLang = ""

    const flushText = () => {
        const content = textBuffer.join("\n").trim()
        if (content) blocks.push({ type: "text", content })
        textBuffer = []
    }

    const flushCode = () => {
        const content = codeBuffer.join("\n")
        blocks.push({ type: "code", lang: codeLang, content })
        codeBuffer = []
        codeLang = ""
    }

    for (const line of lines) {
        const fence = line.match(/^\s*```+\s*([a-zA-Z0-9_+-]+)?\s*$/)
        if (fence) {
            if (inCode) {
                flushCode()
                inCode = false
            } else {
                flushText()
                inCode = true
                codeLang = fence[1] || ""
            }
            continue
        }

        if (inCode) codeBuffer.push(line)
        else textBuffer.push(line)
    }

    if (inCode) flushCode()
    flushText()

    return blocks
}

function parseMarkdownTable(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return null

    const raw = lines.map((l) => l.trim()).filter(Boolean)
    const separatorIndex = raw.findIndex((line, idx) => idx > 0 && isMarkdownSeparatorRow(line))
    if (separatorIndex <= 0) return null

    const headerLine = raw[separatorIndex - 1]
    if (!headerLine.includes("|")) return null

    const headers = splitTableCells(headerLine)
    if (headers.length === 0) return null

    const rowLines = raw.slice(separatorIndex + 1).filter((line) => line.includes("|"))
    const rows = rowLines.map(splitTableCells).filter((cells) => cells.length > 0)

    return { headers, rows }
}

function isMarkdownSeparatorRow(line) {
    const cells = splitTableCells(line)
    if (cells.length === 0) return false
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
}

function splitTableCells(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
    if (!trimmed.includes("|")) return []
    return trimmed.split("|").map((c) => c.trim())
}

/** Render **bold**, `code`, and [links](target) inline */
function Inline({ text, onCitationClick, defaultFilePath = null }) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)

    return (
        <>
            {parts.map((part, i) => {
                if (!part) return null

                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>
                }

                if (part.startsWith("`") && part.endsWith("`")) {
                    return <code key={i}>{part.slice(1, -1)}</code>
                }

                const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
                if (linkMatch) {
                    const [, label, target] = linkMatch
                    if (isCitationTarget(target)) {
                        return (
                            <button
                                key={i}
                                type="button"
                                className="chat-citation"
                                onClick={() => onCitationClick?.(target)}
                                title="Open cited file and jump to lines"
                            >
                                {label}
                            </button>
                        )
                    }

                    return (
                        <a key={i} href={target} target="_blank" rel="noreferrer" className="chat-link">
                            {label}
                        </a>
                    )
                }

                return (
                    <span key={i}>
                        {renderTextWithAutoCitations(part, onCitationClick, `plain-${i}`, defaultFilePath)}
                    </span>
                )
            })}
        </>
    )
}

function renderTextWithAutoCitations(text, onCitationClick, keyPrefix = "c", defaultFilePath = null) {
    if (!text) return null

    const nodes = []
    let lastIndex = 0

    const re = /`?([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`?\s*\((?:line|lines)\s*(\d+)(?:\s*[-–]\s*(\d+))?\)|`?([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)#L(\d+)(?:-L?(\d+))?`?|\bL(\d+)(?:\s*[-–]\s*L?(\d+))?\b/g
    let m

    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIndex) {
            nodes.push(<span key={`${keyPrefix}-t-${lastIndex}`}>{text.slice(lastIndex, m.index)}</span>)
        }

        const pathA = m[1]
        const startA = m[2]
        const endA = m[3]
        const pathB = m[4]
        const startB = m[5]
        const endB = m[6]

        const startC = m[7]
        const endC = m[8]

        const path = pathA || pathB || defaultFilePath
        const start = Number(startA || startB || startC)
        const end = Number(endA || endB || endC || start)

        if (path && Number.isFinite(start) && start > 0) {
            const target = `${normalizeRepoPath(path)}#L${start}${end > start ? `-L${end}` : ""}`
            nodes.push(
                <button
                    key={`${keyPrefix}-c-${m.index}`}
                    type="button"
                    className="chat-citation"
                    onClick={() => onCitationClick?.(target)}
                    title="Open cited file and jump to lines"
                >
                    {m[0].replace(/`/g, "")}
                </button>
            )
        } else {
            nodes.push(<span key={`${keyPrefix}-f-${m.index}`}>{m[0]}</span>)
        }

        lastIndex = re.lastIndex
    }

    if (lastIndex < text.length) {
        nodes.push(<span key={`${keyPrefix}-tail`}>{text.slice(lastIndex)}</span>)
    }

    return nodes.length > 0 ? nodes : text
}

function extractFilePathFromText(text) {
    if (!text) return null
    const clean = String(text).replace(/`/g, "").trim()
    const m = clean.match(/([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)/)
    return m ? normalizeRepoPath(m[1]) : null
}

function isCitationTarget(target) {
    return !!parseCitationTarget(target)
}

function parseCitationTarget(target) {
    if (!target || typeof target !== "string") return null
    const clean = target.trim()
    const match = clean.match(/^(.+?)#L(\d+)(?:-L?(\d+))?$/i)
    if (!match) return null

    const filePath = normalizeRepoPath(match[1])
    const startLine = Number(match[2])
    const endLine = Number(match[3] || match[2])
    if (!filePath || !Number.isFinite(startLine) || startLine <= 0) return null

    return {
        filePath,
        startLine,
        endLine: endLine >= startLine ? endLine : startLine,
    }
}

function normalizeRepoPath(p) {
    return decodeURIComponent(String(p || ""))
        .replace(/\\\\/g, "/")
        .replace(/^\.?\//, "")
        .replace(/^\/+/, "")
        .trim()
}

function findFileByPath(tree, citationPath) {
    if (!tree || !citationPath) return null
    const target = normalizeRepoPath(citationPath).toLowerCase()
    let fallback = null

    function walk(node) {
        if (!node) return null
        if (node.type === "file") {
            const nodePath = normalizeRepoPath(node.path).toLowerCase()
            if (nodePath === target) return node
            if (!fallback && (nodePath.endsWith(`/${target}`) || target.endsWith(`/${nodePath}`))) {
                fallback = node
            }
            return null
        }

        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                const found = walk(child)
                if (found) return found
            }
        }

        return null
    }

    return walk(tree) || fallback
}
