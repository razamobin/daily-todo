import React, { useState, useEffect } from "react";
import { golangAxios, pythonAxios } from "../axiosConfig";

const HealthCheck = () => {
    const [healthStatus, setHealthStatus] = useState(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const results = await Promise.allSettled([
                    golangAxios.get("/health", { validateStatus: () => true }),
                    pythonAxios.get("/health", { validateStatus: () => true }),
                ]);
                setHealthStatus(Object.fromEntries(results.map((result, index) => [
                    index === 0 ? "golang" : "python",
                    result.status === "fulfilled"
                        ? { status: result.value.status, details: result.value.data }
                        : { error: "Backend could not be reached" },
                ])));
            } catch (error) {
                setHealthStatus({ error: "Error checking health status" });
            }
        };

        checkHealth();
    }, []);

    return (
        <div>
            {healthStatus ? (
                <pre>{JSON.stringify(healthStatus, null, 2)}</pre>
            ) : (
                <p>Checking health status...</p>
            )}
        </div>
    );
};

export default HealthCheck;
