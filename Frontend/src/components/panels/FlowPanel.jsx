import { useEffect, useMemo, useState } from "react"
import useAppStore from "../../store/useAppStore"
import useFileExplain from "../../hooks/useFileExplain"
import { API_BASE_URL, getAuthHeaders } from "../../services/api"

function flattenFiles(node, acc = []) {
    if (!node) return acc
    if (node.type === "file") {
        acc.push(node)
        return acc
    }
    if (Array.isArray(node.children)) {
        node.children.forEach((c) => flattenFiles(c, acc))
    }
    return acc
}

function pickPaths(files, matcher, limit = 3) {
    return files
        .filter((f) => matcher((f.path || "").toLowerCase(), (f.name || "").toLowerCase()))
        .slice(0, limit)
        .map((f) => f.path)
}

function detectRepoProfiles(files) {
    const paths = files.map((f) => (f.path || "").toLowerCase())
    const names = files.map((f) => (f.name || "").toLowerCase())
    const hasPath = (re) => paths.some((p) => re.test(p))
    const hasName = (re) => names.some((n) => re.test(n))

    const scoreFromSignals = (id, title, signals) => {
        let score = 0
        const reasons = []
        for (const s of signals) {
            if (!s.when()) continue
            score += s.weight
            reasons.push(s.reason)
        }
        return {
            id,
            title,
            score: Math.min(100, score),
            reasons: reasons.slice(0, 3),
        }
    }

    const candidates = [
        scoreFromSignals("backend", "Backend/API", [
            { when: () => hasPath(/\/routes\//), weight: 28, reason: "Route layer present" },
            { when: () => hasPath(/\/controllers?\//), weight: 24, reason: "Controller layer present" },
            { when: () => hasPath(/\/services?\//), weight: 18, reason: "Service/business layer present" },
            { when: () => hasName(/manage\.py|app\.py|server\.js|main\.go/), weight: 18, reason: "Backend entry files present" },
        ]),
        scoreFromSignals("frontend", "Frontend/Web App", [
            { when: () => hasPath(/\/components\//), weight: 24, reason: "Components directory present" },
            { when: () => hasPath(/\/pages\//) || hasPath(/\/app\//), weight: 20, reason: "Page/route layer present" },
            { when: () => hasName(/vite\.config\.|next\.config\.|index\.html/), weight: 22, reason: "Frontend build/runtime config detected" },
            { when: () => hasPath(/\.(jsx|tsx|css|scss)$/), weight: 16, reason: "UI source files detected" },
        ]),
        scoreFromSignals("library", "Library/SDK", [
            { when: () => hasPath(/^src\/index\.|^lib\/index\./), weight: 24, reason: "Public entry module present" },
            { when: () => hasPath(/\/lib\//) || hasPath(/^lib\//), weight: 18, reason: "Library module structure present" },
            { when: () => hasPath(/\/examples?\//), weight: 16, reason: "Examples directory present" },
            { when: () => hasPath(/\/tests?\//) || hasPath(/spec/), weight: 16, reason: "Library tests/specs present" },
        ]),
        scoreFromSignals("cli", "CLI Tooling", [
            { when: () => hasPath(/\/bin\//) || hasName(/\.sh$|\.ps1$/), weight: 28, reason: "Executable/bin files detected" },
            { when: () => hasPath(/cli|command/), weight: 18, reason: "Command/CLI modules present" },
            { when: () => hasName(/main\.go|main\.rs|main\.py|index\.js/), weight: 14, reason: "CLI-style entry file detected" },
        ]),
        scoreFromSignals("ml", "ML/Data Science", [
            { when: () => hasName(/\.ipynb$/), weight: 28, reason: "Notebooks detected" },
            { when: () => hasPath(/\bdata\b|dataset|training|inference|model/), weight: 22, reason: "ML/data folders detected" },
            { when: () => hasName(/\.h5$|\.pt$|\.onnx$|requirements\.txt|pyproject\.toml/), weight: 14, reason: "ML artifacts/runtime manifests detected" },
        ]),
        scoreFromSignals("infra", "Infra/DevOps", [
            { when: () => hasName(/dockerfile|docker-compose\.ya?ml|compose\.ya?ml/), weight: 24, reason: "Container setup detected" },
            { when: () => hasPath(/\.github\/workflows\//), weight: 22, reason: "CI workflows present" },
            { when: () => hasPath(/terraform|helm|k8s|kubernetes|ansible/), weight: 20, reason: "Provisioning/deployment files detected" },
        ]),
        scoreFromSignals("mobile", "Mobile App", [
            { when: () => hasPath(/^android\//) || hasPath(/^ios\//), weight: 32, reason: "Native mobile folders present" },
            { when: () => hasName(/pubspec\.yaml|app\.gradle|xcodeproj/), weight: 20, reason: "Mobile build manifests detected" },
            { when: () => hasPath(/react-native|expo/), weight: 16, reason: "React Native/Expo signals detected" },
        ]),
        scoreFromSignals("docs", "Docs/Content", [
            { when: () => hasPath(/\/docs\//), weight: 28, reason: "Docs directory present" },
            { when: () => hasName(/readme\.md|mkdocs\.yml|docusaurus|vitepress/), weight: 24, reason: "Documentation framework/config detected" },
            { when: () => {
                const mdCount = names.filter((n) => n.endsWith(".md")).length
                return mdCount > 0 && mdCount / Math.max(1, names.length) > 0.45
            }, weight: 20, reason: "Markdown-heavy repository" },
        ]),
    ]

    const matched = candidates.filter((c) => c.score >= 35).sort((a, b) => b.score - a.score)
    if (matched.length > 0) return matched.slice(0, 3)

    return [{
        id: "generic",
        title: "General Codebase",
        score: 50,
        reasons: ["No dominant archetype detected"],
    }]
}

function inferFlows(files, profiles) {
    const hasProfile = (id) => profiles.some((p) => p.id === id)
    const sections = []

    if (hasProfile("backend")) {
        sections.push({
            title: "API request flow",
            rows: [
                { step: "entry", files: pickPaths(files, (p, n) => /(^|\/)(app|server|main)\.(js|ts|py|go|java|rs)$/.test(p) || n === "manage.py") },
                { step: "routes", files: pickPaths(files, (p) => p.includes("/routes/")) },
                { step: "handlers", files: pickPaths(files, (p) => p.includes("/controllers/") || p.includes("controller")) },
                { step: "services", files: pickPaths(files, (p) => p.includes("/services/") || p.includes("service")) },
                { step: "data", files: pickPaths(files, (p) => /\/models\/|schema|prisma|entity|migration/.test(p)) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("frontend")) {
        sections.push({
            title: "UI interaction flow",
            rows: [
                { step: "entry", files: pickPaths(files, (p) => /(^|\/)src\/(main\.(jsx|tsx|js|ts)|index\.(jsx|tsx|js|ts))$/.test(p) || /(^|\/)index\.html$/.test(p)) },
                { step: "routes/pages", files: pickPaths(files, (p) => p.includes("/pages/") || p.includes("router")) },
                { step: "components", files: pickPaths(files, (p) => p.includes("/components/")) },
                { step: "state", files: pickPaths(files, (p) => p.includes("/store/") || p.includes("/hooks/")) },
                { step: "api layer", files: pickPaths(files, (p) => p.includes("/services/") || /api\.(js|ts)$/.test(p)) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("library")) {
        sections.push({
            title: "Library usage flow",
            rows: [
                { step: "public api", files: pickPaths(files, (p) => /(^|\/)(src|lib)\/index\./.test(p)) },
                { step: "core modules", files: pickPaths(files, (p) => /\/core\//.test(p) || /\/lib\//.test(p), 4) },
                { step: "adapters", files: pickPaths(files, (p) => /adapter|client|provider/.test(p)) },
                { step: "tests/examples", files: pickPaths(files, (p) => /\/tests?\//.test(p) || /\/examples?\//.test(p), 4) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("cli")) {
        sections.push({
            title: "CLI execution flow",
            rows: [
                { step: "entry", files: pickPaths(files, (p) => /(^|\/)(bin\/|cli\/|main\.(go|rs|py|js|ts)$)/.test(p), 4) },
                { step: "commands", files: pickPaths(files, (p) => /command|cmd\//.test(p)) },
                { step: "core logic", files: pickPaths(files, (p) => /\/core\//.test(p) || /\/services?\//.test(p)) },
                { step: "output/io", files: pickPaths(files, (p) => /printer|logger|output|stdout|stdin|io/.test(p)) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("ml")) {
        sections.push({
            title: "ML pipeline flow",
            rows: [
                { step: "data input", files: pickPaths(files, (p) => /\bdata\b|dataset|loader|input/.test(p), 4) },
                { step: "preprocess", files: pickPaths(files, (p) => /preprocess|feature|transform/.test(p)) },
                { step: "train/infer", files: pickPaths(files, (p) => /train|trainer|inference|predict|model/.test(p), 4) },
                { step: "eval/artifacts", files: pickPaths(files, (p) => /eval|metrics|report|\.h5$|\.pt$|\.onnx$/.test(p), 4) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("infra")) {
        sections.push({
            title: "Delivery flow",
            rows: [
                { step: "manifests", files: pickPaths(files, (p, n) => /docker|compose|k8s|kubernetes|helm|terraform/.test(p) || /dockerfile/.test(n), 4) },
                { step: "orchestration", files: pickPaths(files, (p) => /workflow|pipeline|deploy|release/.test(p), 4) },
                { step: "env config", files: pickPaths(files, (p, n) => /\.env|config|values\./.test(p) || /makefile/.test(n), 4) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("mobile")) {
        sections.push({
            title: "Mobile app flow",
            rows: [
                { step: "app entry", files: pickPaths(files, (p, n) => /(^|\/)(android|ios)\//.test(p) || /app\.gradle|xcodeproj|mainactivity|appdelegate/.test(n), 4) },
                { step: "screens", files: pickPaths(files, (p) => /screen|view|activity|fragment/.test(p), 4) },
                { step: "state/api", files: pickPaths(files, (p) => /store|service|api|network|repository/.test(p), 4) },
            ].filter((r) => r.files.length > 0),
        })
    }

    if (hasProfile("docs")) {
        sections.push({
            title: "Documentation flow",
            rows: [
                { step: "entry docs", files: pickPaths(files, (p, n) => /readme\.md/.test(n) || /\/docs\//.test(p), 4) },
                { step: "guides", files: pickPaths(files, (p) => /guide|tutorial|getting-started/.test(p), 4) },
                { step: "examples", files: pickPaths(files, (p) => /example|sample/.test(p), 4) },
            ].filter((r) => r.files.length > 0),
        })
    }

    sections.push({
        title: "Repository spine",
        rows: [
            { step: "entry", files: pickPaths(files, (p, n) => /(^|\/)(main|index|app|server)\./.test(p) || n === "manage.py", 4) },
            { step: "config", files: pickPaths(files, (p, n) => /config|settings|\.env|docker|compose|workflow/.test(p) || /package\.json|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|build\.gradle/.test(n), 4) },
            { step: "core", files: pickPaths(files, (p) => /core|src\/|lib\/|services?|modules?/.test(p), 4) },
            { step: "tests/docs", files: pickPaths(files, (p, n) => /tests?|spec|__tests__|docs/.test(p) || /readme\.md/.test(n), 4) },
        ].filter((r) => r.files.length > 0),
    })

    return sections.filter((s) => s.rows.length > 0)
}

function calcQuality(files, stats, depScore, profiles) {
    const paths = files.map((f) => (f.path || "").toLowerCase())
    const names = files.map((f) => (f.name || "").toLowerCase())

    const hasReadme = names.some((n) => n === "readme.md")
    const hasDocsFolder = paths.some((p) => p.includes("/docs/") || p.includes("/documentation/"))
    const docs = Math.min(100, (hasReadme ? 68 : 38) + (hasDocsFolder ? 20 : 0) + (stats?.totalFiles > 24 ? 10 : 0))

    const testFiles = files.filter((f) => /test|spec|__tests__|cypress|playwright|pytest|unittest/i.test(f.path || "")).length
    const tests = Math.min(100, testFiles === 0 ? 30 : Math.round(36 + Math.min(56, testFiles * 6)))

    const topLevel = new Set(files.map((f) => (f.path || "").split("/")[0]).filter(Boolean))
    const hasSrcLike = topLevel.has("src") || topLevel.has("lib") || topLevel.has("app")
    const profileConfidence = profiles.length > 0 ? Math.round(profiles.reduce((a, b) => a + b.score, 0) / profiles.length) : 50
    const structure = Math.min(100, 35 + Math.min(26, topLevel.size * 4) + (hasSrcLike ? 12 : 0) + Math.round(profileConfidence * 0.18))

    const automationSignals = [
        /\.github\/workflows\//,
        /docker|compose/,
        /makefile/,
        /\.pre-commit-config\.yaml/,
        /eslint|prettier|ruff|black|flake8/,
    ]
    const automationFound = automationSignals.filter((re) => paths.some((p) => re.test(p)) || names.some((n) => re.test(n))).length
    const automation = Math.min(100, 34 + automationFound * 13)

    const hasEntry = files.some((f) => f.badge === "entry") || paths.some((p) => /(^|\/)(main|index|app|server)\./.test(p))
    const hasConfig = names.some((n) => /package\.json|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|build\.gradle|dockerfile/.test(n))
    const execution = Math.min(100, (hasEntry ? 56 : 36) + (hasConfig ? 20 : 8) + (hasReadme ? 10 : 0))

    const dependency = Number.isFinite(depScore) ? depScore : 72

    const rows = [
        {
            name: "structure",
            score: Math.round(structure),
            reason: `Top-level modules: ${topLevel.size}${hasSrcLike ? " · has src/lib/app" : " · no strong src/lib/app root"}${profiles.length ? ` · archetype confidence ${profileConfidence}%` : ""}`,
        },
        {
            name: "docs",
            score: Math.round(docs),
            reason: `${hasReadme ? "README present" : "README missing"}${hasDocsFolder ? " · docs folder present" : " · docs folder not detected"}`,
        },
        {
            name: "tests",
            score: Math.round(tests),
            reason: `${testFiles} test/spec signals detected in paths`,
        },
        {
            name: "automation",
            score: Math.round(automation),
            reason: `${automationFound} automation signals found (CI, Docker, lint/format, make/pre-commit)`,
        },
        {
            name: "execution clarity",
            score: Math.round(execution),
            reason: `${hasEntry ? "entry files detected" : "entry files unclear"}${hasConfig ? " · runtime manifests present" : " · runtime manifests weak"}`,
        },
        {
            name: "dependency hygiene",
            score: Math.round(dependency),
            reason: `Calculated from manifest risk scan (${Number.isFinite(depScore) ? "manifest-based" : "heuristic fallback"})`,
        },
    ]

    const overall = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
    return {
        overall,
        grade: overall >= 85 ? "A" : overall >= 72 ? "B" : overall >= 58 ? "C" : "D",
        rows,
        explanation: `Overall is the mean of ${rows.length} dimensions: structure, docs, tests, automation, execution clarity, and dependency hygiene.`,
    }
}

function parsePackageJson(raw, fileNames) {
    let obj
    try {
        obj = JSON.parse(raw)
    } catch {
        return {
            score: 55,
            risks: [{ level: "warn", text: "package.json could not be parsed" }],
            packages: [],
        }
    }

    const all = {
        ...(obj.dependencies || {}),
        ...(obj.devDependencies || {}),
        ...(obj.peerDependencies || {}),
    }

    const entries = Object.entries(all)
    const count = entries.length
    const lockPresent = fileNames.has("package-lock.json") || fileNames.has("yarn.lock") || fileNames.has("pnpm-lock.yaml")

    let score = 100
    const risks = []

    if (!lockPresent && count > 0) {
        score -= 24
        risks.push({ level: "high", text: "No lockfile found for Node dependencies" })
    }

    if (count > 80) {
        score -= 18
        risks.push({ level: "warn", text: `Large dependency surface (${count} packages)` })
    } else if (count > 40) {
        score -= 10
        risks.push({ level: "warn", text: `Moderate dependency surface (${count} packages)` })
    }

    const loose = entries.filter(([, v]) => /^(\^|~|>=|>|<)|\*|x|latest|\|\|/i.test(String(v).trim())).length
    if (loose > 0) {
        const pct = Math.round((loose / Math.max(1, count)) * 100)
        score -= pct > 60 ? 14 : 8
        risks.push({ level: "warn", text: `Loose version ranges used in ${loose} packages (${pct}%)` })
    }

    const preOne = entries.filter(([, v]) => /(^|[^\d])0\.\d+/.test(String(v))).length
    if (preOne > 0) {
        score -= 6
        risks.push({ level: "info", text: `${preOne} packages pinned to pre-1.0 versions` })
    }

    const packages = entries
        .slice(0, 10)
        .map(([name, version]) => ({ name, version: String(version) }))

    return { score: Math.max(25, Math.round(score)), risks, packages }
}

function parseRequirements(raw) {
    const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))

    const parsed = lines.map((line) => {
        const m = line.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~]{1,2})\s*([^\s;]+)/)
        if (!m) return { name: line, op: "", version: "" }
        return { name: m[1], op: m[2], version: m[3] }
    })

    const count = parsed.length
    let score = 100
    const risks = []

    const unpinned = parsed.filter((d) => d.op !== "==").length
    if (unpinned > 0) {
        const pct = Math.round((unpinned / Math.max(1, count)) * 100)
        score -= pct > 60 ? 16 : 9
        risks.push({ level: "warn", text: `Unpinned python deps: ${unpinned}/${count}` })
    }

    return {
        score: Math.max(30, Math.round(score)),
        risks,
        packages: parsed.slice(0, 10).map((d) => ({ name: d.name, version: d.op ? `${d.op}${d.version}` : "unparsed" })),
    }
}

function parseGoMod(raw) {
    const lines = raw.split("\n").map((l) => l.trim())
    const deps = []
    let inRequireBlock = false

    for (const line of lines) {
        if (line.startsWith("require (")) {
            inRequireBlock = true
            continue
        }
        if (inRequireBlock && line === ")") {
            inRequireBlock = false
            continue
        }

        let m = null
        if (inRequireBlock) {
            m = line.match(/^([^\s]+)\s+([^\s]+)(?:\s+\/\/\s*indirect)?$/)
        } else {
            m = line.match(/^require\s+([^\s]+)\s+([^\s]+)$/)
        }
        if (m) deps.push({ name: m[1], version: m[2] })
    }

    const count = deps.length
    let score = 100
    const risks = []
    if (count > 60) {
        score -= 16
        risks.push({ level: "warn", text: `Large module graph (${count} modules)` })
    }

    const unstable = deps.filter((d) => /v0\./.test(d.version)).length
    if (unstable > 0) {
        score -= 8
        risks.push({ level: "info", text: `${unstable} modules at v0.x` })
    }

    return {
        score: Math.max(35, Math.round(score)),
        risks,
        packages: deps.slice(0, 10),
    }
}

function parseCargoToml(raw) {
    const lines = raw.split("\n")
    const deps = []
    let section = ""
    for (const lineRaw of lines) {
        const line = lineRaw.trim()
        if (!line || line.startsWith("#")) continue
        const sec = line.match(/^\[([^\]]+)\]$/)
        if (sec) {
            section = sec[1]
            continue
        }
        if (!/dependencies/.test(section)) continue

        const m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
        if (!m) continue
        const name = m[1]
        const rhs = m[2]
        const versionMatch = rhs.match(/"([^"]+)"/) || rhs.match(/version\s*=\s*"([^"]+)"/)
        deps.push({ name, version: versionMatch ? versionMatch[1] : "*" })
    }

    let score = 100
    const risks = []
    const wildcard = deps.filter((d) => d.version.includes("*")).length
    if (wildcard > 0) {
        score -= 14
        risks.push({ level: "warn", text: `${wildcard} Cargo dependencies use wildcard versions` })
    }
    if (deps.length > 70) {
        score -= 12
        risks.push({ level: "warn", text: `Large dependency surface (${deps.length} crates)` })
    }

    return {
        score: Math.max(35, Math.round(score)),
        risks,
        packages: deps.slice(0, 10),
    }
}

function parsePomXml(raw) {
    const depCount = (raw.match(/<dependency>/g) || []).length
    const versions = [...raw.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1])
    let score = 100
    const risks = []

    const dynamic = versions.filter((v) => /(SNAPSHOT|LATEST|RELEASE|\+|\$\{)/i.test(v)).length
    if (dynamic > 0) {
        score -= 16
        risks.push({ level: "warn", text: `${dynamic} Maven dependencies use dynamic/SNAPSHOT versions` })
    }
    if (depCount > 90) {
        score -= 14
        risks.push({ level: "warn", text: `Large Maven dependency set (${depCount})` })
    }

    return {
        score: Math.max(30, Math.round(score)),
        risks,
        packages: versions.slice(0, 10).map((v, i) => ({ name: `dependency-${i + 1}`, version: v })),
    }
}

function parseGradle(raw) {
    const lines = raw.split("\n").map((l) => l.trim())
    const deps = lines
        .map((line) => line.match(/^(implementation|api|testImplementation|compileOnly|runtimeOnly)\s+['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/))
        .filter(Boolean)
        .map((m) => ({ name: `${m[2]}:${m[3]}`, version: m[4] }))

    let score = 100
    const risks = []
    const dynamic = deps.filter((d) => /\+|latest|SNAPSHOT/i.test(d.version)).length
    if (dynamic > 0) {
        score -= 15
        risks.push({ level: "warn", text: `${dynamic} Gradle dependencies use dynamic versions` })
    }

    return {
        score: Math.max(35, Math.round(score)),
        risks,
        packages: deps.slice(0, 10),
    }
}

function parseGemfile(raw) {
    const lines = raw.split("\n")
    const gems = lines
        .map((line) => line.trim().match(/^gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/))
        .filter(Boolean)
        .map((m) => ({ name: m[1], version: m[2] || "unpinned" }))

    let score = 100
    const risks = []
    const unpinned = gems.filter((g) => g.version === "unpinned").length
    if (unpinned > 0) {
        score -= 10
        risks.push({ level: "warn", text: `${unpinned} gems are unpinned` })
    }

    return {
        score: Math.max(35, Math.round(score)),
        risks,
        packages: gems.slice(0, 10),
    }
}

function parsePyprojectToml(raw) {
    const lines = raw.split("\n").map((l) => l.trim())
    const deps = []
    let section = ""

    for (const line of lines) {
        const sec = line.match(/^\[([^\]]+)\]$/)
        if (sec) {
            section = sec[1]
            continue
        }
        if (!line || line.startsWith("#")) continue

        if (section === "project" && line.startsWith("dependencies")) {
            const inline = line.match(/\[(.*)\]/)
            if (inline) {
                const entries = inline[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
                entries.filter(Boolean).forEach((d) => deps.push({ name: d.split(/[<>=!~]/)[0], version: d }))
            }
        }

        if (section.startsWith("tool.poetry.dependencies")) {
            const m = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*['"]([^'"]+)['"]/) || line.match(/^([A-Za-z0-9_.-]+)\s*=\s*\{[^}]*version\s*=\s*['"]([^'"]+)['"]/)
            if (m && m[1] !== "python") deps.push({ name: m[1], version: m[2] })
        }
    }

    let score = 100
    const risks = []
    const loose = deps.filter((d) => /\^|~|\*|>=|>|<|\|\|/i.test(d.version)).length
    if (loose > 0) {
        score -= 10
        risks.push({ level: "warn", text: `${loose} Python dependencies use loose ranges` })
    }

    return {
        score: Math.max(35, Math.round(score)),
        risks,
        packages: deps.slice(0, 10),
    }
}

export default function FlowPanel() {
    const tree = useAppStore((s) => s.tree)
    const stats = useAppStore((s) => s.stats)
    const sessionId = useAppStore((s) => s.sessionId)
    const selectFile = useAppStore((s) => s.selectFile)
    const setSidebarView = useAppStore((s) => s.setSidebarView)
    const { explain } = useFileExplain()

    const files = useMemo(() => flattenFiles(tree, []), [tree])
    const fileNames = useMemo(() => new Set(files.map((f) => (f.name || "").toLowerCase())), [files])
    const profiles = useMemo(() => detectRepoProfiles(files), [files])
    const flows = useMemo(() => inferFlows(files, profiles), [files, profiles])

    const [depScan, setDepScan] = useState({
        loading: false,
        score: 70,
        risks: [],
        packages: [],
        source: "heuristic",
    })
    const [activeView, setActiveView] = useState("all")
    const [expandedCards, setExpandedCards] = useState({
        archetypes: true,
        quality: false,
        deps: false,
        mapper: true,
    })
    const [expandedSections, setExpandedSections] = useState({})
    const [expandedRows, setExpandedRows] = useState({})

    const manifests = useMemo(() => {
        const manifestDefs = [
            { file: "package.json", parse: (raw) => parsePackageJson(raw, fileNames) },
            { file: "requirements.txt", parse: parseRequirements },
            { file: "pyproject.toml", parse: parsePyprojectToml },
            { file: "go.mod", parse: parseGoMod },
            { file: "Cargo.toml", parse: parseCargoToml },
            { file: "pom.xml", parse: parsePomXml },
            { file: "build.gradle", parse: parseGradle },
            { file: "Gemfile", parse: parseGemfile },
        ]

        const byName = new Map(files.map((f) => [(f.name || "").toLowerCase(), f]))
        return manifestDefs
            .map((d) => {
                const hit = byName.get(d.file.toLowerCase())
                if (!hit) return null
                return { path: hit.path, parse: d.parse, file: d.file }
            })
            .filter(Boolean)
            .slice(0, 3)
    }, [files, fileNames])

    useEffect(() => {
        if (!sessionId || files.length === 0 || manifests.length === 0) return

        let cancelled = false

        const fetchRaw = async (filePath) => {
            const res = await fetch(`${API_BASE_URL}/analyze/raw?sessionId=${encodeURIComponent(sessionId)}&filePath=${encodeURIComponent(filePath)}`, {
                headers: getAuthHeaders(),
                credentials: "include",
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()
            return json?.data?.content || ""
        }

        ;(async () => {
            try {
                const results = []
                for (const m of manifests) {
                    const raw = await fetchRaw(m.path)
                    const parsed = m.parse(raw)
                    results.push({ ...parsed, source: m.path, file: m.file })
                }

                const score = Math.round(results.reduce((sum, r) => sum + (r.score || 70), 0) / Math.max(1, results.length))
                const risks = results
                    .flatMap((r) => (r.risks || []).map((x) => ({ ...x, text: `${r.file}: ${x.text}` })))
                    .slice(0, 8)
                const packages = []
                const seen = new Set()
                for (const r of results) {
                    for (const p of r.packages || []) {
                        const key = `${p.name}@${p.version}`
                        if (seen.has(key)) continue
                        seen.add(key)
                        packages.push(p)
                        if (packages.length >= 12) break
                    }
                    if (packages.length >= 12) break
                }

                if (!cancelled) {
                    setDepScan({
                        loading: false,
                        score,
                        risks,
                        packages,
                        source: results.map((r) => r.source).join(", "),
                        perManifest: results.map((r) => ({ file: r.file, source: r.source, score: r.score })),
                    })
                }
            } catch {
                if (!cancelled) {
                    setDepScan({
                        loading: false,
                        score: 65,
                        risks: [{ level: "warn", text: "Dependency scan fallback used (raw fetch failed)" }],
                        packages: [],
                        source: "heuristic",
                    })
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [sessionId, files, manifests])

    const depScanView = manifests.length === 0
        ? {
            loading: false,
            score: 72,
            risks: [{ level: "info", text: "No recognized dependency manifest found" }],
            packages: [],
            source: "heuristic",
            perManifest: [],
        }
        : depScan

    const quality = useMemo(() => calcQuality(files, stats, depScanView.score, profiles), [files, stats, depScanView.score, profiles])

    const openPath = (path) => {
        const file = files.find((f) => f.path === path)
        if (!file) return
        setSidebarView("files")
        selectFile({ name: file.name, path: file.path, ext: file.ext, badge: file.badge, preferredTab: "code" })
        if (sessionId) explain(sessionId, file.path)
    }

    const RiskDot = ({ level }) => {
        const color = level === "high" ? "#e55" : level === "warn" ? "#f5a623" : "#4c8"
        return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
    }

    const toggleCard = (key) => {
        setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const toggleSection = (key) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const toggleRow = (key) => {
        setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const shouldShow = (key) => activeView === "all" || activeView === key
    const totalFlowRows = flows.reduce((sum, section) => sum + section.rows.length, 0)
    const highRisks = depScanView.risks.filter((r) => r.level === "high" || r.level === "warn").length

    return (
        <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ghost)", marginBottom: 10 }}>
                Flow Mode
            </div>

            <div className="flow-toolbar">
                <button className={`otab ${activeView === "all" ? "on" : ""}`} onClick={() => setActiveView("all")}>all</button>
                <button className={`otab ${activeView === "archetypes" ? "on" : ""}`} onClick={() => setActiveView("archetypes")}>archetypes</button>
                <button className={`otab ${activeView === "quality" ? "on" : ""}`} onClick={() => setActiveView("quality")}>quality</button>
                <button className={`otab ${activeView === "deps" ? "on" : ""}`} onClick={() => setActiveView("deps")}>dependencies</button>
                <button className={`otab ${activeView === "mapper" ? "on" : ""}`} onClick={() => setActiveView("mapper")}>mapper</button>
            </div>

            <div className="flow-quick-grid">
                <div className="flow-chip-card">
                    <div className="flow-chip-label">overall</div>
                    <div className="flow-chip-value">{quality.overall} <span>grade {quality.grade}</span></div>
                </div>
                <div className="flow-chip-card">
                    <div className="flow-chip-label">dependency hygiene</div>
                    <div className="flow-chip-value">{depScanView.score} <span>{highRisks} risk signals</span></div>
                </div>
                <div className="flow-chip-card">
                    <div className="flow-chip-label">archetypes</div>
                    <div className="flow-chip-value">{profiles.length} <span>top {profiles[0]?.title || "n/a"}</span></div>
                </div>
                <div className="flow-chip-card">
                    <div className="flow-chip-label">flow steps</div>
                    <div className="flow-chip-value">{totalFlowRows} <span>{flows.length} sections</span></div>
                </div>
            </div>

            {shouldShow("archetypes") && (
                <div className="ov-card flow-card" style={{ marginBottom: 12 }}>
                    <button className="flow-card-head" onClick={() => toggleCard("archetypes")}>
                        <span className="ov-card-title" style={{ marginBottom: 0 }}>Repository Archetypes</span>
                        <span className="flow-caret">{expandedCards.archetypes ? "-" : "+"}</span>
                    </button>
                    {expandedCards.archetypes && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {profiles.map((p) => (
                                <span key={p.id} className="pill pill-b" style={{ fontFamily: "var(--font-mono)" }} title={(p.reasons || []).join(" • ")}>
                                    {p.title} {p.score}%
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {shouldShow("quality") && (
                <div className="ov-card flow-card" style={{ marginBottom: 12 }}>
                    <button className="flow-card-head" onClick={() => toggleCard("quality")}>
                        <span className="ov-card-title" style={{ marginBottom: 0 }}>Quality Scorecard</span>
                        <span className="flow-caret">{expandedCards.quality ? "-" : "+"}</span>
                    </button>
                    {expandedCards.quality && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{quality.overall}</div>
                                <div style={{ fontSize: 12, color: "var(--color-secondary)" }}>grade {quality.grade}</div>
                            </div>
                            <div className="ov-prose" style={{ marginBottom: 8 }}>
                                {quality.explanation}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {quality.rows.map((row) => (
                                    <div key={row.name}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--color-ghost)", marginBottom: 3 }}>
                                            <span>{row.name}</span>
                                            <span>{row.score}</span>
                                        </div>
                                        <div style={{ height: 5, borderRadius: 999, background: "var(--color-active)" }}>
                                            <div style={{ height: 5, borderRadius: 999, width: `${row.score}%`, background: "var(--color-ink)" }} />
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--color-ghost)", marginTop: 4, lineHeight: 1.4 }}>
                                            {row.reason}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {shouldShow("deps") && (
                <div className="ov-card flow-card" style={{ marginBottom: 12 }}>
                    <button className="flow-card-head" onClick={() => toggleCard("deps")}>
                        <span className="ov-card-title" style={{ marginBottom: 0 }}>Dependency Risk & Outdated Scan</span>
                        <span className="flow-caret">{expandedCards.deps ? "-" : "+"}</span>
                    </button>
                    {expandedCards.deps && (depScanView.loading ? (
                        <div className="ov-prose">scanning dependency manifests...</div>
                    ) : (
                        <>
                            <div style={{ fontSize: 12, marginBottom: 8, color: "var(--color-secondary)" }}>
                                hygiene score: <b style={{ color: "var(--color-ink)" }}>{depScanView.score}</b>
                                {depScanView.source ? <span style={{ color: "var(--color-ghost)" }}> · source: {depScanView.source}</span> : null}
                            </div>
                            {Array.isArray(depScanView.perManifest) && depScanView.perManifest.length > 0 && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                    {depScanView.perManifest.map((m) => (
                                        <span key={m.source} className="pill pill-c" style={{ fontFamily: "var(--font-mono)" }}>
                                            {m.file}: {m.score}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                                {depScanView.risks.length === 0 ? (
                                    <div className="ov-prose">No major dependency risk signals detected.</div>
                                ) : depScanView.risks.slice(0, 4).map((r, i) => (
                                    <div key={i} style={{ display: "flex", gap: 8 }}>
                                        <RiskDot level={r.level} />
                                        <div className="ov-prose">{r.text}</div>
                                    </div>
                                ))}
                                {depScanView.risks.length > 4 && (
                                    <button className="otab" onClick={() => toggleRow("deps-risks")}>{expandedRows["deps-risks"] ? "less risks" : `+${depScanView.risks.length - 4} more risks`}</button>
                                )}
                                {expandedRows["deps-risks"] && depScanView.risks.slice(4).map((r, i) => (
                                    <div key={`extra-${i}`} style={{ display: "flex", gap: 8 }}>
                                        <RiskDot level={r.level} />
                                        <div className="ov-prose">{r.text}</div>
                                    </div>
                                ))}
                            </div>
                            {depScanView.packages.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, color: "var(--color-ghost)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        sample packages
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {depScanView.packages.slice(0, expandedRows["deps-packages"] ? 12 : 6).map((p) => (
                                            <span key={`${p.name}:${p.version}`} className="pill pill-c" style={{ fontFamily: "var(--font-mono)" }}>
                                                {p.name}@{p.version}
                                            </span>
                                        ))}
                                    </div>
                                    {depScanView.packages.length > 6 && (
                                        <button className="otab" style={{ marginTop: 8 }} onClick={() => toggleRow("deps-packages")}>
                                            {expandedRows["deps-packages"] ? "show fewer" : "show all packages"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ))}
                </div>
            )}

            {shouldShow("mapper") && (
                <div className="ov-card flow-card" style={{ marginBottom: 0 }}>
                    <button className="flow-card-head" onClick={() => toggleCard("mapper")}>
                        <span className="ov-card-title" style={{ marginBottom: 0 }}>Execution Flow Mapper</span>
                        <span className="flow-caret">{expandedCards.mapper ? "-" : "+"}</span>
                    </button>
                    {expandedCards.mapper && flows.map((section) => {
                        const sectionOpen = expandedSections[section.title] !== undefined
                            ? !!expandedSections[section.title]
                            : section.title === flows[0]?.title
                        return (
                            <div key={section.title} className="flow-section">
                                <button className="flow-section-head" onClick={() => toggleSection(section.title)}>
                                    <span>{section.title}</span>
                                    <span>{sectionOpen ? "-" : "+"}</span>
                                </button>
                                {sectionOpen && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {section.rows.map((row) => {
                                            const rowKey = `${section.title}-${row.step}`
                                            const expanded = !!expandedRows[rowKey]
                                            const visibleFiles = expanded ? row.files : row.files.slice(0, 2)
                                            return (
                                                <div key={rowKey} className="kv" style={{ padding: "6px 0" }}>
                                                    <div className="kv-k" style={{ width: 110 }}>{row.step}</div>
                                                    <div className="kv-v" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                            {visibleFiles.map((path) => (
                                                                <button
                                                                    key={path}
                                                                    onClick={() => openPath(path)}
                                                                    className="chat-citation"
                                                                    style={{ fontSize: 10.5 }}
                                                                    title="Open file"
                                                                >
                                                                    {path}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {row.files.length > 2 && (
                                                            <button className="otab flow-inline-toggle" onClick={() => toggleRow(rowKey)}>
                                                                {expanded ? "show fewer" : `+${row.files.length - 2} more`}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
