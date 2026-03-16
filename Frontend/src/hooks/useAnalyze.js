import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import api from "../services/api"
import useAppStore from "../store/useAppStore"

export default function useAnalyze() {
    const setAnalysis = useAppStore((s) => s.setAnalysis)
    const setIsAnalyzing = useAppStore((s) => s.setIsAnalyzing)
    const setAnalyzeProgress = useAppStore((s) => s.setAnalyzeProgress)
    const setAnalyzeStage = useAppStore((s) => s.setAnalyzeStage)
    const navigate = useNavigate()

    const analyze = useCallback(async (repoUrl) => {
        const normalizedUrl = repoUrl?.trim()
        if (!normalizedUrl) return
        if (useAppStore.getState().isAnalyzing) return

        setIsAnalyzing(true)
        setAnalyzeProgress(6)
        setAnalyzeStage("Validating repository URL...")

        const ticker = setInterval(() => {
            const { analyzeProgress } = useAppStore.getState()
            if (analyzeProgress >= 94) return

            const step = analyzeProgress < 35 ? 7 : analyzeProgress < 70 ? 4 : 2
            const next = Math.min(94, analyzeProgress + step)
            setAnalyzeProgress(next)

            if (next < 28) setAnalyzeStage("Cloning repository...")
            else if (next < 62) setAnalyzeStage("Indexing files and dependencies...")
            else if (next < 88) setAnalyzeStage("Generating architecture summary...")
            else setAnalyzeStage("Finalizing analysis...")
        }, 650)

        try {
            const user = useAppStore.getState().user
            const start = Date.now()

            // Handle unauthenticated guest view (Decoy)
            if (!user) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 1200))

                const mockData = {
                    sessionId: "guest-mock-session",
                    repoName: normalizedUrl.split("/").pop(),
                    repoUrl: normalizedUrl,
                    tree: { name: "src", type: "tree", children: [{ name: "index.js", type: "blob", size: 1024 }] },
                    summary: "This is a simulated analysis for unauthenticated users. Please sign in to view the full deep-dive architectural breakdown of " + normalizedUrl.split("/").pop() + ".",
                    stats: { totalFiles: 42, totalLines: 1337, primaryLanguage: "JavaScript", languages: { JavaScript: 100 } },
                    architecture: { "Core": "Handles main logic" },
                    suggestions: ["Sign in to view real suggestions"],
                    cached: false,
                    sizeMB: 1.5,
                }
                const elapsed = ((Date.now() - start) / 1000).toFixed(1)
                setAnalysis({ ...mockData, analyzeTime: elapsed })
                useAppStore.setState({ analyzeTime: elapsed })
                setAnalyzeProgress(100)
                setAnalyzeStage("Done")
                navigate(`/app?session=${mockData.sessionId}`)
                return
            }

            // Normal authenticated flow
            const res = await api.post("/analyze", { repoUrl: normalizedUrl })
            const elapsed = ((Date.now() - start) / 1000).toFixed(1)
            const data = res.data.data
            setAnalysis({ ...data, repoUrl: normalizedUrl, analyzeTime: elapsed })
            useAppStore.setState({ analyzeTime: elapsed })
            setAnalyzeProgress(100)
            setAnalyzeStage("Done")
            navigate(`/app?session=${data.sessionId}`)
        } catch (err) {
            setAnalyzeProgress(0)
            setAnalyzeStage("")
            const msg = err.response?.data?.message || err.message
            throw new Error(msg)
        } finally {
            clearInterval(ticker)
            setTimeout(() => {
                useAppStore.getState().setAnalyzeProgress(0)
                useAppStore.getState().setAnalyzeStage("")
            }, 300)
            setIsAnalyzing(false)
        }
    }, [navigate, setAnalysis, setIsAnalyzing, setAnalyzeProgress, setAnalyzeStage])

    return { analyze }
}
