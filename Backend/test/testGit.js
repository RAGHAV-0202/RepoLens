import { cloneRepo } from "../src/services/git.js"

const result = await cloneRepo("https://github.com/expressjs/express")
console.log(result)
// should print { sessionId, tempDir, repoName, sizeMB }