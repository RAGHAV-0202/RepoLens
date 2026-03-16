import { getRepoSummary } from "../src/services/llm.js"

const result = await getRepoSummary({
    repoName: "expressjs/express",
    readmeContent: "Express is a minimal Node.js web framework.",
    tree: { children: [{ name: "index.js" }, { name: "lib" }] },
    entryFileContents: {}
})

console.log(result)