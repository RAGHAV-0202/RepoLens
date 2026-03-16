import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import useAppStore from "../store/useAppStore"
import useAnalyze from "../hooks/useAnalyze"

const EXAMPLES = [
    "https://github.com/expressjs/express",
    "https://github.com/socketio/socket.io",
    "https://github.com/lodash/lodash",
]

const FEATURES = [
    { icon: "⚡", title: "Instant Analysis", desc: "Clone, index & explain any public repo in seconds" },
    { icon: "🧠", title: "AI-Powered", desc: "LLM-generated explanations for every file & function" },
    { icon: "🗺️", title: "Visual Treemaps", desc: "See your codebase as an interactive language heatmap" },
    { icon: "💬", title: "Chat with Code", desc: "Ask questions about any repo in natural language" },
]

// ── animated gradient background ──────────────────────────────────────────
function AnimatedBackground() {
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none", background: "var(--color-base)" }}>
            <div style={{
                position: "absolute", top: "15%", left: "20%", width: "45vw", height: "45vw",
                background: "radial-gradient(circle, rgba(147, 130, 255, 0.12) 0%, rgba(147, 130, 255, 0) 70%)",
                borderRadius: "50%", filter: "blur(60px)", animation: "float1 14s ease-in-out infinite"
            }} />
            <div style={{
                position: "absolute", top: "40%", right: "15%", width: "40vw", height: "40vw",
                background: "radial-gradient(circle, rgba(100, 200, 255, 0.1) 0%, rgba(100, 200, 255, 0) 70%)",
                borderRadius: "50%", filter: "blur(60px)", animation: "float2 18s ease-in-out infinite"
            }} />
            <div style={{
                position: "absolute", bottom: "-10%", left: "35%", width: "50vw", height: "30vw",
                background: "radial-gradient(circle, rgba(255, 180, 150, 0.08) 0%, rgba(255, 180, 150, 0) 70%)",
                borderRadius: "50%", filter: "blur(60px)", animation: "float3 22s ease-in-out infinite"
            }} />
            <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, transparent 0%, var(--color-base) 100%)",
                opacity: 0.5
            }} />
        </div>
    )
}

// ── main landing page ─────────────────────────────────────────────────────
export default function LandingPage() {
    const [url, setUrl] = useState("")
    const [error, setError] = useState("")
    const user = useAppStore((s) => s.user)
    const isAnalyzing = useAppStore((s) => s.isAnalyzing)
    const { analyze } = useAnalyze()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!url.trim()) return
        setError("")
        try {
            await analyze(url.trim())
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div style={styles.page}>
            <AnimatedBackground />

            {/* ── NAV ── */}
            <nav style={styles.nav}>
                <div style={styles.logoWrap}>
                    <span style={styles.logoDot} />
                    <span style={styles.logoText}>RepoLens</span>
                </div>
                <div style={styles.navLinks}>
                    {user ? (
                        <Link to="/dashboard" style={styles.navCta}>Go to Dashboard</Link>
                    ) : (
                        <>
                            <Link to="/login" style={styles.navLink}>Sign In</Link>
                            <Link to="/register" style={styles.navCta}>Get Started</Link>
                        </>
                    )}
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={styles.hero}>
                <div style={styles.badge}>
                    <span style={styles.badgeDot} />
                    <span style={{ opacity: 0.8 }}>AI-Powered Repository Intelligence</span>
                </div>

                <h1 style={styles.heading}>
                    Understand any codebase<br />
                    <span style={styles.headingGradient}>in seconds, not hours</span>
                </h1>

                <p style={styles.subheading}>
                    Paste a GitHub URL. Get instant AI analysis — architecture breakdowns,
                    file explanations, interactive treemaps, and a chat interface to ask questions.
                </p>

                {/* ── SEARCH BAR ── */}
                <form onSubmit={handleSubmit} style={styles.searchForm}>
                    <div style={styles.searchGlow} />
                    <div style={styles.searchInner}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.5 }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            disabled={isAnalyzing}
                            spellCheck="false"
                            style={styles.searchInput}
                        />
                        <button
                            type="submit"
                            disabled={isAnalyzing || !url.trim()}
                            style={{
                                ...styles.searchBtn,
                                opacity: (isAnalyzing || !url.trim()) ? 0.5 : 1,
                                cursor: isAnalyzing ? "wait" : "pointer",
                            }}
                        >
                            {isAnalyzing ? (
                                <span style={styles.spinner} />
                            ) : (
                                "Analyze →"
                            )}
                        </button>
                    </div>
                </form>

                {error && (
                    <p style={styles.error}>{error}</p>
                )}

                {/* ── EXAMPLE CHIPS ── */}
                <div style={styles.chipRow}>
                    <span style={styles.chipLabel}>try:</span>
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex}
                            onClick={() => !isAnalyzing && setUrl(ex)}
                            style={styles.chip}
                        >
                            {ex.replace("https://github.com/", "")}
                        </button>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={styles.features}>
                {FEATURES.map((f, i) => (
                    <div key={i} style={styles.featureCard} className="feature-card">
                        <div style={styles.featureIcon}>{f.icon}</div>
                        <h3 style={styles.featureTitle}>{f.title}</h3>
                        <p style={styles.featureDesc}>{f.desc}</p>
                    </div>
                ))}
            </section>

            {/* ── FOOTER ── */}
            <footer style={styles.footer}>
                <span style={styles.footerText}>Built with ♥ using React, Node.js & Groq AI</span>
            </footer>
        </div>
    )
}

