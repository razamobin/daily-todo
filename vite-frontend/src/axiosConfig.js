import axios from "axios";
import { logout } from "./context/AuthProvider";

const golangBackendUrl =
    import.meta.env.VITE_GOLANG_BACKEND_URL || "http://localhost:8080";
const pythonBackendUrl =
    import.meta.env.VITE_PYTHON_BACKEND_URL || "http://localhost:5001";

const golangAxios = axios.create({
    baseURL: golangBackendUrl,
    withCredentials: true,
});

const pythonAxios = axios.create({
    baseURL: pythonBackendUrl,
    withCredentials: true,
});

[golangAxios, pythonAxios].forEach((instance) => {
    instance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response && error.response.status === 401) {
                logout();
            }
            return Promise.reject(error);
        }
    );
});

export { golangAxios, pythonAxios, pythonBackendUrl };
