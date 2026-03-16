import api from "../services/api"
import useAppStore from "../store/useAppStore"

let restorePromise = null

/**
 * Attempts to restore an expired in-memory session by re-cloning the repo.
 * Deduplicates concurrent calls so only one restore runs at a time.
 * Returns true if restore succeeded, false otherwise.
 */
export async function restoreSessionIfNeeded(sessionId) {
    if (restorePromise) return restorePromise

    useAppStore.getState().setIsRestoring(true)

    restorePromise = api.post("/analyze/restore", { sessionId })
        .then(res => res.data?.success ?? false)
        .catch(() => false)
        .finally(() => {
            useAppStore.getState().setIsRestoring(false)
            restorePromise = null
        })

    return restorePromise
}

/**
 * Returns true if an error looks like an expired session.
 */
export function isSessionExpiredError(err) {
    const msg = typeof err === "string" ? err : (err?.message || "")
    return msg.includes("Session not found") || msg.includes("session not found")
}
