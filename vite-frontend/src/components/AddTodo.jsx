import React, { useState } from "react";
import { golangAxios } from "../axiosConfig";

function AddTodo({ setTodos }) {
    const [title, setTitle] = useState("");
    const [goal, setGoal] = useState(1);

    const handleSubmit = (e) => {
        e.preventDefault();
        const todo = {
            title,
            goal: parseInt(goal, 10) || 1,
        };
        golangAxios
            .post("/api/todos", todo)
            .then((response) => {
                setTodos((prevTodos) => [...prevTodos, response.data]);
                setTitle("");
                setGoal(1);
            })
            .catch((error) => console.error(error));
    };

    return (
        <section className="add-todo mt-2 mb-2 col-start-3 col-end-4">
            <form
                id="addTodoForm"
                onSubmit={handleSubmit}
                className="w-full max-w-[540px] mx-auto p-2 flex items-center gap-2"
            >
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New Todo"
                    required
                    className="p-2 text-xs border border-gray-300 rounded flex-1"
                />
                <div className="goal-container flex items-center gap-1">
                    <select
                        id="goal"
                        value={goal}
                        onChange={(e) => setGoal(parseInt(e.target.value, 10))}
                        required
                        className="w-16 p-2 text-xs border border-gray-300 rounded"
                    >
                        {Array.from({ length: 24 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {i + 1}
                            </option>
                        ))}
                    </select>
                    <span className="goal-text inline-block w-22 text-left text-xs">
                        {goal === 1 ? "time per day" : "times per day"}
                    </span>
                </div>
                <button
                    type="submit"
                    className="bg-black text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-800"
                >
                    Add Todo
                </button>
            </form>
        </section>
    );
}

export default AddTodo;
