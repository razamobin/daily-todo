import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import App from "./App";
import { AuthProvider } from "./context/AuthProvider";
import { AppStateProvider } from "./context/AppStateContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <AppStateProvider>
        <AuthProvider>
            <App />
        </AuthProvider>
    </AppStateProvider>
);
