import React, { useState } from "react";
import axios from "axios";

function AddTodo({ setTodos }) {
    const [title, setTitle] = useState("");
    const [goal, setGoal] = useState(1);

    const handleSubmit = (e) => {
        e.preventDefault();
        const todo = {
            title,
            goal: parseInt(goal, 10) || 1,
        };
        axios
            .post("http://localhost:8080/api/todos", todo)
            .then((response) => {
                setTodos((prevTodos) => [...prevTodos, response.data]);
                setTitle("");
                setGoal(1);
            })
            .catch((error) => console.error(error));
    };

    return (
        <section className="add-todo">
            <button
                onClick={() =>
                    (document.getElementById("addTodoForm").style.display =
                        "block")
                }
            >
                Add Task
            </button>
            <form id="addTodoForm" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    required
                />
                <br />
                <input
                    type="number"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Goal"
                    required
                />
                <br />
                <button type="submit">Add Todo</button>
            </form>
        </section>
    );
}

export default AddTodo;
