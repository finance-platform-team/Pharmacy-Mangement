import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./styles/tokens.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/global.css";
import App from './App.tsx'
import { initDataverseOrgUrl } from "./api/dataverse";
// Phone card layout for tables — last, so it wins over each table's own CSS.
import "./styles/cards.css";

// Find out which Dataverse to use (the one of the environment the app runs in) before anything fetches.
void initDataverseOrgUrl().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
