import { buildTree } from "../src/services/treeBuilder.js"

const result = buildTree("/Users/raghavkapoor/Microsoft_Visual/Projects/RepoLens/Backend/src/temp/repolens-980ae3c7-18b1-4c8b-9820-61f502b6e917")

console.log("--- TREE (top level) ---")
console.log(JSON.stringify(result.tree.children.map(c => c.name), null, 2))

console.log("--- STATS ---")
console.log(result.stats)