// ── styles ────────────────────────────────────────────────────────────────
const styles = {
    page: {
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--color-base)",
        color: "var(--color-ink)",
        fontFamily: "'Inter', var(--font-sans)",
        position: "relative",
        overflowX: "hidden",
    },

    // nav
    nav: {
        width: "100%",
        maxWidth: "1200px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 32px",
        position: "relative",
        zIndex: 2,
    },
    logoWrap: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    logoDot: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "var(--color-ink)",
    },
    logoText: {
        fontSize: "18px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: "var(--color-ink)",
    },
    navLinks: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    navLink: {
        fontSize: "13px",
        color: "var(--color-secondary)",
        textDecoration: "none",
        transition: "color 0.2s",
        fontWeight: 500,
    },
    navCta: {
        fontSize: "13px",
        color: "var(--color-base)",
        background: "var(--color-ink)",
        padding: "7px 18px",
        borderRadius: "8px",
        textDecoration: "none",
        fontWeight: 600,
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: "0 4px 14px 0 rgba(0,0,0,0.1)",
    },

    // hero
    hero: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "80px 24px 48px",
        position: "relative",
        zIndex: 2,
        maxWidth: "760px",
    },
    badge: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--color-ink)",
        background: "rgba(255, 255, 255, 0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0,0,0,0.05)",
        borderRadius: "100px",
        padding: "6px 18px",
        marginBottom: "28px",
        letterSpacing: "0.01em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
    },
    badgeDot: {
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "#9382ff", // Premium purple accent
        boxShadow: "0 0 8px rgba(147,130,255,0.8)",
        animation: "pulse 2s ease-in-out infinite",
    },
    heading: {
        fontSize: "clamp(42px, 6vw, 64px)",
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: "-0.04em",
        margin: "0 0 24px 0",
        color: "var(--color-ink)",
    },
    headingGradient: {
        background: "linear-gradient(135deg, #1c1b19 0%, #6b5f4a 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        paddingBottom: "4px",
    },
    subheading: {
        fontSize: "17px",
        lineHeight: 1.6,
        color: "var(--color-prose)",
        maxWidth: "560px",
        margin: "0 0 48px 0",
    },

    // search
    searchForm: {
        width: "100%",
        maxWidth: "600px",
        position: "relative",
        transition: "transform 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)",
    },
    searchGlow: {
        position: "absolute",
        inset: "-2px",
        borderRadius: "18px",
        background: "linear-gradient(90deg, rgba(147,130,255,0.3), rgba(100,200,255,0.3))",
        filter: "blur(14px)",
        opacity: 0.5,
        zIndex: -1,
    },
    searchInner: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.8)",
        borderRadius: "16px",
        padding: "8px 10px 8px 18px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
    },
    searchInput: {
        flex: 1,
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: "15px",
        color: "var(--color-ink)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.01em",
        padding: "10px 0",
    },
    searchBtn: {
        background: "var(--color-ink)",
        border: "none",
        borderRadius: "10px",
        padding: "12px 26px",
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--color-base)",
        letterSpacing: "0.01em",
        flexShrink: 0,
        transition: "transform 0.12s, box-shadow 0.12s",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    },
    spinner: {
        display: "inline-block",
        width: "16px",
        height: "16px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
    },
    error: {
        fontSize: "13px",
        color: "var(--color-err)",
        marginTop: "16px",
        textAlign: "center",
        background: "rgba(184, 64, 64, 0.1)",
        padding: "8px 16px",
        borderRadius: "8px",
        border: "1px solid rgba(184, 64, 64, 0.2)",
    },

    // chips
    chipRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "24px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    chipLabel: {
        fontSize: "12px",
        color: "var(--color-faint)",
        fontWeight: 500,
    },
    chip: {
        background: "rgba(255, 255, 255, 0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "8px",
        padding: "6px 14px",
        fontSize: "12px",
        color: "var(--color-secondary)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
    },

    // features
    features: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "24px",
        maxWidth: "1000px",
        width: "100%",
        padding: "48px 24px 64px",
        position: "relative",
        zIndex: 2,
    },
    featureCard: {
        background: "rgba(255, 255, 255, 0.45)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        borderRadius: "16px",
        padding: "28px 24px",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.4)",
        transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
        cursor: "default",
    },
    featureIcon: {
        fontSize: "32px",
        marginBottom: "16px",
        display: "inline-block",
        padding: "12px",
        background: "rgba(255, 255, 255, 0.7)",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
    },
    featureTitle: {
        fontSize: "15px",
        fontWeight: 700,
        margin: "0 0 8px 0",
        color: "var(--color-ink)",
    },
    featureDesc: {
        fontSize: "13px",
        lineHeight: 1.5,
        color: "var(--color-prose)",
        margin: 0,
    },

    // footer
    footer: {
        padding: "32px",
        position: "relative",
        zIndex: 2,
        marginTop: "auto",
    },
    footerText: {
        fontSize: "12px",
        color: "var(--color-ghost)",
        fontWeight: 500,
        letterSpacing: "0.01em",
    },
}

