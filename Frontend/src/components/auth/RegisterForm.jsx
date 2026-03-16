import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api, { setStoredAuthTokens } from "../../services/api"
import useAppStore from "../../store/useAppStore"

export default function RegisterForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const setUser = useAppStore((s) => s.setUser)
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        if (password.length < 8) {
            setError("password must be at least 8 characters")
            return
        }
        setLoading(true)
        try {
            const res = await api.post("/auth/register", { email, password })
            const payload = res.data?.data || {}
            setStoredAuthTokens(payload)
            setUser(payload.user || payload)
            navigate("/")
        } catch (err) {
            setError(err.response?.data?.message || "registration failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-wrap">
            <form onSubmit={handleSubmit} className="auth-form">
                <div className="logo" style={{ marginBottom: "4px" }}>repo<em>lens</em></div>
                <p style={{ fontSize: "11px", color: "var(--color-faint)", marginBottom: "8px" }}>
                    create an account
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
                    placeholder="password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit" className="auth-btn" disabled={loading}>
                    {loading ? "creating account…" : "register"}
                </button>

                <p style={{ fontSize: "10px", color: "var(--color-faint)", textAlign: "center", marginTop: "12px" }}>
                    already have an account?{" "}
                    <Link to="/login" style={{ color: "var(--color-ink)", textDecoration: "underline" }}>sign in</Link>
                </p>
            </form>
        </div>
    )
}
