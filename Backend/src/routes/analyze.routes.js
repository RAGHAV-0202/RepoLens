import { Router } from "express"
import { analyzeRepo, explainFileRoute, getFileRawRoute, getUserHistory, resumeSession, restoreSession, getPublicAnalysis } from "../controllers/analyze.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.get("/share/:sessionId", getPublicAnalysis)

router.use(verifyJWT)

router.post("/", analyzeRepo)
router.get("/file", explainFileRoute)
router.get("/raw", getFileRawRoute)
router.get("/resume", resumeSession)
router.post("/restore", restoreSession)
router.get("/history", getUserHistory)

export default router
