import Groq from "groq-sdk"
import {
    REPO_SUMMARY_PROMPT,
    EXPLAIN_FILE_PROMPT,
    CHAT_PROMPT
} from "./prompts.js"
import dotenv from "dotenv"
dotenv.config()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── model chains ─────────────────────────────────────────────────────────────
// first model is preferred, fallbacks used on 429 rate limit

const MAIN_MODELS = [
    "openai/gpt-oss-120b",  
    "llama-3.3-70b-versatile",           
    "qwen/qwen3-32b",        
                       
]

const FAST_MODELS = [
  "openai/gpt-oss-20b", 
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
]

const RETRY_DELAY_MS = 2000  // wait 2s between retries


// ─── non-streaming ────────────────────────────────────────────────────────────

export async function getRepoSummary({ tree, readmeContent, entryFileContents, repoName }) {
    const context = buildSummaryContext({ tree, readmeContent, entryFileContents, repoName })

    const response = await callWithFallback({
        models: MAIN_MODELS,
        stream: false,
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
            { role: "system", content: REPO_SUMMARY_PROMPT },
            { role: "user", content: context }
        ]
    })

    return response.choices[0]?.message?.content || ""
}


// ─── streaming ────────────────────────────────────────────────────────────────

export async function explainFile({ fileContent, fileName, filePath }, res) {
    const safeContent = fileContent.length > 12000 
        ? fileContent.slice(0, 12000) + "\n\n...[content truncated for analysis]" 
        : fileContent

    const userMessage = `File path: ${filePath}\nFile name: ${fileName}\n\n\`\`\`\n${safeContent}\n\`\`\``

    setSSEHeaders(res)

    const stream = await callWithFallback({
        models: MAIN_MODELS,
        stream: true,
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
            { role: "system", content: EXPLAIN_FILE_PROMPT },
            { role: "user", content: userMessage }
        ]
    })

    await pipeStream(stream, res)
}


export async function chatWithRepo({ message, history, contextFiles, repoName }, res) {
    const contextBlock = buildChatContext(contextFiles, repoName)

    const messages = [
        { role: "system", content: CHAT_PROMPT + "\n\n" + contextBlock },
        ...history,
        { role: "user", content: message }
    ]

    setSSEHeaders(res)

    const stream = await callWithFallback({
        models: FAST_MODELS,
        stream: true,
        temperature: 0.4,
        max_tokens: 1024,
        messages
    })

    await pipeStream(stream, res)
}


// ─── fallback core ────────────────────────────────────────────────────────────
// tries each model in the chain
// on 429 → waits RETRY_DELAY_MS then tries next model
// on other errors → throws immediately

async function callWithFallback({ models, ...params }) {
    let lastError = null

    for (let i = 0; i < models.length; i++) {
        const model = models[i]

        try {
            console.log(`[llm] trying model: ${model}`)

            const result = await groq.chat.completions.create({
                model,
                ...params
            })

            console.log(`[llm] success with model: ${model}`)
            return result

        } catch (err) {
            const isRateLimit = err?.status === 429 || err?.message?.includes("rate limit")
            const isModelUnavailable = err?.status === 503 || err?.message?.includes("unavailable")

            if (isRateLimit || isModelUnavailable) {
                lastError = err
                console.warn(`[llm] model ${model} hit rate limit / unavailable. ${i + 1 < models.length ? "trying next..." : "all models exhausted."}`)

                if (i + 1 < models.length) {
                    await sleep(RETRY_DELAY_MS)
                    continue
                }
            } else {
                // not a rate limit — don't retry, just throw
                console.error(`[llm] non-recoverable error on model ${model}:`, err.message)
                throw err
            }
        }
    }

    // all models failed
    throw new Error(`All models rate limited or unavailable. Last error: ${lastError?.message}`)
}


// ─── SSE helpers ──────────────────────────────────────────────────────────────

function setSSEHeaders(res) {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()
}

async function pipeStream(stream, res) {
    try {
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ""
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`)
            }
        }
        res.write(`data: [DONE]\n\n`)
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    } finally {
        res.end()
    }
}


// ─── context builders ─────────────────────────────────────────────────────────

function buildSummaryContext({ tree, readmeContent, entryFileContents, repoName }) {
    let ctx = `Repository: ${repoName}\n\n`

    if (readmeContent) {
        ctx += `README:\n${readmeContent.slice(0, 3000)}\n\n`
    }

    ctx += `File tree (top level):\n${JSON.stringify(tree.children?.map(c => c.name), null, 2)}\n\n`

    if (Object.keys(entryFileContents).length > 0) {
        ctx += `Entry / config files:\n`
        for (const [filePath, { content }] of Object.entries(entryFileContents)) {
            ctx += `\n--- ${filePath} ---\n${content.slice(0, 2000)}\n`
        }
    }

    return ctx
}

function buildChatContext(contextFiles, repoName) {
    if (!contextFiles || Object.keys(contextFiles).length === 0) {
        return `Repository: ${repoName}`
    }

    let ctx = `Repository: ${repoName}\n\nRelevant files:\n`
    for (const [filePath, { content }] of Object.entries(contextFiles)) {
        ctx += `\n--- ${filePath} ---\n${content.slice(0, 3000)}\n`
    }
    return ctx
}


// ─── util ─────────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function explainFileText({ fileContent, fileName, filePath }) {
    const safeContent = fileContent.length > 12000 
        ? fileContent.slice(0, 12000) + "\n\n...[content truncated for analysis]" 
        : fileContent

    const userMessage = `File path: ${filePath}\nFile name: ${fileName}\n\n\`\`\`\n${safeContent}\n\`\`\``

    const response = await callWithFallback({
        models: MAIN_MODELS,
        stream: false,
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
            { role: "system", content: EXPLAIN_FILE_PROMPT },
            { role: "user", content: userMessage }
        ]
    })

    return response.choices[0]?.message?.content || ""
}