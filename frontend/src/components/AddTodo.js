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
            <form
                id="addTodoForm"
                onSubmit={handleSubmit}
                style={{ display: "flex", alignItems: "center" }}
            >
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Todo"
                    required
                />
                <div className="goal-container">
                    <select
                        id="goal"
                        value={goal}
                        onChange={(e) => setGoal(parseInt(e.target.value, 10))}
                        required
                    >
                        {Array.from({ length: 100 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {i + 1}
                            </option>
                        ))}
                    </select>
                    <span
                        style={{
                            display: "inline-block",
                            width: "80px",
                            textAlign: "left",
                        }}
                    >
                        {goal === 1 ? "time per day" : "times per day"}
                    </span>
                </div>
                <button type="submit">Add Todo</button>
            </form>
        </section>
    );
}

export default AddTodo;
