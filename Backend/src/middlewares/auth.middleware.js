import jwt from "jsonwebtoken"
import apiError from "../utils/apiError.js"
import User from "../models/user.model.js"
import asyncHandler from "../utils/asyncHandler.js"

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken

    if (!token)
        throw new apiError(401, "Unauthorized")

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decoded._id).select("-password")
    if (!user)
        throw new apiError(401, "Unauthorized")

    req.user = user
    next()
})