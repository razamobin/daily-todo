import React, { createContext, useState } from "react";

export const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
    const [todos, setTodos] = useState([]);
    const [dailyMessage, setDailyMessage] = useState("");
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [currentTodo, setCurrentTodo] = useState(null);

    const resetAppState = () => {
        setTodos([]);
        setDailyMessage("");
        setIsUpdateMode(false);
        setCurrentTodo(null);
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
                resetAppState,
            }}
        >
            {children}
        </AppStateContext.Provider>
    );
};
