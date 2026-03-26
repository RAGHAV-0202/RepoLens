import fs from "fs"
import path from "path"

const SKIP_DIRS = new Set([
    "node_modules", ".git", "__pycache__", ".next", "dist",
    "build", ".cache", "coverage", "venv", ".venv", "env",
    ".idea", ".vscode", "vendor"
])

const SKIP_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".mp3", ".mp4", ".wav", ".pdf", ".zip", ".tar", ".gz",
    ".exe", ".bin", ".woff", ".woff2", ".ttf", ".eot"
])

const SKIP_FILES = new Set([
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    ".DS_Store", "Thumbs.db", ".env", ".env.local"
])

const ENTRY_FILES = new Set([
    "main.py", "app.py", "run.py", "manage.py",
    "index.js", "main.js", "server.js", "app.js",
    "main.ts", "index.ts", "main.go", "main.rs",
    "Main.java", "Program.cs"
])

const CONFIG_FILES = new Set([
    "package.json", "setup.py", "pyproject.toml", "Cargo.toml",
    "go.mod", "pom.xml", "build.gradle", "CMakeLists.txt",
    "Makefile", "Dockerfile", "docker-compose.yml"
])

export function buildTree(tempDir) {
    const stats = {
        totalFiles: 0,
        totalLines: 0,
        languages: {},      // { "Python": 42, "JavaScript": 8 }
        entryPoints: [],    // file paths detected as entry points
        configFiles: []     // file paths detected as configs
    }

    function walk(currentPath, relativePath = "") {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })

        const children = []

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue

                const subtree = walk(fullPath, relPath)
                if (subtree.children.length > 0) {
                    children.push(subtree)
                }

            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase()
                if (SKIP_EXTENSIONS.has(ext)) continue
                if (SKIP_FILES.has(entry.name)) continue

                let lineCount = 0
                try {
                    const content = fs.readFileSync(fullPath, "utf-8")
                    lineCount = content.split("\n").length
                    stats.totalLines += lineCount
                } catch {
                    // binary or unreadable — skip line count
                }

                // language detection by extension
                const lang = detectLanguage(ext)
                if (lang) {
                    stats.languages[lang] = (stats.languages[lang] || 0) + 1
                }

                // badge detection
                let badge = null
                if (ENTRY_FILES.has(entry.name)) {
                    badge = "entry"
                    stats.entryPoints.push(relPath)
                } else if (CONFIG_FILES.has(entry.name)) {
                    badge = "config"
                    stats.configFiles.push(relPath)
                }

                stats.totalFiles++

                children.push({
                    name: entry.name,
                    type: "file",
                    path: relPath,
                    ext: ext || "none",
                    lines: lineCount,
                    badge,
                    size: fs.statSync(fullPath).size
                })
            }
        }

        // sort: folders first, then files, both alphabetically
        children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name)
            return a.type === "directory" ? -1 : 1
        })

        return {
            name: path.basename(currentPath),
            type: "directory",
            path: relativePath || "/",
            children
        }
    }

    const tree = walk(tempDir)

    // convert language file counts to percentages with largest remainder method
    // ensures percentages sum to exactly 100%
    const totalLangFiles = Object.values(stats.languages).reduce((a, b) => a + b, 0)
    const langPercents = {}

    if (totalLangFiles > 0) {
        // calculate exact percentages and remainders
        const entries = Object.entries(stats.languages)
        const percentages = entries.map(([lang, count]) => ({
            lang,
            exact: (count / totalLangFiles) * 100,
            floor: Math.floor((count / totalLangFiles) * 100),
            remainder: ((count / totalLangFiles) * 100) % 1
        }))

        // start with floored values
        percentages.forEach(p => {
            langPercents[p.lang] = p.floor
        })

        // distribute remaining percentage points to languages with largest remainders
        const remaining = 100 - Object.values(langPercents).reduce((a, b) => a + b, 0)
        const sortedByRemainder = percentages.sort((a, b) => b.remainder - a.remainder)
        for (let i = 0; i < remaining; i++) {
            langPercents[sortedByRemainder[i].lang]++
        }
    }

    // primary language = highest percentage
    const primaryLanguage = Object.entries(langPercents)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown"

    return {
        tree,
        stats: {
            ...stats,
            languages: langPercents,
            primaryLanguage
        }
    }
}

function detectLanguage(ext) {
    const map = {
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".jsx": "JavaScript", ".tsx": "TypeScript", ".java": "Java",
        ".go": "Go", ".rs": "Rust", ".cpp": "C++", ".c": "C",
        ".cs": "C#", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
        ".kt": "Kotlin", ".scala": "Scala", ".r": "R",
        ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
        ".html": "HTML", ".css": "CSS", ".scss": "CSS",
        ".md": "Markdown", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
        ".toml": "TOML", ".xml": "XML", ".sql": "SQL"
    }
    return map[ext] || null
}