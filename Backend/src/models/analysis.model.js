import mongoose from "mongoose"

const FileExplanationSchema = new mongoose.Schema({
  path: { type: String, required: true },
  explanation: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now }
}, { _id: false })

const AnalysisSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  repoUrl: {
    type: String,
    required: [true, "Repo URL is required"],
    trim: true
  },

  repoName: {
    type: String,
    required: true,
    trim: true
    // e.g. "openai/whisper"
  },

  sessionId: {
    type: String,
    required: true,
    unique: true
  },

  // the full file tree JSON — sent directly to frontend left panel
  treeJSON: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // LLM-generated repo overview — right panel summary
  summary: {
    type: String,
    default: ""
  },

  // repo stats for the stat cards
  stats: {
    totalFiles: { type: Number, default: 0 },
    totalLines: { type: Number, default: 0 },
    primaryLanguage: { type: String, default: "" },
    languages: { type: Map, of: Number, default: {} },
    // e.g. { "Python": 94, "Shell": 6 }
    contributors: { type: Number, default: 0 },
    lastCommit: { type: String, default: "" }
  },

  // architecture key-value pairs for right panel
  architecture: {
    pattern: { type: String, default: "" },
    entryPoint: { type: String, default: "" },
    configFile: { type: String, default: "" },
  },

  // cache file-level explanations so same file isn't re-analyzed
  fileExplanations: {
    type: [FileExplanationSchema],
    default: []
  },

  // issues/suggestions from LLM
  suggestions: [{
    type: { type: String, enum: ["error", "warning", "good"], required: true },
    text: { type: String, required: true }
  }],

  status: {
    type: String,
    enum: ["cloning", "indexing", "analyzing", "ready", "failed"],
    default: "cloning"
  },

  errorMessage: {
    type: String,
    default: ""
  },

  tempDirCleaned: {
    type: Boolean,
    default: false
  },

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }

}, { timestamps: true })

// index for fast lookup by user
AnalysisSchema.index({ userId: 1, createdAt: -1 })
AnalysisSchema.index({ sessionId: 1 })
// auto-delete documents after expiresAt (MongoDB TTL index)
AnalysisSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// helper — add or update a file explanation in the cache
AnalysisSchema.methods.cacheFileExplanation = async function(filePath, explanation) {
  const existing = this.fileExplanations.find(f => f.path === filePath)
  if (existing) {
    existing.explanation = explanation
    existing.generatedAt = new Date()
  } else {
    this.fileExplanations.push({ path: filePath, explanation })
  }
  await this.save()
}

// helper — get cached explanation for a file, null if not cached
AnalysisSchema.methods.getCachedExplanation = function(filePath) {
  const found = this.fileExplanations.find(f => f.path === filePath)
  return found ? found.explanation : null
}

const Analysis = mongoose.model("Analysis", AnalysisSchema)
export default Analysis