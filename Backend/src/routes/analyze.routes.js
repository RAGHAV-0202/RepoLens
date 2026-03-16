import { Router } from "express"
import { analyzeRepo, explainFileRoute, getFileRawRoute, getUserHistory, resumeSession, restoreSession } from "../controllers/analyze.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.use(verifyJWT)

router.post("/", analyzeRepo)
router.get("/file", explainFileRoute)
router.get("/raw", getFileRawRoute)
router.get("/resume", resumeSession)
router.post("/restore", restoreSession)
router.get("/history", getUserHistory)

export default router
