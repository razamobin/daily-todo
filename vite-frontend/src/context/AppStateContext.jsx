import React, { createContext, useState } from "react";

export const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
    const [todos, setTodos] = useState([]);
    const [dailyMessage, setDailyMessage] = useState("");
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [currentTodo, setCurrentTodo] = useState(null);
    const [view, setView] = useState("todos");

    const resetAppState = () => {
        setTodos([]);
        setDailyMessage("");
        setIsUpdateMode(false);
        setCurrentTodo(null);
        setView("todos");
    };

    return (
        <AppStateContext.Provider
            value={{
                todos,
                setTodos,
                dailyMessage,
                setDailyMessage,
                isUpdateMode,
                setIsUpdateMode,
                currentTodo,
                setCurrentTodo,
                view,
                setView,
                resetAppState,
            }}
        >
            {children}
        </AppStateContext.Provider>
    );
};
