import asyncHandler from "../utils/asyncHandler.js"
import apiError from "../utils/apiError.js"
import ApiResponse from "../utils/apiResponse.js"
import { cloneRepo } from "../services/git.js"
import { buildTree } from "../services/treeBuilder.js"
import { readFile, readFiles } from "../services/fileReader.js"
import { createSession } from "../services/sessionStore.js"
import { getRepoSummary } from "../services/llm.js"
import Analysis from "../models/analysis.model.js"

export const analyzeRepo = asyncHandler(async (req, res, next) => {
    const { repoUrl } = req.body
    const userId = req.user._id
    if (!repoUrl) throw new apiError(400, "repoUrl is required")

    const githubPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/
    if (!githubPattern.test(repoUrl)) {
        throw new apiError(400, "Invalid GitHub URL. Must be https://github.com/owner/repo")
    }
    const existing = await Analysis.findOne({
        userId,
        repoUrl,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })

    if (existing) {
        const { getSession, createSession } = await import("../services/sessionStore.js")
        if (!getSession(existing.sessionId)) {
            await Analysis.findByIdAndDelete(existing._id)
        }else{
            return res.status(200).json(new ApiResponse(200, {
                sessionId: existing.sessionId,
                tree: existing.treeJSON,
                summary: existing.summary,
                stats: existing.stats,
                architecture: existing.architecture,
                suggestions: existing.suggestions,
                repoName: existing.repoName,
                cached: true
            }, "Returning cached analysis")) 
        }
    }

    let cloneResult
    try {
        cloneResult = await cloneRepo(repoUrl)
    } catch (err) {
        throw new apiError(422, err.message)
    }

    const { sessionId, tempDir, repoName, sizeMB } = cloneResult

    const { tree, stats } = buildTree(tempDir)

    let readmeContent = ""
    try {
        const readme = readFile(tempDir, "README.md")
        readmeContent = readme.content
    } catch {
    }

    
    const filesToRead = [
        ...stats.entryPoints.slice(0, 3),
        ...stats.configFiles.slice(0, 2)
    ]
    const entryFileContents = filesToRead.length > 0
        ? readFiles(tempDir, filesToRead)
        : {}

    
    let llmRaw = ""
    let summary = ""
    let architecture = {}
    let suggestions = []

    try {
        llmRaw = await getRepoSummary({ tree, readmeContent, entryFileContents, repoName })

       
        const parsed = JSON.parse(llmRaw)
        summary = parsed.summary || ""
        architecture = parsed.architecture || {}
        suggestions = parsed.suggestions || []

    } catch (err) {
        console.error("[analyze] LLM error:", err.message)
        summary = "Analysis unavailable — LLM error."
    }

    const analysis = await Analysis.create({
        userId,
        repoUrl,
        repoName,
        sessionId,
        treeJSON: tree,
        summary,
        architecture,
        suggestions,
        stats: {
            totalFiles: stats.totalFiles,
            totalLines: stats.totalLines,
            primaryLanguage: stats.primaryLanguage,
            languages: stats.languages,
        },
        status: "ready"
    })

    createSession(sessionId, {
        tempDir,
        repoUrl,
        repoName,
        userId: userId.toString(),
        analysisId: analysis._id.toString()
    })

    return res.status(201).json(new ApiResponse(201, {
        sessionId,
        tree,
        summary,
        stats: analysis.stats,
        architecture,
        suggestions,
        repoName,
        sizeMB,
        cached: false
    }, "Repository analyzed successfully"))
})


export const explainFileRoute = asyncHandler(async (req, res, next) => {
    const { sessionId, filePath } = req.query

    if (!sessionId || !filePath) {
        throw new apiError(400, "sessionId and filePath are required")
    }

    // get session
    const { getSession } = await import("../services/sessionStore.js")
    const session = getSession(sessionId)
    if (!session) {
        throw new apiError(404, "Session not found or expired. Re-analyze the repository.")
    }

    // verify this session belongs to the requesting user
    if (session.userId !== req.user._id.toString()) {
        throw new apiError(403, "Forbidden")
    }

    // check cache first
    const analysis = await Analysis.findById(session.analysisId)
    if (analysis) {
        const cached = analysis.getCachedExplanation(filePath)
        if (cached) {
            // serve cached explanation as a single SSE event
            res.setHeader("Content-Type", "text/event-stream")
            res.setHeader("Cache-Control", "no-cache")
            res.setHeader("Connection", "keep-alive")
            res.flushHeaders()
            res.write(`data: ${JSON.stringify({ text: cached })}\n\n`)
            res.write(`data: [DONE]\n\n`)
            return res.end()
        }
    }

    // read file content
    let fileData
    try {
        fileData = readFile(session.tempDir, filePath)
    } catch (err) {
        throw new apiError(404, err.message)
    }

    const fileName = filePath.split("/").pop()

    const { explainFile } = await import("../services/llm.js")

    await explainFile({ fileContent: fileData.content, fileName, filePath }, res)

    if (analysis) {
        setImmediate(async () => {
            try {
                const { explainFileText } = await import("../services/llm.js")
                const text = await explainFileText({
                    fileContent: fileData.content,
                    fileName,
                    filePath
                })
                if (text) await analysis.cacheFileExplanation(filePath, text)
            } catch (err) {
                console.error("[analyze] cache write failed:", err.message)
            }
        })
    }
})


