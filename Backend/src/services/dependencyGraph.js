import fs from "fs"
import path from "path"

// Regex patterns for import/require statements across languages
const IMPORT_PATTERNS = [
    // JS/TS: import ... from "..."  or  import "..."
    /(?:import\s+(?:[\w{}\s,*]+\s+from\s+)?['"])([^'"]+)['"]/g,
    // JS/TS: require("...")
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Python: from X import ... or import X
    /(?:from\s+([\w.]+)\s+import|^import\s+([\w.]+))/gm,
    // Go: "package/path"
    /^\s*"([^"]+)"\s*$/gm,
    // Rust: use crate::... or mod ...
    /(?:use\s+(?:crate::)?([\w:]+)|mod\s+(\w+))/g,
    // Java/Kotlin: import package.Class
    /^import\s+([\w.]+)/gm,
    // C/C++: #include "file.h"
    /#include\s*"([^"]+)"/g,
    // CSS: @import "..."
    /@import\s+['"]([^'"]+)['"]/g,
]

const CODE_EXTENSIONS = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".go", ".rs", ".java", ".kt", ".scala",
    ".c", ".cpp", ".h", ".hpp", ".cs",
    ".rb", ".php", ".swift",
    ".css", ".scss", ".less",
])

/**
 * Builds a dependency graph by parsing import statements from source files.
 * Returns { nodes: [...], edges: [...] } where edges are [source, target] pairs
 * using relative file paths.
 */
export function buildDependencyGraph(tempDir, tree) {
    const allFiles = []
    flattenTree(tree, allFiles)

    // Map of file path (relative) → set of raw import strings
    const rawImports = new Map()

    for (const file of allFiles) {
        const ext = path.extname(file.path).toLowerCase()
        if (!CODE_EXTENSIONS.has(ext)) continue

        const fullPath = path.join(tempDir, file.path)
        let content
        try {
            const stat = fs.statSync(fullPath)
            if (stat.size > 100 * 1024) continue // skip large files
            content = fs.readFileSync(fullPath, "utf-8")
        } catch {
            continue
        }

        const imports = extractImports(content, ext)
        if (imports.length > 0) {
            rawImports.set(file.path, imports)
        }
    }

    // Build a lookup set of all file paths for resolution
    const filePathSet = new Set(allFiles.map(f => f.path))
    const filePathMap = new Map() // basename without ext → full path
    for (const f of allFiles) {
        const base = f.path.replace(/\.[^/.]+$/, "")
        if (!filePathMap.has(base)) filePathMap.set(base, f.path)
        // Also index by just filename without ext
        const name = path.basename(f.path).replace(/\.[^/.]+$/, "")
        if (!filePathMap.has(name)) filePathMap.set(name, f.path)
    }

    // Resolve imports to actual file paths
    const edges = []
    const connectedFiles = new Set()

    for (const [sourcePath, imports] of rawImports) {
        const sourceDir = path.dirname(sourcePath)

        for (const imp of imports) {
            const resolved = resolveImport(imp, sourceDir, filePathSet, filePathMap)
            if (resolved && resolved !== sourcePath) {
                edges.push([sourcePath, resolved])
                connectedFiles.add(sourcePath)
                connectedFiles.add(resolved)
            }
        }
    }

    // Only include files that have at least one connection
    const nodes = allFiles
        .filter(f => connectedFiles.has(f.path))
        .map(f => ({
            path: f.path,
            name: f.name,
            ext: path.extname(f.name).toLowerCase(),
        }))

    // Deduplicate edges
    const edgeSet = new Set(edges.map(e => `${e[0]}|${e[1]}`))
    const uniqueEdges = [...edgeSet].map(e => e.split("|"))

    return { nodes, edges: uniqueEdges }
}

function flattenTree(node, result) {
    if (node.type === "file") {
        result.push(node)
    }
    if (node.children) {
        for (const child of node.children) {
            flattenTree(child, result)
        }
    }
}

function extractImports(content, ext) {
    const imports = new Set()

    // Use only relevant patterns based on extension
    let patterns
    if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
        patterns = [IMPORT_PATTERNS[0], IMPORT_PATTERNS[1]]
    } else if (ext === ".py") {
        patterns = [IMPORT_PATTERNS[2]]
    } else if (ext === ".go") {
        patterns = [IMPORT_PATTERNS[3]]
    } else if (ext === ".rs") {
        patterns = [IMPORT_PATTERNS[4]]
    } else if ([".java", ".kt", ".scala"].includes(ext)) {
        patterns = [IMPORT_PATTERNS[5]]
    } else if ([".c", ".cpp", ".h", ".hpp", ".cs"].includes(ext)) {
        patterns = [IMPORT_PATTERNS[6]]
    } else if ([".css", ".scss", ".less"].includes(ext)) {
        patterns = [IMPORT_PATTERNS[7]]
    } else {
        return []
    }

    for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags)
        let match
        while ((match = regex.exec(content)) !== null) {
            // Take first non-null capture group
            const imp = match[1] || match[2]
            if (imp && !isExternalImport(imp, ext)) {
                imports.add(imp)
            }
        }
    }

    return [...imports]
}

function isExternalImport(imp, ext) {
    if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
        // Relative imports start with . or /
        return !imp.startsWith(".") && !imp.startsWith("/")
    }
    if (ext === ".py") {
        // Python relative imports start with .
        return !imp.startsWith(".")
    }
    if ([".c", ".cpp", ".h", ".hpp"].includes(ext)) {
        // #include "local.h" is already local (we skip <system.h>)
        return false
    }
    if ([".css", ".scss", ".less"].includes(ext)) {
        return !imp.startsWith(".") && !imp.startsWith("/")
    }
    // For Go, Java, Rust — most imports are external, but we try to resolve anyway
    return false
}

function resolveImport(imp, sourceDir, filePathSet, filePathMap) {
    // Try direct relative resolution
    if (imp.startsWith(".") || imp.startsWith("/")) {
        const base = imp.startsWith("/") ? imp.slice(1) : path.join(sourceDir, imp)
        const normalized = path.normalize(base)

        // Try exact match
        if (filePathSet.has(normalized)) return normalized

        // Try with common extensions
        const exts = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".py", ".go", ".rs", ".java", ".css", ".scss"]
        for (const ext of exts) {
            if (filePathSet.has(normalized + ext)) return normalized + ext
        }

        // Try index files
        for (const idx of ["index.js", "index.ts", "index.jsx", "index.tsx"]) {
            const indexPath = path.join(normalized, idx)
            if (filePathSet.has(indexPath)) return indexPath
        }
    }

    // Try matching by name in filePathMap
    const cleaned = imp.replace(/\./g, "/")
    if (filePathMap.has(cleaned)) return filePathMap.get(cleaned)
    if (filePathMap.has(imp)) return filePathMap.get(imp)

    // Try basename
    const basename = imp.split("/").pop()
    if (filePathMap.has(basename)) return filePathMap.get(basename)

    return null
}
