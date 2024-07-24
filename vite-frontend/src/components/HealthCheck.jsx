import React, { useState, useEffect } from "react";
import { golangAxios, pythonAxios } from "../axiosConfig";

const HealthCheck = () => {
    const [healthStatus, setHealthStatus] = useState(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const golangResponse = await golangAxios.get("/health");
                const pythonResponse = await pythonAxios.get("/health");

                console.log("Golang Response Data:", golangResponse.data);
                console.log("Python Response Data:", pythonResponse.data);

                if (
                    golangResponse.status === 200 &&
                    pythonResponse.status === 200
                ) {
                    setHealthStatus({
                        golang:
                            typeof golangResponse.data === "string"
                                ? golangResponse.data.length
                                : JSON.stringify(golangResponse.data).length,
                        python:
                            typeof pythonResponse.data === "string"
                                ? pythonResponse.data.length
                                : JSON.stringify(pythonResponse.data).length,
                    });
                } else {
                    setHealthStatus({ error: "One or both services are down" });
                }
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
