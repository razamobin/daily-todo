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
                if (true || response.data.new_day) {
                    console.log("new day!");
                    fetchDailyMessage();
                }
            })
            .catch((error) => console.error(error));
    }, []);

    const fetchDailyMessage = () => {
        const eventSource = new EventSource(
            "http://localhost:5001/api/daily-message?user_id=1&date=" +
                new Date().toISOString().split("T")[0]
        );
        /*
        const eventSource = new EventSource(
            "http://localhost:5001/api/stream-test"
        );
        */

        eventSource.onmessage = (event) => {
            setDailyMessage((prevMessage) => prevMessage + event.data);
        };

        eventSource.onerror = (error) => {
            console.error("Error fetching daily message:", error);
            eventSource.close();
        };
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
