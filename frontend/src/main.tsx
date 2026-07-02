import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ControlPanel } from "./ControlPanel";
import "./index.css";

const isPanel = new URLSearchParams(window.location.search).has("panel");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPanel ? <ControlPanel /> : <App />}
  </React.StrictMode>
);
