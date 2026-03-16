import { useEffect } from "react"
import api from "../services/api"
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
                setUser(null)
            })
            .finally(() => {
                setAuthChecked(true)
            })
    }, [])
}
