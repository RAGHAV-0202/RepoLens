import { Router } from "express"
import { chat } from "../controllers/chat.controllers.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

router.use(verifyJWT)
router.post("/", chat)

export default router
