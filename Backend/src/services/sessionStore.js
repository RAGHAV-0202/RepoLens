import fs from "fs"
import path from "path"

const sessions = new Map()

export function createSession(sessionId, data) {
    sessions.set(sessionId, {
        ...data,
        createdAt: Date.now()
    })
}

export function getSession(sessionId) {
    return sessions.get(sessionId) || null
}

export function deleteSession(sessionId) {
    const session = sessions.get(sessionId)
    if (session?.tempDir && fs.existsSync(session.tempDir)) {
        fs.rmSync(session.tempDir, { recursive: true, force: true })
    }
    sessions.delete(sessionId)
}

export function getAllSessions() {
    return sessions
}

const THIRTY_MIN = 30 * 60 * 1000

setInterval(() => {
    const cutoff = Date.now() - THIRTY_MIN
    for (const [id, session] of sessions) {
        if (session.createdAt < cutoff) {
            deleteSession(id)
            console.log(`[sessionStore] cleaned up session ${id}`)
        }
    }
}, THIRTY_MIN)