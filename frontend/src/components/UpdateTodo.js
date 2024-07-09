import React, { useState } from "react";
import axios from "../axiosConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";

function UpdateTodo({ todo, setTodos, onCancel }) {
    const [title, setTitle] = useState(todo.title);
    const [goal, setGoal] = useState(todo.goal);

    const handleSubmit = (e) => {
        e.preventDefault();
        const updatedTodo = {
            ...todo,
            title,
            goal: parseInt(goal, 10) || 1,
        };
        axios
            .put(`http://localhost:8080/api/todos/${todo.id}`, updatedTodo)
            .then((response) => {
                setTodos((prevTodos) =>
                    prevTodos.map((t) => (t.id === todo.id ? response.data : t))
                );
                onCancel(); // Close the form after update
            })
            .catch((error) => console.error(error));
    };

    const handleDelete = () => {
        axios
            .delete(`http://localhost:8080/api/todos/${todo.id}`)
            .then(() => {
                setTodos((prevTodos) =>
                    prevTodos.filter((t) => t.id !== todo.id)
                );
                onCancel(); // Close the form after delete
            })
            .catch((error) => console.error(error));
    };

    return (
        <section className="flex-1 text-xs font-normal">
            <form
                id="updateTodoForm"
                onSubmit={handleSubmit}
                className="w-full max-w-[540px] mx-auto p-2 grid gap-2"
            >
                <div className="form-row flex items-center gap-2">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Edit Todo"
                        required
                        className="p-2 text-xs border border-gray-300 rounded flex-1"
                    />
                    <div className="goal-container flex items-center gap-1">
                        <select
                            id="goal"
                            value={goal}
                            onChange={(e) =>
                                setGoal(parseInt(e.target.value, 10))
                            }
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
                        type="button"
                        onClick={onCancel}
                        className="bg-white text-black border border-black p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="bg-black text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-800"
                    >
                        Update
                    </button>
                </div>
                <div className="form-row action-buttons flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="bg-red-500 text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-red-700 flex items-center justify-center"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </form>
        </section>
    );
}

export default UpdateTodo;
