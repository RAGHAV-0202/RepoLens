import asyncHandler from "../utils/asyncHandler.js"
import apiError from "../utils/apiError.js"
import ApiResponse from "../utils/apiResponse.js"
import { getSession } from "../services/sessionStore.js"
import { readFiles } from "../services/fileReader.js"
import { chatWithRepo } from "../services/llm.js"
import Analysis from "../models/analysis.model.js"

export const chat = asyncHandler(async (req, res, next) => {
    const { sessionId, message, history = [] } = req.body

    if (!sessionId) throw new apiError(400, "sessionId is required")
    if (!message?.trim()) throw new apiError(400, "message is required")
    if (message.length > 2000) throw new apiError(400, "Message too long (max 2000 chars)")

    const session = getSession(sessionId)
    if (!session) {
        throw new apiError(404, "Session not found or expired. Re-analyze the repository.")
    }

    if (session.userId !== req.user._id.toString()) {
        throw new apiError(403, "Forbidden")
    }

    const analysis = await Analysis.findById(session.analysisId)
    if (!analysis) throw new apiError(404, "Analysis not found")

    const relevantPaths = findRelevantFiles(message, analysis.treeJSON)

    const contextFiles = relevantPaths.length > 0
        ? readFiles(session.tempDir, relevantPaths)
        : {}

    const recentHistory = history
        .filter(m => m.role === "user" || m.role === "assistant")
        .filter(m => typeof m.content === "string" && m.content.trim().length > 0)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }))

    await chatWithRepo({
        message,
        history: recentHistory,
        contextFiles,
        repoName: session.repoName
    }, res)
})


// ── keyword matcher ───────────────────────────────────────────────────────────
// scores every file in the tree against the message
// returns top 4 most relevant file paths

function findRelevantFiles(message, tree) {
    const messageLower = message.toLowerCase()

    const isApiQuestion = /\b(api|endpoint|endpoints|route|routes|router|auth|analyze|chat|github)\b/.test(messageLower)

    // extract keywords — strip common words
    const stopWords = new Set(["what", "where", "how", "does", "is", "the",
        "a", "an", "in", "of", "to", "and", "or", "for", "this", "that",
        "it", "do", "can", "i", "me", "my", "show", "tell", "find", "get"])

    const keywords = messageLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))

    if (keywords.length === 0 && !isApiQuestion) return []

    // flatten tree into file list
    const allFiles = []
    function flatten(node) {
        if (node.type === "file") {
            allFiles.push(node)
        } else if (node.children) {
            node.children.forEach(flatten)
        }
    }
    flatten(tree)

    // score each file
    const scored = allFiles.map(file => {
        let score = 0
        const nameLower = file.name.toLowerCase()
        const pathLower = file.path.toLowerCase()

        for (const keyword of keywords) {
            // exact filename match — highest score
            if (nameLower === keyword + file.ext) score += 10
            // filename contains keyword
            if (nameLower.includes(keyword)) score += 5
            // path contains keyword
            if (pathLower.includes(keyword)) score += 2
        }

        // boost entry point and config files
        if (file.badge === "entry") score += 3
        if (file.badge === "config") score += 1

        // API/endpoint questions should prioritize route + app bootstrap files.
        if (isApiQuestion) {
            if (pathLower.includes("/routes/")) score += 20
            if (pathLower.endsWith("app.js") || pathLower.endsWith("server.js")) score += 12
            if (/auth\.routes\.|analyze\.routes\.|chat\.routes\.|github\.routes\./.test(nameLower)) score += 20
            if (nameLower.includes("route")) score += 6
        }

        return { path: file.path, score }
    })

    // return top 8 with score > 0 (more context for route-map style questions)
    return scored
        .filter(f => f.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(f => f.path)
}