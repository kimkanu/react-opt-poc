import React from "react";
import ReactDOM from "react-dom/client";
import { OptProvider } from "./react-opt";

import App from "./App.tsx";
import { optClient } from "./opt";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptProvider client={optClient}>
      <App />
    </OptProvider>
  </React.StrictMode>,
);
