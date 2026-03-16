import axios from "axios"

const defaultApiUrl = "https://api.repolens.xyz/api"
export const API_BASE_URL = import.meta.env.VITE_API_URL || defaultApiUrl

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                await axios.post(
                    `${API_BASE_URL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                )
                // refresh successful, retry original request
                return api(originalRequest)
            } catch (err) {
                // refresh failed, likely refresh token is expired/invalid too
                // user should be logged out (UI route protection handles it if auth check fails)
                return Promise.reject(err)
            }
        }
        return Promise.reject(error)
    }
)

export default api
