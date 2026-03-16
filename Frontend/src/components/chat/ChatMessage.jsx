export default function ChatMessage({ message, userEmail }) {
    const isUser = message.role === "user"
    const initial = userEmail ? userEmail[0].toUpperCase() : "U"

    return (
        <div className="cmsg">
            <div className={`cav ${isUser ? "cav-u" : "cav-a"}`}>
                {isUser ? initial : "AI"}
            </div>
            <div className="cmt">
                {isUser ? message.content : <ChatMarkdown text={message.content} />}
            </div>
        </div>
    )
}

/** Render chat text with line breaks, **bold**, `code`, and bullet lists */
function ChatMarkdown({ text }) {
    if (!text) return null

    const trimmed = text.trim()
    if (!trimmed) return null

    // split on double newlines for paragraphs
    const blocks = trimmed.split(/\n\n+/)

    return (
        <>
            {blocks.map((block, bi) => {
                const lines = block.split("\n").filter((l) => l.trim() !== "")

                // detect markdown table
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
                        <table className="fn-table" key={bi} style={{ margin: "8px 0" }}>
                            <thead>
                                <tr>
                                    {headers.map((h, hi) => (
                                        <td key={hi} className="fn-name" style={{ fontWeight: 600 }}>
                                            <Inline text={h} />
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
                                                    <Inline text={cell} />
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )
                }

                // bullet list
                const isList = lines.length > 0 && lines.every(
                    (l) => /^[-*•]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim())
                )

                if (isList) {
                    return (
                        <ul key={bi} style={{ paddingLeft: "14px", margin: "4px 0", listStyle: "none" }}>
                            {lines.map((line, li) => (
                                <li key={li} style={{ padding: "1px 0", display: "flex", gap: "5px", alignItems: "flex-start" }}>
                                    <span style={{ color: "var(--color-ghost)", flexShrink: 0, fontSize: "7px", marginTop: "5px" }}>●</span>
                                    <span><Inline text={line.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "")} /></span>
                                </li>
                            ))}
                        </ul>
                    )
                }

                // regular paragraph
                return (
                    <p key={bi} style={{ margin: bi > 0 ? "6px 0 0" : "0" }}>
                        {lines.map((line, li) => (
                            <span key={li}>
                                <Inline text={line} />
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
function Inline({ text }) {
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
