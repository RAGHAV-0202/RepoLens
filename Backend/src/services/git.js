import simpleGit from "simple-git"
import { v4 as uuidv4 } from "uuid"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"


const MAX_REPO_SIZE_MB = 100
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLONE_BASE_DIR = path.resolve(__dirname, "../../temp")

export async function cloneRepo(repoUrl) {

    // validate it's actually a github url
    const githubPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/
    if (!githubPattern.test(repoUrl)) {
        throw new Error("Invalid GitHub URL")
    }

    const sessionId = uuidv4()
    fs.mkdirSync(CLONE_BASE_DIR, { recursive: true })
    const tempDir = path.join(CLONE_BASE_DIR, `repolens-${sessionId}`)

    const git = simpleGit()

    try {
        await git.clone(repoUrl, tempDir, [
            "--depth", "1",        // shallow clone, no history
            "--single-branch",     
        ])
    } catch (err) {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
        throw new Error(`Clone failed: ${err.message}`)
    }

    // check size after clone
    const sizeMB = getDirSizeMB(tempDir)
    if (sizeMB > MAX_REPO_SIZE_MB) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        throw new Error(`Repo too large (${Math.round(sizeMB)}MB). Limit is ${MAX_REPO_SIZE_MB}MB.`)
    }

    const repoName = repoUrl
        .replace(/\.git$/, "")
        .split("github.com/")[1]

    return {
        sessionId,
        tempDir,
        repoName,
        sizeMB: Math.round(sizeMB)
    }
}

function getDirSizeMB(dirPath) {
    let totalBytes = 0

    function walk(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            if (entry.isDirectory()) {
                if (entry.name === ".git") continue  
                walk(fullPath)
            } else {
                try {
                    totalBytes += fs.statSync(fullPath).size
                } catch {
                    
                }
            }
        }
    }

    walk(dirPath)
    return totalBytes / (1024 * 1024)
}