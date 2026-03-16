import { Router } from "express"
import { getTrendingRepos, getMyRepos } from "../controllers/github.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.get("/trending", getTrendingRepos)
router.get("/my-repos", verifyJWT, getMyRepos)

export default router
