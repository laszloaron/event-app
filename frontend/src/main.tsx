import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { SessionProvider } from "./session/session";
import { DataProvider } from "./hooks/data";
import { ToastProvider } from "./hooks/toast";
import { SearchAreaProvider } from "./hooks/searchArea";
import "./styles/tokens.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <DataProvider>
          <SearchAreaProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </SearchAreaProvider>
        </DataProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
