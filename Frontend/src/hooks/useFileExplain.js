import { useCallback, useRef } from "react"
import useAppStore from "../store/useAppStore"
import { restoreSessionIfNeeded, isSessionExpiredError } from "../services/restoreSession"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api"

export default function useFileExplain() {
    const abortRef = useRef(null)

    const explain = useCallback(async (sessionId, filePath, _isRetry = false) => {
        // abort previous request
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        useAppStore.setState({ isExplainingFile: true, fileExplanation: "", isFetchingRaw: true, rawFileContent: null })

        // kick off raw file fetch concurrently
        fetch(`${API_URL}/analyze/raw?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`, {
            credentials: "include",
            signal: controller.signal
        })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text()
                    let msg = `HTTP ${res.status}`
                    try { msg = JSON.parse(text).message || msg } catch {}
                    throw new Error(msg)
                }
                return res.json()
            })
            .then(data => {
                if (data.success && data.data) {
                    useAppStore.setState({ rawFileContent: data.data.content, isFetchingRaw: false })
                } else {
                    useAppStore.setState({ rawFileContent: `[error loading raw file: ${data.message || 'unknown'}]`, isFetchingRaw: false })
                }
            })
            .catch(err => {
                if (err.name !== "AbortError") {
                    useAppStore.setState({ rawFileContent: `[error loading raw file: ${err.message}]`, isFetchingRaw: false })
                }
            })

        try {
            const response = await fetch(
                `${API_URL}/analyze/file?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`,
                { credentials: "include", signal: controller.signal }
            )

            if (!response.ok) {
                const text = await response.text()
                let msg = `HTTP ${response.status}`
                try { msg = JSON.parse(text).message || msg } catch {}

                // Auto-restore expired session (one retry)
                if (!_isRetry && isSessionExpiredError(msg)) {
                    const restored = await restoreSessionIfNeeded(sessionId)
                    if (restored) return explain(sessionId, filePath, true)
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
                buffer = lines.pop() // keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue
                    const data = line.slice(6)
                    if (data === "[DONE]") {
                        useAppStore.setState({ isExplainingFile: false })
                        return
                    }
                    try {
                        const { text } = JSON.parse(data)
                        if (text) useAppStore.getState().appendFileExplanation(text)
                    } catch {
                        // skip malformed chunks
                    }
                }
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                useAppStore.getState().appendFileExplanation(
                    `\n\n[error: ${err.message}]`
                )
            }
        } finally {
            useAppStore.setState({ isExplainingFile: false })
        }
    }, [])

    return { explain }
}
