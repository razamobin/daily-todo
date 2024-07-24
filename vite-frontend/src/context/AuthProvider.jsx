import React, { createContext, useState, useEffect, useContext } from "react";
import { golangAxios } from "../axiosConfig";
import { AppStateContext } from "./AppStateContext";

const AuthContext = createContext();

let globalLogout; // Define a top-level variable to hold the logout function

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const { resetAppState } = useContext(AppStateContext);

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
            const response = await golangAxios.post("/api/login", {
                email,
                password,
            });
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
            await golangAxios.post("/api/logout");
            setUser(null);
            resetAppState();
            localStorage.removeItem("user");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    // Assign the logout function to the top-level variable
    globalLogout = logout;

    const signup = async (email, password, timezone) => {
        try {
            const response = await golangAxios.post("/api/signup", {
                email,
                password,
                timezone,
            });
            const userData = response.data;
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
        } catch (error) {
            console.error("Signup failed:", error);
            throw error; // Rethrow the error to be caught by the calling function
        }
    };

    const updateUser = (newUserData) => {
        console.log("Updating user:");
        console.log(newUserData);
        console.log("that was the updated user ^");
        setUser(newUserData);
        localStorage.setItem("user", JSON.stringify(newUserData));
    };

    return (
        <AuthContext.Provider
            value={{ user, updateUser, login, logout, signup }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Define a top-level logout function that calls the globalLogout function
const topLevelLogout = () => {
    if (globalLogout) {
        globalLogout();
    }
};

export { AuthContext, AuthProvider, topLevelLogout as logout };
