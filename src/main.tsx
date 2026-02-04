import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useThemeStore } from "@/stores/themeStore";
import "./index.css";

// 初始化主题
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
