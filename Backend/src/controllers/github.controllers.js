import asyncHandler from "../utils/asyncHandler.js"
import apiError from "../utils/apiError.js"
import ApiResponse from "../utils/apiResponse.js"
import axios from "axios"

const DEFAULT_TRENDING_CACHE_TTL_MS = 5 * 60 * 1000
const rawCacheTtl = Number.parseInt(process.env.GITHUB_TRENDING_CACHE_TTL_MS || "", 10)
const TRENDING_CACHE_TTL_MS = Number.isFinite(rawCacheTtl) && rawCacheTtl > 0
    ? rawCacheTtl
    : DEFAULT_TRENDING_CACHE_TTL_MS

const trendingReposCache = new Map()
const inFlightTrendingRequests = new Map()

function getTrendingCacheKey(type, perPage) {
    return `${type}:${perPage}`
}

function getCachedTrendingRepos(cacheKey) {
    const entry = trendingReposCache.get(cacheKey)
    if (!entry) return null

    if (entry.expiresAt <= Date.now()) {
        trendingReposCache.delete(cacheKey)
        return null
    }

    return entry.repos
}

function setCachedTrendingRepos(cacheKey, repos) {
    trendingReposCache.set(cacheKey, {
        repos,
        expiresAt: Date.now() + TRENDING_CACHE_TTL_MS,
    })
}

function mapGithubRepos(items = []) {
    return items.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        ownerAvatar: repo.owner.avatar_url,
    }))
}

export const getTrendingRepos = asyncHandler(async (req, res, next) => {
    const { type = 'top' } = req.query
    const parsedLimit = Number.parseInt(req.query.limit, 10)
    const fallbackLimit = Number.parseInt(process.env.GITHUB_TRENDING_PER_PAGE || "30", 10)
    const perPage = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : (Number.isFinite(fallbackLimit) ? fallbackLimit : 30)))
    const cacheKey = getTrendingCacheKey(type, perPage)

    const cachedRepos = getCachedTrendingRepos(cacheKey)
    if (cachedRepos) {
        res.setHeader("X-RepoLens-Cache", "HIT")
        return res.status(200).json(new ApiResponse(200, cachedRepos, `Fetched ${type} repos`))
    }
    
    let searchQuery = ""
    if (type === 'trending') {
        const date = new Date()
        date.setDate(date.getDate() - 30)
        const dateString = date.toISOString().split('T')[0]
        searchQuery = `created:>${dateString} stars:>100`
    } else {
        // default to top repos
        searchQuery = "stars:>10000"
    }

    // Add some common popular languages to filter out spam repos
    searchQuery += "+language:javascript+language:python+language:typescript+language:go+language:rust+language:java"

    const existingRequest = inFlightTrendingRequests.get(cacheKey)
    if (existingRequest) {
        const sharedRepos = await existingRequest
        res.setHeader("X-RepoLens-Cache", "HIT")
        return res.status(200).json(new ApiResponse(200, sharedRepos, `Fetched ${type} repos`))
    }

    const requestPromise = (async () => {
        const response = await axios.get(`https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=${perPage}`)
        const repos = mapGithubRepos(response.data.items)
        setCachedTrendingRepos(cacheKey, repos)
        return repos
    })()

    inFlightTrendingRequests.set(cacheKey, requestPromise)

    let repos
    try {
        repos = await requestPromise
    } finally {
        inFlightTrendingRequests.delete(cacheKey)
    }

    res.setHeader("X-RepoLens-Cache", "MISS")

    return res.status(200).json(new ApiResponse(200, repos, `Fetched ${type} repos`))
})

export const getMyRepos = asyncHandler(async (req, res, next) => {
    const user = req.user
    
    if (!user.githubAccessToken) {
        throw new apiError(403, "GitHub access token not found. Please log in with GitHub to view your repositories.")
    }

    try {
        const response = await axios.get("https://api.github.com/user/repos?sort=updated&per_page=20", {
            headers: {
                Authorization: `Bearer ${user.githubAccessToken}`,
                Accept: "application/vnd.github.v3+json"
            }
        })
        
        const repos = response.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            isPrivate: repo.private,
            language: repo.language,
            updatedAt: repo.updated_at
        }))

        return res.status(200).json(new ApiResponse(200, repos, "Fetched user repos"))
    } catch (error) {
        throw new apiError(401, "Failed to fetch repositories from GitHub. Your token may be invalid or expired.")
    }
})
