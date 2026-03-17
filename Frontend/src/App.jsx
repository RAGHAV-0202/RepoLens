import { useEffect } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import useAppStore from "./store/useAppStore"
import useAuth from "./hooks/useAuth"
import LandingPage from "./pages/LandingPage"
import AppPage from "./pages/AppPage"
import HistoryPage from "./pages/HistoryPage"
import DashboardPage from "./pages/DashboardPage"
import SharePage from "./pages/SharePage"
import LoginForm from "./components/auth/LoginForm"
import RegisterForm from "./components/auth/RegisterForm"

const BASE_TITLE = "RepoLens"

function getRouteTitle(pathname) {
    if (pathname === "/") return `Understand Codebases Fast | ${BASE_TITLE}`
    if (pathname === "/login") return `Sign In | ${BASE_TITLE}`
    if (pathname === "/register") return `Create Account | ${BASE_TITLE}`
    if (pathname === "/dashboard") return `Dashboard | ${BASE_TITLE}`
    if (pathname === "/app") return `Analysis Workspace | ${BASE_TITLE}`
    if (pathname === "/history") return `History | ${BASE_TITLE}`
    if (pathname.startsWith("/share/")) return `Shared Analysis | ${BASE_TITLE}`
    return BASE_TITLE
}

function ProtectedRoute({ children }) {
    const user = useAppStore((s) => s.user)
    const authChecked = useAppStore((s) => s.authChecked)

    if (!authChecked) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-base">
                <p className="font-mono text-[11px] text-ghost">loading…</p>
            </div>
        )
    }

    if (!user) return <Navigate to="/login" replace />
    return children
}

export default function App() {
    useAuth()
    const location = useLocation()

    useEffect(() => {
        document.title = getRouteTitle(location.pathname)
    }, [location.pathname])

    return (
        <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route
                path="/"
                element={<LandingPage />}
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/app"
                element={<AppPage />}
            />
            <Route
                path="/history"
                element={
                    <ProtectedRoute>
                        <HistoryPage />
                    </ProtectedRoute>
                }
            />
            <Route path="/share/:sessionId" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
