import { useState, useRef, useCallback } from "react"
import useAppStore from "../../store/useAppStore"
import useChat from "../../hooks/useChat"
import ChatMessage from "./ChatMessage"

const SUGGESTION_CHIPS = [
    "How does the main logic work?",
    "Where are config files loaded?",
    "What are the entry points?",
]

const MIN_HEIGHT = 120
const MAX_HEIGHT = 500

export default function ChatPanel() {
    const chatHistory = useAppStore((s) => s.chatHistory)
    const user = useAppStore((s) => s.user)
    const { send } = useChat()
    const [input, setInput] = useState("")
    const [panelHeight, setPanelHeight] = useState(190)
    const messagesEndRef = useRef(null)
    const isDragging = useRef(false)
    const startY = useRef(0)
    const startHeight = useRef(0)

    const lastMsg = chatHistory[chatHistory.length - 1]
    const isSending = lastMsg?.role === "assistant" && lastMsg?.content === ""

    // ── drag resize ──────────────────────────────────────────
    const onMouseDown = useCallback((e) => {
        e.preventDefault()
        isDragging.current = true
        startY.current = e.clientY
        startHeight.current = panelHeight
        document.body.style.cursor = "ns-resize"
        document.body.style.userSelect = "none"

        const onMouseMove = (e) => {
            if (!isDragging.current) return
            const delta = startY.current - e.clientY
            const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta))
            setPanelHeight(newHeight)
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
    }, [panelHeight])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!input.trim() || isSending) return
        send(input.trim())
        setInput("")
        // auto-scroll after sending
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)
    }

    const handleChip = (text) => {
        if (isSending) return
        send(text)
    }

    const isStreaming = lastMsg?.role === "assistant" && lastMsg?.content?.length > 0

    return (
        <div className="chat-panel" style={{ height: panelHeight }}>
            {/* resize handle */}
            <div
                onMouseDown={onMouseDown}
                style={{
                    height: "5px",
                    cursor: "ns-resize",
                    position: "relative",
                    flexShrink: 0,
                    zIndex: 10,
                }}
            >
                <div style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "32px",
                    height: "3px",
                    borderRadius: "2px",
                    background: "var(--color-border)",
                    transition: "background 0.15s",
                }} />
            </div>

            {/* header */}
            <div className="chat-head">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 11, height: 11 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                ask the codebase
            </div>

            {/* messages */}
            <div className="chat-msgs">
                {chatHistory.length === 0 && (
                    <div style={{ textAlign: "center", margin: "auto", fontSize: "10px", color: "var(--color-ghost)" }}>
                        ask a question about this repository
                    </div>
                )}
                {chatHistory.map((msg, i) => (
                    <ChatMessage key={i} message={msg} userEmail={user?.email} />
                ))}
                {isStreaming && <span className="cursor-blink" style={{ fontSize: "12px", color: "var(--color-ink)" }}>▋</span>}
                <div ref={messagesEndRef} />
            </div>

            {/* suggestion chips */}
            {chatHistory.length === 0 && (
                <div className="chips">
                    {SUGGESTION_CHIPS.map((chip) => (
                        <div className="chip" key={chip} onClick={() => handleChip(chip)}>
                            {chip}
                        </div>
                    ))}
                </div>
            )}

            {/* input */}
            <form className="chat-input-row" onSubmit={handleSubmit}>
                <input
                    className="cinput"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about this repo…"
                    disabled={isSending}
                />
                <button
                    className="csend"
                    type="submit"
                    disabled={isSending || !input.trim()}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f5f3ef" strokeWidth="2.5" style={{ width: 13, height: 13 }}>
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
            </form>
        </div>
    )
}
