import asyncHandler from "../utils/asyncHandler.js"
import apiError from "../utils/apiError.js"
import ApiResponse from "../utils/apiResponse.js"
import axios from "axios"

export const getTrendingRepos = asyncHandler(async (req, res, next) => {
    const { type = 'top' } = req.query
    
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

    const response = await axios.get(`https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=12`)
    
    const repos = response.data.items.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        ownerAvatar: repo.owner.avatar_url
    }))

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
