import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles.css";
import "./styles/workbench-shell.css";
import "./styles/workbench-surfaces.css";
import "./styles/workbench-dialogs.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
