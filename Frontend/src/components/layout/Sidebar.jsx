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
                    tree
                </button>
                <button
                    className={`view-btn ${sidebarView === "graph" ? "on" : ""}`}
                    onClick={() => setSidebarView("graph")}
                >
                    graph
                </button>
                <button
                    className={`view-btn ${sidebarView === "deps" ? "on" : ""}`}
                    onClick={() => setSidebarView("deps")}
                >
                    deps
                </button>
                <button
                    className={`view-btn ${sidebarView === "flow" ? "on" : ""}`}
                    onClick={() => setSidebarView("flow")}
                >
                    flow
                </button>
            </div>

            <div className="tree-wrap">
                <FileTree />
            </div>
        </div>
    )
}
