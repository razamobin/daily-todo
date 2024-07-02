import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthProvider";

const AuthForm = () => {
    const { login } = useContext(AuthContext);
    const [isLoginForm, setIsLoginForm] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [timezone, setTimezone] = useState("");
    const [error, setError] = useState("");

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

    const handleSignUp = (e) => {
        e.preventDefault();
        // Add sign-up logic here
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
                        <option value="">Select Timezone</option>
                        {/* Add timezone options here */}
                    </select>
                    <button type="submit">Sign Up</button>
                </form>
            )}
        </div>
    );
};

export default AuthForm;
