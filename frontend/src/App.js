import React, { useState, useEffect } from "react";
import axios from "axios";
import AddTodo from "./components/AddTodo";
import TodoList from "./components/TodoList";

function App() {
    const [todos, setTodos] = useState([]);

    useEffect(() => {
        axios
            .get("http://localhost:8080/api/todos")
            .then((response) => setTodos(response.data))
            .catch((error) => console.error(error));
    }, []);

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
                <TodoList todos={todos} setTodos={setTodos} />
            </div>
        </>
    );
}

export default App;
