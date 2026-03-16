import { useState } from "react"
import useAppStore from "../../store/useAppStore"
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
    const fileExplanation = useAppStore((s) => s.fileExplanation)
    const isExplaining = useAppStore((s) => s.isExplainingFile)
    const rawFileContent = useAppStore((s) => s.rawFileContent)
    const isFetchingRaw = useAppStore((s) => s.isFetchingRaw)

    const [activeTab, setActiveTab] = useState("explain")

    // reset tab when file changes
    const prevFile = useAppStore(s => s.previousSelectedFile)
    if (selectedFile !== prevFile) {
        useAppStore.setState({ previousSelectedFile: selectedFile })
        setActiveTab("explain")
    }

    if (!selectedFile) {
        return (
            <div className="detail" style={{ alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--color-ghost)" }}>select a file to analyze</span>
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
                            <div style={{ padding: "20px", color: "#8a7f6e", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
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
