import axios from "axios"

const defaultApiUrl = "https://api.repolens.xyz/api"
export const API_BASE_URL = import.meta.env.VITE_API_URL || defaultApiUrl

const ACCESS_TOKEN_KEY = "repolens_access_token"
const REFRESH_TOKEN_KEY = "repolens_refresh_token"

function hasStorage() {
    return typeof window !== "undefined" && !!window.localStorage
}

export function getStoredAccessToken() {
    if (!hasStorage()) return null
    return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getStoredRefreshToken() {
    if (!hasStorage()) return null
    return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setStoredAccessToken(token) {
    if (!hasStorage()) return
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function setStoredRefreshToken(token) {
    if (!hasStorage()) return
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function setStoredAuthTokens(data) {
    if (!data) return
    setStoredAccessToken(data.accessToken)
    setStoredRefreshToken(data.refreshToken)
}

export function clearStoredAuthTokens() {
    if (!hasStorage()) return
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAuthHeaders() {
    const token = getStoredAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
}

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

api.interceptors.request.use((config) => {
    const token = getStoredAccessToken()
    if (token) {
        config.headers = config.headers || {}
        if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`
        }
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                const refreshToken = getStoredRefreshToken()
                const refreshResponse = await axios.post(
                    `${API_BASE_URL}/auth/refresh`,
                    refreshToken ? { refreshToken } : {},
                    { withCredentials: true }
                )
                const nextAccessToken = refreshResponse?.data?.data?.accessToken
                if (nextAccessToken) {
                    setStoredAccessToken(nextAccessToken)
                    originalRequest.headers = originalRequest.headers || {}
                    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`
                }
                // refresh successful, retry original request
                return api(originalRequest)
            } catch (err) {
                // refresh failed, likely refresh token is expired/invalid too
                // user should be logged out (UI route protection handles it if auth check fails)
                clearStoredAuthTokens()
                return Promise.reject(err)
            }
        }
        return Promise.reject(error)
    }
)

export default api
