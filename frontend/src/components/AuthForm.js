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
        <div className="auth-container">
            <div className="tab-interface">
                <button onClick={handleToggleForm}>
                    {isLoginForm ? "Sign Up" : "Log In"}
                </button>
            </div>
            {isLoginForm ? (
                <form className="login-form" onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && <div style={{ color: "red" }}>{error}</div>}
                    <button type="submit">Log In</button>
                </form>
            ) : (
                <form className="signup-form" onSubmit={handleSignUp}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <select
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
                    {error && <div style={{ color: "red" }}>{error}</div>}
                    <button type="submit">Sign Up</button>
                </form>
            )}
        </div>
    );
};

export default AuthForm;
