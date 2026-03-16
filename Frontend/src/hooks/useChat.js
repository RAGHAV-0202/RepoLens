import { useCallback, useRef } from "react"
import useAppStore from "../store/useAppStore"
import { restoreSessionIfNeeded, isSessionExpiredError } from "../services/restoreSession"
import { API_BASE_URL, getAuthHeaders } from "../services/api"

export default function useChat() {
    const isSendingRef = useRef(false)

    const send = useCallback(async (message, _isRetry = false) => {
        if (isSendingRef.current && !_isRetry) return
        isSendingRef.current = true

        const { sessionId, chatHistory, addChatMessage, updateLastMessage } = useAppStore.getState()

        if (!_isRetry) {
            // add user message
            addChatMessage({ role: "user", content: message })
            // add empty assistant message (will be streamed into)
            addChatMessage({ role: "assistant", content: "" })
        }

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                credentials: "include",
                body: JSON.stringify({
                    sessionId,
                    message,
                    history: chatHistory,
                }),
            })

            if (!response.ok) {
                const text = await response.text()
                let msg = text || `HTTP ${response.status}`
                try { msg = JSON.parse(text).message || msg } catch {}

                // Auto-restore expired session (one retry)
                if (!_isRetry && isSessionExpiredError(msg)) {
                    const restored = await restoreSessionIfNeeded(sessionId)
                    if (restored) {
                        isSendingRef.current = false
                        return send(message, true)
                    }
                }

                throw new Error(msg)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split("\n")
                buffer = lines.pop()

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const data = line.slice(6)
                    if (data === "[DONE]") return
                    try {
                        const { text } = JSON.parse(data)
                        if (text) updateLastMessage(text)
                    } catch {
                        // skip malformed
                    }
                }
            }
        } catch (err) {
            updateLastMessage(`\n\n[error: ${err.message}]`)
        } finally {
            isSendingRef.current = false
        }
    }, [])

    return { send }
}
