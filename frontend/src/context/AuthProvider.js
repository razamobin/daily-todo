import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        const handleStorageChange = (event) => {
            if (event.key === "user") {
                setUser(event.newValue ? JSON.parse(event.newValue) : null);
            }
        };

        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post(
                "http://localhost:8080/api/login",
                { email, password }
            );
            const userData = response.data;
            setUser(userData);
            console.log(userData);
            localStorage.setItem("user", JSON.stringify(userData));
        } catch (error) {
            console.error("Login failed:", error);
            throw error; // Rethrow the error to be caught by the calling function
        }
    };

    const logout = async () => {
        try {
            await axios.post("http://localhost:8080/api/logout");
            setUser(null);
            localStorage.removeItem("user");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthContext, AuthProvider };
