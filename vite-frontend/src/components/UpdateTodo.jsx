import React, { useState, useEffect } from "react";
import axios from "../axiosConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

function UpdateTodo({ todo, setTodos, onCancel, isFinalized }) {
    const [title, setTitle] = useState(todo.title);
    const [goal, setGoal] = useState(todo.goal);
    const [description, setDescription] = useState(todo.description || "");
    const [itemNotes, setItemNotes] = useState(todo.notes || "");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (isModalOpen) {
            document.body.classList.add("overflow-hidden");
        } else {
            document.body.classList.remove("overflow-hidden");
        }

        return () => {
            document.body.classList.remove("overflow-hidden");
        };
    }, [isModalOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isFinalized) return; // Prevent form submission if the day is finalized
        const updatedTodo = {
            ...todo,
            title,
            goal: parseInt(goal, 10) || 1,
            description,
            notes: itemNotes,
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
        if (isFinalized) return; // Prevent deletion if the day is finalized
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

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
        <section className="flex-1 text-xs font-normal bg-gray-100 pl-4 pr-4 pb-4 rounded-md">
            {/* Dark overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 pointer-events-none"></div>
            )}

            <form
                id="updateTodoForm"
                onSubmit={handleSubmit}
                className={`w-full max-w-[540px] mx-auto p-2 grid gap-2 ${
                    isModalOpen ? "pointer-events-none" : ""
                }`}
            >
                <div className="form-row flex items-center gap-2">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Edit Todo"
                        required
                        className={`p-2 text-xs border border-gray-300 rounded flex-1 ${
                            isModalOpen ? "bg-gray-50" : ""
                        }`}
                        disabled={isFinalized}
                    />
                    <div className="goal-container flex items-center gap-1">
                        <select
                            id="goal"
                            value={goal}
                            onChange={(e) =>
                                setGoal(parseInt(e.target.value, 10))
                            }
                            required
                            className={`w-16 p-2 text-xs border border-gray-300 rounded ${
                                isModalOpen ? "bg-gray-50" : ""
                            }`}
                            disabled={isFinalized}
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
                </div>
                <div className="form-row flex flex-col gap-1">
                    <label
                        htmlFor="itemNotes"
                        className="text-xs font-semibold"
                    >
                        How is this todo going today?
                    </label>
                    <textarea
                        id="itemNotes"
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        placeholder="Edit Notes"
                        className={`p-2 text-xs border border-gray-300 rounded flex-1 ${
                            isModalOpen ? "bg-gray-50" : ""
                        }`}
                        rows="3"
                        disabled={isFinalized}
                    />
                </div>
                <div className="form-row flex flex-col gap-1">
                    <label
                        htmlFor="description"
                        className="text-xs font-semibold"
                    >
                        Why is this todo important to you?
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Edit Description"
                        className={`p-2 text-xs border border-gray-300 rounded flex-1 ${
                            isModalOpen ? "bg-gray-50" : ""
                        }`}
                        rows="5"
                        disabled={isFinalized}
                    />
                </div>
                <div className="form-row action-buttons flex justify-between gap-2">
                    <button
                        type="button"
                        onClick={openModal}
                        className={`bg-red-500 text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-red-700 flex items-center justify-center ${
                            isFinalized ? "opacity-50 cursor-not-allowed" : ""
                        } ${
                            isModalOpen ? "opacity-25 pointer-events-none" : ""
                        }`}
                        disabled={isFinalized}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`bg-white text-black border border-black p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-200 ${
                                isModalOpen
                                    ? "opacity-25 pointer-events-none"
                                    : ""
                            }`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`bg-black text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-800 ${
                                isFinalized
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            } ${
                                isModalOpen
                                    ? "opacity-25 pointer-events-none"
                                    : ""
                            }`}
                            disabled={isFinalized}
                        >
                            Update
                        </button>
                    </div>
                </div>
            </form>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
                    <div className="bg-white p-4 rounded shadow-lg max-w-sm w-full">
                        <h2 className="text-lg font-semibold mb-4">
                            Confirm Deletion
                        </h2>
                        <p className="text-sm mb-4">
                            Are you sure you want to delete the todo item:
                            <br />
                            <strong>{title}</strong> ?
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                className="bg-gray-200 text-black p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete();
                                    closeModal();
                                }}
                                className="bg-red-500 text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default UpdateTodo;
