import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api, { setStoredAuthTokens } from "../../services/api"
import useAppStore from "../../store/useAppStore"

export default function LoginForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const setUser = useAppStore((s) => s.setUser)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            const res = await api.post("/auth/login", { email, password })
            const payload = res.data?.data || {}
            setStoredAuthTokens(payload)
            setUser(payload.user || payload)
            navigate("/")
        } catch (err) {
            setError(err.response?.data?.message || "login failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-wrap">
            <form onSubmit={handleSubmit} className="auth-form">
                <div className="logo" style={{ marginBottom: "4px" }}>repo<em>lens</em></div>
                <p style={{ fontSize: "11px", color: "var(--color-faint)", marginBottom: "8px" }}>
                    sign in to your account
                </p>

                {error && (
                    <p style={{ fontSize: "11px", color: "var(--color-err)" }}>{error}</p>
                )}

                <input
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit" className="auth-btn" disabled={loading}>
                    {loading ? "signing in…" : "sign in"}
                </button>

                <p style={{ fontSize: "10px", color: "var(--color-faint)", textAlign: "center", marginTop: "12px" }}>
                    don't have an account?{" "}
                    <Link to="/register" style={{ color: "var(--color-ink)", textDecoration: "underline" }}>register</Link>
                </p>
            </form>
        </div>
    )
}
