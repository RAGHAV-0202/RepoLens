import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Apply persisted theme before first paint
const dark = JSON.parse(localStorage.getItem("repolens-dark") || "false")
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
