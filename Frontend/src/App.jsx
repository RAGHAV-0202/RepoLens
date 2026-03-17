import { Routes, Route, Navigate } from "react-router-dom"
import useAppStore from "./store/useAppStore"
import useAuth from "./hooks/useAuth"
import LandingPage from "./pages/LandingPage"
import AppPage from "./pages/AppPage"
import HistoryPage from "./pages/HistoryPage"
import DashboardPage from "./pages/DashboardPage"
import SharePage from "./pages/SharePage"
import LoginForm from "./components/auth/LoginForm"
import RegisterForm from "./components/auth/RegisterForm"

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
