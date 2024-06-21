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
            <form id="addTodoForm" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    required
                />
                <br />
                <label htmlFor="goal">Number of Checkboxes</label>
                <select
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                >
                    {Array.from({ length: 100 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                            {i + 1}
                        </option>
                    ))}
                </select>
                <br />
                <div className="checkbox-preview">
                    {Array.from({ length: goal }, (_, i) => (
                        <div key={i}>
                            <input type="checkbox" disabled />
                            <label>Step {i + 1}</label>
                        </div>
                    ))}
                </div>
                <br />
                <button type="submit">Add Todo</button>
            </form>
        </section>
    );
}

export default AddTodo;
