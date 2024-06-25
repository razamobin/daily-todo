import React, { useState, useEffect } from "react";
import axios from "axios";
import AddTodo from "./components/AddTodo";
import TodoList from "./components/TodoList";

function App() {
    const [todos, setTodos] = useState([]);
    const [dailyMessage, setDailyMessage] = useState("");

    useEffect(() => {
        axios
            .get("http://localhost:8080/api/todos")
            .then((response) => {
                setTodos(response.data.todos);
                if (response.data.new_day) {
                    console.log("new day!");
                    fetchDailyMessage();
                }
            })
            .catch((error) => console.error(error));
    }, []);

    const fetchDailyMessage = () => {
        axios
            .get("http://localhost:5001/api/daily-message", {
                params: {
                    user_id: 1,
                    date: new Date().toISOString().split("T")[0],
                },
            })
            .then((response) => setDailyMessage(response.data.message))
            .catch((error) =>
                console.error("Error fetching daily message:", error)
            );
    };

    return (
        <>
            <div className="header-container">
                <header>
                    <h1>
                        daily <span>todos</span>
                    </h1>
                </header>
                <AddTodo setTodos={setTodos} />
            </div>
            <div className="main-container">
                {dailyMessage && (
                    <div className="daily-message">{dailyMessage}</div>
                )}
                <TodoList todos={todos} setTodos={setTodos} />
            </div>
        </>
    );
}

export default App;
