import React from "react";
import axios from "axios";

function TodoList({ todos, setTodos }) {
    const handleCheckboxChange = (todo, checked) => {
        const updatedTodo = { ...todo, status: checked ? 1 : 0 };
        axios
            .put(`http://localhost:8080/api/todos/${todo.id}`, updatedTodo)
            .then(() => {
                setTodos((prevTodos) =>
                    prevTodos.map((t) => (t.id === todo.id ? updatedTodo : t))
                );
            })
            .catch((error) => console.error(error));
    };

    const handleQuantityChange = (todo, count) => {
        const updatedTodo = { ...todo, status: count };
        axios
            .put(`http://localhost:8080/api/todos/${todo.id}`, updatedTodo)
            .then(() => {
                setTodos((prevTodos) =>
                    prevTodos.map((t) => (t.id === todo.id ? updatedTodo : t))
                );
            })
            .catch((error) => console.error(error));
    };

    const groupedTodos = todos.reduce((acc, todo) => {
        const dayNumber = todo.day_number;
        if (!acc[dayNumber]) {
            acc[dayNumber] = [];
        }
        acc[dayNumber].push(todo);
        return acc;
    }, {});

    const formatDayNumber = (dayNumber) => {
        const referenceDate = new Date("2024-06-16");
        referenceDate.setDate(referenceDate.getDate() + dayNumber - 1);
        return referenceDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const sortedDayNumbers = Object.keys(groupedTodos)
        .map(Number)
        .sort((a, b) => b - a); // Sort day numbers in descending order

    /*
            <p className="blood-sugar">{post.blood_sugar}</p>
            <section className="more-info">
                <p className="day" style={{ textTransform: "lowercase" }}>
                    {formatDate(post.day)}
                </p>
                <p className="notes">{post.notes}</p>
            </section>
            */

    return (
        <article>
            {sortedDayNumbers.map((dayNumber) => (
                <div className="todo-list" key={dayNumber}>
                    <p className="day">{formatDayNumber(dayNumber)}</p>
                    <ul>
                        {groupedTodos[dayNumber].map((todo) => (
                            <li key={todo.id}>
                                <p>{todo.title}</p>
                                {todo.type === "yes_no" ? (
                                    <input
                                        type="checkbox"
                                        checked={todo.status === 1}
                                        onChange={(e) =>
                                            handleCheckboxChange(
                                                todo,
                                                e.target.checked
                                            )
                                        }
                                    />
                                ) : (
                                    <section>
                                        {Array.from({ length: todo.goal }).map(
                                            (_, index) => (
                                                <input
                                                    key={index}
                                                    type="checkbox"
                                                    checked={
                                                        index < todo.status
                                                    }
                                                    onChange={() =>
                                                        handleQuantityChange(
                                                            todo,
                                                            index + 1
                                                        )
                                                    }
                                                />
                                            )
                                        )}
                                    </section>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </article>
    );
}

export default TodoList;
