import { useEffect } from "react"
import api, { clearStoredAuthTokens } from "../services/api"
import useAppStore from "../store/useAppStore"

export default function useAuth() {
    const setUser = useAppStore((s) => s.setUser)
    const setAuthChecked = useAppStore((s) => s.setAuthChecked)

    useEffect(() => {
        api.get("/auth/me")
            .then((res) => {
                setUser(res.data.data)
            })
            .catch(() => {
                clearStoredAuthTokens()
                setUser(null)
            })
            .finally(() => {
                setAuthChecked(true)
            })
    }, [])
}
