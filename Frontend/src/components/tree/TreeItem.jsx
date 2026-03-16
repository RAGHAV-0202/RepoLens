import { useState, useCallback, useEffect } from "react"
import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"

export default function TreeItem({ node, depth = 0 }) {
    const selectedFile = useAppStore((s) => s.selectedFile)
    const selectFile = useAppStore((s) => s.selectFile)
    const sessionId = useAppStore((s) => s.sessionId)
    const { explain } = useFileExplain()

    const [open, setOpen] = useState(depth === 0)

    const isFolder = node.type === "directory"

    // Auto-expand folder if the selected file is inside it
    useEffect(() => {
        if (isFolder && selectedFile?.path?.startsWith(node.path + "/")) {
            setOpen(true)
        }
    }, [isFolder, selectedFile?.path, node.path])

    const isActive = !isFolder && selectedFile?.path === node.path

    const handleClick = useCallback(() => {
        if (isFolder) {
            setOpen((prev) => !prev)
        } else {
            selectFile({ name: node.name, path: node.path, ext: node.ext, badge: node.badge })
            if (sessionId) explain(sessionId, node.path)
        }
    }, [isFolder, node, selectFile, sessionId, explain])

    // build indentation spacers
    const indents = []
    for (let i = 0; i < depth; i++) {
        indents.push(<div className="ind" key={i} />)
    }

    return (
        <div>
            <div
                className={`ti ${isActive ? "sel" : ""}`}
                onClick={handleClick}
            >
                {indents}

                {/* chevron */}
                {isFolder ? (
                    <div className={`chev ${open ? "open" : ""}`}>▶</div>
                ) : (
                    <div className="chev" style={{ visibility: "hidden" }}>▶</div>
                )}

                {/* icon */}
                <div className="ico">{isFolder ? "◫" : "◻"}</div>

                {/* name */}
                <div className="tname">
                    {node.name}{isFolder ? "/" : ""}
                </div>

                {/* badge */}
                {node.badge && (
                    <div className="tbadge">{node.badge}</div>
                )}
            </div>

            {/* children */}
            {isFolder && open && node.children && (
                <div>
                    {node.children.map((child, i) => (
                        <TreeItem
                            key={child.path || `${child.name}-${i}`}
                            node={child}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
