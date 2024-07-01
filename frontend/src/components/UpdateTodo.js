import React, { useState } from "react";
import axios from "axios";
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
        <section className="update-todo">
            <form id="updateTodoForm" onSubmit={handleSubmit}>
                <div className="form-row">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Edit Todo"
                        required
                    />
                    <div className="goal-container">
                        <select
                            id="goal"
                            value={goal}
                            onChange={(e) =>
                                setGoal(parseInt(e.target.value, 10))
                            }
                            required
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {i + 1}
                                </option>
                            ))}
                        </select>
                        <span className="goal-text">
                            {goal === 1 ? "time per day" : "times per day"}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="cancel-button"
                    >
                        Cancel
                    </button>
                    <button type="submit" className="update-button">
                        Update
                    </button>
                </div>
                <div className="form-row action-buttons">
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="delete-button"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </form>
        </section>
    );
}

export default UpdateTodo;
