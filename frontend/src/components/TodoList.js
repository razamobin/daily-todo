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
        referenceDate.setDate(referenceDate.getDate() + dayNumber);
        const options = {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
        };
        const [weekday, month, day, year] = referenceDate
            .toLocaleDateString("en-US", options)
            .replace(/,/g, "")
            .split(" ");
        return { weekday, month, day, year };
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
        <>
            {sortedDayNumbers.map((dayNumber) => (
                <>
                    <p className="day">
                        <div className="date-container">
                            <span className="day-of-week">
                                {formatDayNumber(dayNumber).weekday}
                            </span>
                            <div className="date-details">
                                <div className="day-of-month">
                                    {formatDayNumber(dayNumber).day}
                                </div>
                                <div className="month">
                                    {formatDayNumber(dayNumber).month}
                                </div>
                                <div className="year">
                                    {formatDayNumber(dayNumber).year}
                                </div>
                            </div>
                        </div>
                    </p>
                    <div key={dayNumber} className="todo-list">
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
                                            {Array.from({
                                                length: todo.goal,
                                            }).map((_, index) => (
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
                                            ))}
                                        </section>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            ))}
        </>
    );
}

export default TodoList;
