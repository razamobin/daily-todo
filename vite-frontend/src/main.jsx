import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./style.css";
import App from "./App";
import { AuthProvider } from "./context/AuthProvider";
import { AppStateProvider } from "./context/AppStateContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <BrowserRouter>
        <AppStateProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </AppStateProvider>
    </BrowserRouter>
);
