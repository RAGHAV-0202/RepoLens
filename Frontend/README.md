# RepoLens Frontend

Frontend application for RepoLens, built with React + Vite.

RepoLens helps users understand repositories quickly with:
- AI-generated repository summaries and architecture hints
- Interactive analysis workspace
- File-level explanations with code view
- Repo-aware chat with markdown rendering (lists, tables, inline code, fenced code blocks)
- Shareable public analysis pages

## Stack

- React 19
- React Router 7
- Zustand (global app state)
- Axios (API client with token refresh)
- React Syntax Highlighter
- Vite 7

## Routes

| Route | Purpose |
| --- | --- |
| / | Landing page |
| /login | Sign in |
| /register | Sign up |
| /dashboard | User dashboard (protected) |
| /app?session=<id> | Analysis workspace |
| /history | Analysis history (protected) |
| /share/:sessionId | Public shared analysis |

## Environment

Create a `.env` file in the `Frontend` directory:

```env
VITE_API_URL=http://localhost:4000/api
```

If `VITE_API_URL` is not set, the frontend uses:

`https://api.repolens.xyz/api`

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Local Development

1. Start backend first (default expected API: `http://localhost:4000/api`).
2. Start frontend:

```bash
cd Frontend
npm install
npm run dev
```

3. Open the Vite URL shown in terminal (typically `http://localhost:5173`).

## Folder Layout

```text
src/
	App.jsx
	main.jsx
	index.css
	pages/
	components/
		auth/
		chat/
		layout/
		panels/
		tree/
	hooks/
	services/
	store/
```

## Notes

- Authenticated endpoints use bearer token headers and automatic refresh fallback.
- Dark mode preference is persisted in local storage.
- Browser page titles are route-aware (set in `src/App.jsx`).
