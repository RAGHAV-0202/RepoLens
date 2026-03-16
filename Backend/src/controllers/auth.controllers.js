import asyncHandler from "../utils/asyncHandler.js"
import apiError from "../utils/apiError.js"
import ApiResponse from "../utils/apiResponse.js"
import User from "../models/user.model.js"
import jwt from "jsonwebtoken"
import axios from "axios"

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}

export const register = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body

    if (!email || !password)
        throw new apiError(400, "Email and password are required")

    if (password.length < 8)
        throw new apiError(400, "Password must be at least 8 characters")

    const existing = await User.findOne({ email })
    if (existing)
        throw new apiError(409, "Email already registered")

    const user = await User.create({ email, password })

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    return res
        .status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(201, { email: user.email, id: user._id, githubId: user.githubId }, "Registered successfully"))
})

export const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body

    if (!email || !password)
        throw new apiError(400, "Email and password are required")

    const user = await User.findOne({ email })
    if (!user)
        throw new apiError(401, "Invalid credentials")

    const isValid = await user.isPasswordCorrect(password)
    if (!isValid)
        throw new apiError(401, "Invalid credentials")

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(200, { email: user.email, id: user._id, githubId: user.githubId }, "Logged in successfully"))
})

export const refreshAccessToken = asyncHandler(async (req, res, next) => {
    const incomingRefreshToken = req.cookies.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "Unauthorized access")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }

        const accessToken = user.generateAccessToken()

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .json(new ApiResponse(200, { accessToken }, "Access token refreshed"))
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
})

export const logout = asyncHandler(async (req, res, next) => {
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "Logged out"))
})

export const githubLogin = asyncHandler(async (req, res, next) => {
    const clientId = process.env.GITHUB_CLIENT_ID
    const redirectUri = "http://localhost:4000/api/auth/github/callback"
    
    // Request 'repo' scope to fetch user's repositories later
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email,repo`
    
    res.redirect(githubAuthUrl)
})

export const githubCallback = asyncHandler(async (req, res, next) => {
    const { code } = req.query
    if (!code) throw new apiError(400, "Authorization code is required")

    // 1. Exchange the code for an access token
    const tokenResponse = await axios.post("https://github.com/login/oauth/access_token", {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
    }, {
        headers: { Accept: "application/json" }
    })

    const accessToken = tokenResponse.data.access_token
    if (!accessToken) throw new apiError(400, "Failed to fetch GitHub access token")

    // 2. Fetch the user's GitHub profile
    const userResponse = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    const githubUser = userResponse.data

    // 3. Fetch user's emails (since the primary email might be private)
    const emailsResponse = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    const primaryEmail = emailsResponse.data.find(e => e.primary)?.email || emailsResponse.data[0]?.email
    if (!primaryEmail) throw new apiError(400, "No email found for GitHub user")

    // 4. Find or create the user in our database
    let user = await User.findOne({ githubId: githubUser.id.toString() })
    
    if (!user) {
        user = await User.findOne({ email: primaryEmail })
        if (user) {
            // Link existing account to GitHub
            user.githubId = githubUser.id.toString()
            user.githubAccessToken = accessToken
            await user.save()
        } else {
            // Create a brand new account
            user = await User.create({
                email: primaryEmail,
                githubId: githubUser.id.toString(),
                githubAccessToken: accessToken
            })
        }
    } else {
        // Update the access token for future API calls
        user.githubAccessToken = accessToken
        await user.save()
    }

    // 5. Generate RepoLens JWTs
    const jwtAccessToken = user.generateAccessToken()
    const jwtRefreshToken = user.generateRefreshToken()

    // 6. Set cookies and redirect to the frontend dashboard
    res.cookie("accessToken", jwtAccessToken, cookieOptions)
    res.cookie("refreshToken", jwtRefreshToken, cookieOptions)
    
    // Redirect back to the frontend
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173/dashboard")
})

export const getMe = asyncHandler(async (req, res, next) => {
    return res
        .status(200)
        .json(new ApiResponse(200, { email: req.user.email, id: req.user._id, githubId: req.user.githubId }, "User info"))
})