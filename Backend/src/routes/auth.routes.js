import { Router } from "express"
import { register, login, logout, getMe, refreshAccessToken, githubLogin, githubCallback } from "../controllers/auth.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.post("/register", register)
router.post("/login", login)
router.post("/refresh", refreshAccessToken)
router.post("/logout", verifyJWT, logout)
router.get("/github", githubLogin)
router.get("/github/callback", githubCallback)
router.get("/me", verifyJWT, getMe)

export default router