export const getFileRawRoute = asyncHandler(async (req, res, next) => {
    const { sessionId, filePath } = req.query

    if (!sessionId || !filePath) {
        throw new apiError(400, "sessionId and filePath are required")
    }

    const { getSession } = await import("../services/sessionStore.js")
    const session = getSession(sessionId)
    if (!session) {
        throw new apiError(404, "Session not found or expired. Re-analyze the repository.")
    }

    if (session.userId !== req.user._id.toString()) {
        throw new apiError(403, "Forbidden")
    }

    const { readFile } = await import("../services/fileReader.js")
    let fileData
    try {
        fileData = readFile(session.tempDir, filePath)
    } catch (err) {
        throw new apiError(404, err.message)
    }

    return res.status(200).json(new ApiResponse(200, {
        content: fileData.content,
        truncated: fileData.truncated,
        size: fileData.size
    }, "File read successfully"))
})



export const resumeSession = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.query

    if (!sessionId) {
        throw new apiError(400, "sessionId is required")
    }

    const analysis = await Analysis.findOne({ sessionId })

    if (!analysis) {
        throw new apiError(404, "Analysis not found or expired")
    }

    if (analysis.userId.toString() !== req.user._id.toString()) {
        throw new apiError(403, "Forbidden")
    }

    // Restore the in-memory session if it's expired (re-clone the repo)
    const { getSession, createSession: createSess } = await import("../services/sessionStore.js")
    let restored = false
    if (!getSession(sessionId)) {
        try {
            const { cloneRepo } = await import("../services/git.js")
            const cloneResult = await cloneRepo(analysis.repoUrl)
            createSess(sessionId, {
                tempDir: cloneResult.tempDir,
                repoUrl: analysis.repoUrl,
                repoName: analysis.repoName,
                userId: analysis.userId.toString(),
                analysisId: analysis._id.toString()
            })
            restored = true
        } catch (err) {
            console.error("[resume] failed to restore session:", err.message)
        }
    }

    return res.status(200).json(new ApiResponse(200, {
        sessionId: analysis.sessionId,
        tree: analysis.treeJSON,
        summary: analysis.summary,
        stats: analysis.stats,
        architecture: analysis.architecture,
        suggestions: analysis.suggestions,
        repoName: analysis.repoName,
        repoUrl: analysis.repoUrl,
        cached: true,
        restored,
        status: analysis.status
    }, "Session resumed"))
})


export const restoreSession = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.body

    if (!sessionId) {
        throw new apiError(400, "sessionId is required")
    }

    const analysis = await Analysis.findOne({ sessionId })
    if (!analysis) {
        throw new apiError(404, "Analysis not found or expired")
    }

    if (analysis.userId.toString() !== req.user._id.toString()) {
        throw new apiError(403, "Forbidden")
    }

    const { getSession, createSession: createSess } = await import("../services/sessionStore.js")

    // Already alive — nothing to do
    if (getSession(sessionId)) {
        return res.status(200).json(new ApiResponse(200, { restored: false }, "Session already active"))
    }

    // Re-clone and recreate in-memory session
    let cloneResult
    try {
        cloneResult = await cloneRepo(analysis.repoUrl)
    } catch (err) {
        throw new apiError(422, `Failed to restore repository: ${err.message}`)
    }

    createSess(sessionId, {
        tempDir: cloneResult.tempDir,
        repoUrl: analysis.repoUrl,
        repoName: analysis.repoName,
        userId: analysis.userId.toString(),
        analysisId: analysis._id.toString()
    })

    return res.status(200).json(new ApiResponse(200, { restored: true }, "Session restored"))
})

export const getUserHistory = asyncHandler(async (req, res, next) => {
    const analyses = await Analysis.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("repoName repoUrl summary stats.primaryLanguage status createdAt sessionId")

    return res.status(200).json(new ApiResponse(200, analyses, "OK"))
})