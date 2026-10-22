import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts ship with the app (no third-party font host): Nunito for headings and navigation, Roboto for text.
import '@fontsource-variable/nunito'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './index.css'
import App from './App.tsx'
import { CustomerSite } from './components/CustomerSite.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Two sites from one bundle: travellers at /, the agency console at /agent. */}
    {window.location.pathname.startsWith('/agent') ? <App /> : <CustomerSite />}
  </StrictMode>,
)
