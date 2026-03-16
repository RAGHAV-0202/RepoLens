# RepoLens 🔍

**Understand any codebase in seconds, not hours** — AI-powered repository intelligence that combines architecture analysis, interactive visualization, and conversational AI.


## What It Does

RepoLens is a full-stack web application that analyzes GitHub repositories using LLM capabilities. Users can:

- Paste a GitHub URL and get instant AI-powered analysis
- View architectural breakdowns and file explanations
- Explore code structure via interactive treemaps and file trees
- Chat with the codebase using natural language questions
- Track analysis history and saved sessions

## Tech Stack

### Frontend (React + Vite)

- **React** 19 — UI framework
- **React Router DOM** 7 — Routing
- **Zustand** 5 — State management
- **Tailwind CSS** 4 — Styling
- **React Syntax Highlighter** — Code display
- **Axios** — HTTP client
- **Vite** 8 — Build tool

### Backend (Node.js + Express)

- **Express** 5 — Server framework
- **MongoDB** + **Mongoose** 9 — Database
- **Groq SDK** — LLM API (AI explanations)
- **Redis** (ioredis) — Session caching
- **JWT** (jsonwebtoken) — Authentication
- **simple-git** — Repository cloning
- **Bcrypt** — Password hashing

## Key Features

### Core Analysis

- Clone & index public GitHub repos (shallow clone, size-limited)
- AI-powered file and function explanations via Groq LLM
- Repository summary, architecture detection, and suggestions

### Visualization

- Interactive treemaps for repo structure
- File tree browser with syntax highlighting
- Detail panel for selected file explanations
- Overview panel for repo metadata and stats

### Chat Interface

- Ask questions about code in natural language
- Context-aware responses grounded in repo file contents
- Streaming SSE responses with chat history

### User Management

- JWT-based authentication (register / login)
- GitHub OAuth integration (fetch your own repos)
- Analysis history & trending repos dashboard
- Persistent session URLs — shareable and refresh-safe

## Environment Variables

### Backend (`Backend/.env`)

```
PORT=4000
MONGO_URI=mongodb+srv://...
GROQ_API_KEY=gsk_...
ACCESS_TOKEN_SECRET=<secret>
ACCESS_TOKEN_EXPIRY=7d
REFRESH_TOKEN_SECRET=<secret>
REFRESH_TOKEN_EXPIRY=14d
NODE_ENV=development
```

### Frontend

```
VITE_API_URL=http://localhost:4000/api   # optional, defaults to localhost:4000
```

## Getting Started

### Backend

```bash
cd Backend
npm install
npm run dev        # Development with nodemon
npm start          # Production
```

### Frontend

```bash
cd Frontend
npm install
npm run dev        # Vite dev server (default: localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build
```

## Project Structure

```
RepoLens/
├── Backend/
│   └── src/
│       ├── controllers/   # Route handlers (analyze, auth, chat, github)
│       ├── models/        # Mongoose schemas (Analysis, User)
│       ├── routes/        # Express route definitions
│       ├── services/      # Core logic (git, LLM, tree builder, session store)
│       ├── middlewares/   # Auth middleware
│       └── utils/         # Error handling, async wrappers
├── Frontend/
│   └── src/
│       ├── pages/         # Landing, Dashboard, App, History
│       ├── components/    # Layout, panels, chat, tree, auth
│       ├── hooks/         # useAnalyze, useChat, useFileExplain, useAuth
│       ├── services/      # Axios API client, session restore
│       └── store/         # Zustand global state
└── README.md
```

---

**Built with ♥ using React, Node.js & Groq AI**
