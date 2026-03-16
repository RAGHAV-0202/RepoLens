import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import api from "../services/api"
import useAppStore from "../store/useAppStore"

export default function useAnalyze() {
    const setAnalysis = useAppStore((s) => s.setAnalysis)
    const setIsAnalyzing = useAppStore((s) => s.setIsAnalyzing)
    const navigate = useNavigate()

    const analyze = useCallback(async (repoUrl) => {
        setIsAnalyzing(true)
        try {
            const user = useAppStore.getState().user
            const start = Date.now()

            // Handle unauthenticated guest view (Decoy)
            if (!user) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 1200))

                const mockData = {
                    sessionId: "guest-mock-session",
                    repoName: repoUrl.split("/").pop(),
                    repoUrl: repoUrl,
                    tree: { name: "src", type: "tree", children: [{ name: "index.js", type: "blob", size: 1024 }] },
                    summary: "This is a simulated analysis for unauthenticated users. Please sign in to view the full deep-dive architectural breakdown of " + repoUrl.split("/").pop() + ".",
                    stats: { totalFiles: 42, totalLines: 1337, primaryLanguage: "JavaScript", languages: { JavaScript: 100 } },
                    architecture: { "Core": "Handles main logic" },
                    suggestions: ["Sign in to view real suggestions"],
                    cached: false,
                    sizeMB: 1.5,
                }
                const elapsed = ((Date.now() - start) / 1000).toFixed(1)
                setAnalysis({ ...mockData, analyzeTime: elapsed })
                useAppStore.setState({ analyzeTime: elapsed })
                navigate(`/app?session=${mockData.sessionId}`)
                return
            }

            // Normal authenticated flow
            const res = await api.post("/analyze", { repoUrl })
            const elapsed = ((Date.now() - start) / 1000).toFixed(1)
            const data = res.data.data
            setAnalysis({ ...data, repoUrl, analyzeTime: elapsed })
            useAppStore.setState({ analyzeTime: elapsed })
            navigate(`/app?session=${data.sessionId}`)
        } catch (err) {
            const msg = err.response?.data?.message || err.message
            throw new Error(msg)
        } finally {
            setIsAnalyzing(false)
        }
    }, [navigate, setAnalysis, setIsAnalyzing])

    return { analyze }
}
