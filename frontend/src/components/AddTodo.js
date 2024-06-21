import React, { useState } from "react";
import axios from "axios";

function AddTodo({ setTodos }) {
    const [title, setTitle] = useState("");
    const [type, setType] = useState("yes_no");
    const [goal, setGoal] = useState(0);

    const handleSubmit = (e) => {
        e.preventDefault();
        const todo = {
            title,
            type,
            goal: parseInt(goal, 10) || 0,
        };
        axios
            .post("http://localhost:8080/api/todos", todo)
            .then((response) => {
                setTodos((prevTodos) => [...prevTodos, response.data]);
                setTitle("");
                setType("yes_no");
                setGoal(0);
            })
            .catch((error) => console.error(error));
    };

    return (
        <section class="add-todo">
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
                <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="yes_no">Yes/No</option>
                    <option value="quantity">Quantity</option>
                </select>
                <br />
                {type === "quantity" && (
                    <input
                        type="number"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="Goal"
                        required
                    />
                )}
                <br />
                <button type="submit">Add Todo</button>
            </form>
        </section>
    );
}

export default AddTodo;
