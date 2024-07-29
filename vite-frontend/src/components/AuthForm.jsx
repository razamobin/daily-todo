import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthProvider";
import { getTimeZones } from "@vvo/tzdb";

const AuthForm = () => {
    const { login, signup } = useContext(AuthContext);
    const [isLoginForm, setIsLoginForm] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [timezone, setTimezone] = useState({});
    const [error, setError] = useState("");

    const timeZones = getTimeZones();

    useEffect(() => {
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(userTimeZone);
    }, []);

    const handleToggleForm = () => {
        setIsLoginForm(!isLoginForm);
        setError(""); // Clear error when toggling form
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
        } catch (error) {
            console.log(error);
            if (error.response && error.response.status === 401) {
                setError("Login failed: Invalid email or password.");
            } else {
                setError("Login failed: An unexpected error occurred.");
            }
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError("Signup failed: Password must be at least 6 characters.");
            return;
        }
        try {
            await signup(email, password, timezone);
        } catch (error) {
            console.log(error);
            if (error.response) {
                if (error.response.status === 409) {
                    setError("Signup failed: Email already exists.");
                } else if (error.response.status === 400) {
                    setError(
                        "Signup failed: Invalid email address or password."
                    );
                } else {
                    setError("Signup failed: An unexpected error occurred.");
                }
            } else {
                setError("Signup failed: An unexpected error occurred.");
            }
        }
    };

    return (
        <div className="auth-container flex items-center justify-center py-12 col-start-3 col-end-4">
            <div className="border border-black p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">
                    {isLoginForm ? "Login" : "Sign Up"}
                </h2>
                <form onSubmit={isLoginForm ? handleLogin : handleSignUp}>
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="email"
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="border border-black rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="password"
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="border border-black rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {!isLoginForm && (
                        <div className="mb-6">
                            <label
                                className="block text-gray-700 text-sm font-bold mb-2"
                                htmlFor="timezone"
                            >
                                Timezone
                            </label>
                            <select
                                id="timezone"
                                className="border border-black rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                            >
                                <option value="" disabled>
                                    Select Timezone
                                </option>
                                {timeZones.map((tz) => (
                                    <option key={tz.name} value={tz.name}>
                                        {tz.currentTimeFormat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {error && <div className="text-red-500 mb-4">{error}</div>}
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-4 rounded focus:outline-none"
                        >
                            {isLoginForm ? "Log In" : "Sign Up"}
                        </button>
                    </div>
                </form>
                <div className="mt-4 text-center">
                    <button
                        onClick={handleToggleForm}
                        className="text-black underline hover:text-gray-800"
                    >
                        {isLoginForm ? "Sign Up" : "Log In"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthForm;
