import axios from "axios";
import { logout } from "./context/AuthProvider"; // Adjust the import based on your file structure

// Set default Axios configuration
axios.defaults.withCredentials = true;

// Set up Axios interceptor
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            logout(); // Log the user out
        }
        return Promise.reject(error);
    }
);

export default axios;
