import React from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

function TodoList({ todos, setTodos }) {
    const handleQuantityChange = (todo, index) => {
        let newStatus;
        if (index < todo.status) {
            newStatus = index;
        } else {
            newStatus = index + 1;
        }
        const updatedTodo = { ...todo, status: newStatus };
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

    const onDragEnd = (result) => {
        if (!result.destination) return;
        console.log("src " + result.source.index);
        console.log("dest " + result.destination.index);

        const dayNumber = parseInt(result.source.droppableId, 10);
        console.log("on drag end, day number = " + dayNumber);
        const reorderedTodos = Array.from(groupedTodos[dayNumber]);
        // in the new order
        console.log(reorderedTodos);
        const [removed] = reorderedTodos.splice(result.source.index, 1);
        console.log(removed);
        reorderedTodos.splice(result.destination.index, 0, removed);
        console.log(reorderedTodos);

        // Update the state with the reordered todos
        const newTodos = todos.map((todo, index) => {
            if (index < reorderedTodos.length) {
                return reorderedTodos[index];
            }
            return todo;
        });

        console.log(newTodos);
        setTodos(newTodos);
    };

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

    return (
        <>
            {sortedDayNumbers.map((dayNumber) => (
                <React.Fragment key={dayNumber}>
                    <div className="day">
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
                    </div>
                    <div key={dayNumber} className="todo-list">
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable
                                key={dayNumber}
                                droppableId={String(dayNumber)}
                            >
                                {(provided) => (
                                    <ul
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                    >
                                        {groupedTodos[dayNumber].map(
                                            (todo, index) => (
                                                <Draggable
                                                    key={todo.id}
                                                    draggableId={String(
                                                        todo.id
                                                    )}
                                                    index={index}
                                                >
                                                    {(provided) => (
                                                        <li
                                                            ref={
                                                                provided.innerRef
                                                            }
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <p>{todo.title}</p>
                                                            <section>
                                                                {Array.from({
                                                                    length: todo.goal,
                                                                }).map(
                                                                    (
                                                                        _,
                                                                        idx
                                                                    ) => (
                                                                        <input
                                                                            key={
                                                                                idx
                                                                            }
                                                                            type="checkbox"
                                                                            checked={
                                                                                idx <
                                                                                todo.status
                                                                            }
                                                                            onChange={() =>
                                                                                handleQuantityChange(
                                                                                    todo,
                                                                                    idx
                                                                                )
                                                                            }
                                                                        />
                                                                    )
                                                                )}
                                                            </section>
                                                        </li>
                                                    )}
                                                </Draggable>
                                            )
                                        )}
                                        {provided.placeholder}
                                    </ul>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                </React.Fragment>
            ))}
        </>
    );
}

export default TodoList;
