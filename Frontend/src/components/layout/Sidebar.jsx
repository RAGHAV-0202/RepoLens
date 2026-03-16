import useAppStore from "../../store/useAppStore"
import FileTree from "../tree/FileTree"

export default function Sidebar({ width }) {
    const sidebarView = useAppStore((s) => s.sidebarView)
    const setSidebarView = useAppStore((s) => s.setSidebarView)

    return (
        <div className="sidebar" style={{ width, minWidth: width }}>
            <div className="sidebar-head">
                <button
                    className={`view-btn ${sidebarView === "files" ? "on" : ""}`}
                    onClick={() => setSidebarView("files")}
                >
                    files
                </button>
                <button
                    className={`view-btn ${sidebarView === "graph" ? "on" : ""}`}
                    onClick={() => setSidebarView("graph")}
                >
                    graph
                </button>
            </div>

            {sidebarView === "files" && (
                <div className="tree-wrap">
                    <FileTree />
                </div>
            )}

            {sidebarView === "graph" && (
                <div className="tree-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "10px", color: "var(--color-ghost)" }}>coming soon</span>
                </div>
            )}
        </div>
    )
}
