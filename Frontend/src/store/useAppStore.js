import { create } from "zustand"

const useAppStore = create((set, get) => ({
    // auth
    user: null,

    // current analysis
    sessionId: null,
    repoName: null,
    repoUrl: null,
    tree: null,
    summary: "",
    stats: {},
    architecture: {},
    suggestions: [],
    cached: false,
    sizeMB: null,
    analyzeTime: null,

    // UI state
    selectedFile: null,
    activeOverviewTab: "repo",
    sidebarView: "files",

    // file explanation & raw content
    fileExplanation: "",
    isExplainingFile: false,
    rawFileContent: null,
    isFetchingRaw: false,

    // chat
    chatHistory: [],

    // loading
    isAnalyzing: false,
    isRestoring: false,
    authChecked: false,

    // ── actions ──────────────────────────────────────────────

    setUser: (user) => set({ user }),

    setAnalysis: (data) => set({
        sessionId: data.sessionId,
        repoName: data.repoName,
        repoUrl: data.repoUrl || null,
        tree: data.tree,
        summary: data.summary,
        stats: data.stats,
        architecture: data.architecture,
        suggestions: data.suggestions,
        cached: data.cached || false,
        sizeMB: data.sizeMB || null,
        chatHistory: [],
        selectedFile: null,
        fileExplanation: "",
        rawFileContent: null,
    }),

    selectFile: (file) => set({ selectedFile: file, fileExplanation: "", rawFileContent: null }),

    setFileExplanation: (text) => set({ fileExplanation: text }),
    appendFileExplanation: (chunk) => set((s) => ({
        fileExplanation: s.fileExplanation + chunk,
    })),

    setActiveOverviewTab: (tab) => set({ activeOverviewTab: tab }),
    setSidebarView: (view) => set({ sidebarView: view }),
    setIsAnalyzing: (v) => set({ isAnalyzing: v }),
    setIsRestoring: (v) => set({ isRestoring: v }),
    setIsExplainingFile: (v) => set({ isExplainingFile: v }),
    setIsFetchingRaw: (v) => set({ isFetchingRaw: v }),
    setRawFileContent: (v) => set({ rawFileContent: v }),
    setAuthChecked: (v) => set({ authChecked: v }),

    addChatMessage: (msg) => set((s) => ({
        chatHistory: [...s.chatHistory, msg],
    })),

    updateLastMessage: (text) => set((s) => {
        const history = [...s.chatHistory]
        if (history.length > 0) {
            history[history.length - 1] = {
                ...history[history.length - 1],
                content: history[history.length - 1].content + text,
            }
        }
        return { chatHistory: history }
    }),

    reset: () => set({
        sessionId: null,
        repoName: null,
        repoUrl: null,
        tree: null,
        summary: "",
        stats: {},
        architecture: {},
        suggestions: [],
        cached: false,
        sizeMB: null,
        analyzeTime: null,
        selectedFile: null,
        fileExplanation: "",
        isExplainingFile: false,
        rawFileContent: null,
        isFetchingRaw: false,
        chatHistory: [],
        isAnalyzing: false,
        isRestoring: false,
        activeOverviewTab: "repo",
        sidebarView: "files",
    }),
}))

export default useAppStore
