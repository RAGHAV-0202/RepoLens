import fs from "fs"
import path from "path"

const MAX_FILE_SIZE_BYTES = 50 * 1024  // 50kb

export function readFile(tempDir, filePath) {
    // sanitize — prevent path traversal attacks
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "")
    const fullPath = path.join(tempDir, safePath)

    // make sure resolved path is still inside tempDir
    if (!fullPath.startsWith(path.resolve(tempDir))) {
        throw new Error("Access denied — path traversal detected")
    }

    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${safePath}`)
    }

    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
        throw new Error(`Cannot read directory: ${safePath}`)
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
        // read first 50kb only, add a note at the end
        const fd = fs.openSync(fullPath, "r")
        const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES)
        fs.readSync(fd, buffer, 0, MAX_FILE_SIZE_BYTES, 0)
        fs.closeSync(fd)
        return {
            content: buffer.toString("utf-8") + "\n\n[...truncated — file exceeds 50kb]",
            truncated: true,
            size: stat.size
        }
    }

    const content = fs.readFileSync(fullPath, "utf-8")
    return {
        content,
        truncated: false,
        size: stat.size
    }
}


export function readFiles(tempDir, filePaths) {
    const results = {}
    for (const filePath of filePaths) {
        try {
            results[filePath] = readFile(tempDir, filePath)
        } catch {
            results[filePath] = { content: "", truncated: false, size: 0, error: true }
        }
    }
    return results
}