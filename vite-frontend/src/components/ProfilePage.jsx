import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthProvider";
import { getTimeZones } from "@vvo/tzdb";
import { golangAxios } from "../axiosConfig";

function ProfilePage() {
    const { updateUser } = useContext(AuthContext);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [timezone, setTimezone] = useState("");
    const [mission, setMission] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const timeZones = getTimeZones();

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await golangAxios.get("/api/user-profile");
                const profileData = response.data;
                setUsername(profileData.username);
                setEmail(profileData.email);
                setTimezone(profileData.timezone);
                setMission(profileData.mission);
            } catch (error) {
                console.error("Failed to fetch user profile:", error);
                setError("Failed to load profile. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserProfile();
    }, []);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const response = await golangAxios.post("/api/user-profile", {
                username,
                email,
                timezone,
                mission,
            });
            console.log("response.data in profile page.js");
            console.log(response.data);
            updateUser(response.data);
            setSuccess("Profile updated successfully.");
        } catch (error) {
            console.log(error);
            setError("Failed to update profile. Please try again.");
        }
    };

    if (isLoading) {
        return <></>;
    }

    return (
        <div className="profile-container col-start-3 col-end-4 flex items-center justify-center py-12">
            <div className="border border-black p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">
                    Edit Profile
                </h2>
                <form onSubmit={handleUpdateProfile}>
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="username"
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="border border-black rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
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
                    <div className="mb-4">
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
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="mission"
                        >
                            Mission
                        </label>
                        <textarea
                            id="mission"
                            className="border border-black rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none min-h-[160px]"
                            placeholder="Enter your mission"
                            value={mission}
                            onChange={(e) => setMission(e.target.value)}
                            rows="10"
                        />
                    </div>
                    {error && <div className="text-red-500 mb-4">{error}</div>}
                    {success && (
                        <div className="text-green-500 mb-4">{success}</div>
                    )}
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-4 rounded focus:outline-none"
                        >
                            Update Profile
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProfilePage;
