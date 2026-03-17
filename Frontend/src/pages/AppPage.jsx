import { useState, useRef, useCallback, useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import useAppStore from "../store/useAppStore"
import api from "../services/api"
import Topbar from "../components/layout/Topbar"
import Sidebar from "../components/layout/Sidebar"
import DetailPanel from "../components/panels/DetailPanel"
import OverviewPanel from "../components/panels/OverviewPanel"
import ChatPanel from "../components/chat/ChatPanel"
import RepoTreemap from "../components/panels/RepoTreemap"
import DependencyGraph from "../components/panels/DependencyGraph"
import FlowPanel from "../components/panels/FlowPanel"

const MIN_SIDEBAR = 160
const MAX_SIDEBAR = 400

export default function AppPage() {
    const user = useAppStore((s) => s.user)
    const authChecked = useAppStore((s) => s.authChecked)
    const sessionId = useAppStore((s) => s.sessionId)
    const sidebarView = useAppStore((s) => s.sidebarView)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const isRestoring = useAppStore((s) => s.isRestoring)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const urlSessionId = searchParams.get("session")
    const setAnalysis = useAppStore((s) => s.setAnalysis)
    const [sidebarWidth, setSidebarWidth] = useState(226)
    const isDragging = useRef(false)
    const startX = useRef(0)
    const startWidth = useRef(0)

    // Keep ?session=<id> in sync with store
    useEffect(() => {
        if (sessionId && !searchParams.get("session")) {
            setSearchParams({ session: sessionId }, { replace: true })
        }
    }, [sessionId, searchParams, setSearchParams])

    useEffect(() => {
        const store = useAppStore.getState()
        const needsResume = Boolean(urlSessionId) && sessionId !== urlSessionId

        if (needsResume && !store.isAnalyzing) {
            // URL session differs from store session (or page was refreshed): resume target session.
            store.setIsAnalyzing(true)
            api.get(`/analyze/resume?sessionId=${urlSessionId}`)
                .then(res => {
                    if (res.data?.success) {
                        setAnalysis(res.data.data)
                    } else {
                        navigate("/dashboard", { replace: true })
                    }
                })
                .catch(() => {
                    navigate("/dashboard", { replace: true })
                })
                .finally(() => {
                    useAppStore.getState().setIsAnalyzing(false)
                })
            return
        }

        if (!urlSessionId && !sessionId && !store.isAnalyzing) {
            navigate("/dashboard", { replace: true })
        }
    }, [urlSessionId, sessionId, navigate, setAnalysis])

    const onMouseDown = useCallback((e) => {
        e.preventDefault()
        isDragging.current = true
        startX.current = e.clientX
        startWidth.current = sidebarWidth
        document.body.style.cursor = "ew-resize"
        document.body.style.userSelect = "none"

        const onMouseMove = (e) => {
            if (!isDragging.current) return
            const delta = e.clientX - startX.current
            const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth.current + delta))
            setSidebarWidth(newWidth)
        }

        const onMouseUp = () => {
            isDragging.current = false
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
    }, [sidebarWidth])

    if (!sessionId && !isAnalyzing) return null

    return (
        <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Topbar />
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <Sidebar width={sidebarWidth} />

                {/* resize handle */}
                <div
                    onMouseDown={onMouseDown}
                    style={{
                        width: "5px",
                        cursor: "ew-resize",
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 10,
                    }}
                >
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "3px",
                        height: "32px",
                        borderRadius: "2px",
                        background: "var(--color-border)",
                    }} />
                </div>

                <div className="main">
                    <div className="panels-row">
                        {sidebarView === "graph" ? <RepoTreemap /> : sidebarView === "deps" ? <DependencyGraph /> : sidebarView === "flow" ? <FlowPanel /> : <DetailPanel />}
                        <OverviewPanel />
                    </div>
                    <ChatPanel />
                </div>
            </div>

            {/* ── restoring session overlay ── */}
            {isRestoring && (
                <div className="overlay-backdrop" style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9998,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px"
                }}>
                    <div style={{
                        width: "24px",
                        height: "24px",
                        border: "2px solid var(--color-border)",
                        borderTopColor: "var(--color-ink)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                    }} />
                    <p style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--color-prose)",
                        letterSpacing: "-0.01em"
                    }}>
                        Hang tight — fetching the repository…
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            )}

            {/* ── unauthenticated guest overlay ── */}
            {!user && authChecked && (
                <div className="overlay-backdrop" style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px"
                }}>
                    <div style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "16px",
                        padding: "40px",
                        maxWidth: "440px",
                        width: "100%",
                        textAlign: "center",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.08)"
                    }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "var(--color-core-bg)",
                            color: "var(--color-core-text)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px",
                            margin: "0 auto 24px",
                            border: "1px solid var(--color-border)"
                        }}>
                            🔒
                        </div>
                        <h2 style={{
                            fontSize: "24px",
                            fontWeight: 700,
                            color: "var(--color-ink)",
                            marginBottom: "12px",
                            letterSpacing: "-0.02em"
                        }}>
                            Sign in to explore
                        </h2>
                        <p style={{
                            fontSize: "14px",
                            color: "var(--color-prose)",
                            lineHeight: 1.6,
                            marginBottom: "32px"
                        }}>
                            Create a free account to view the full architectural analysis, explore the interactive file tree, and chat with this codebase using AI.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <Link to="/register" style={{
                                width: "100%",
                                padding: "12px",
                                background: "var(--color-ink)",
                                color: "var(--color-base)",
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: "14px",
                                transition: "transform 0.15s"
                            }}>
                                Create free account
                            </Link>
                            <Link to="/login" style={{
                                width: "100%",
                                padding: "12px",
                                background: "var(--color-muted)",
                                color: "var(--color-ink)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontWeight: 500,
                                fontSize: "14px",
                                transition: "background 0.15s"
                            }}>
                                Sign in to existing account
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
