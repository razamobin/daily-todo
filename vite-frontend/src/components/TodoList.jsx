import React from "react";
import { golangAxios } from "../axiosConfig";
import UpdateTodo from "./UpdateTodo";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AppStateContext } from "../context/AppStateContext";
import { useContext } from "react";

function TodoList({
    todos,
    setTodos,
    onEditTodo,
    finalizedMap,
    finalizeDay,
    handleCancelUpdate,
}) {
    const { isUpdateMode, currentTodo } = useContext(AppStateContext);

    const handleQuantityChange = (todo, index) => {
        if (finalizedMap[todo.day_number]) return; // Prevent changes if the day is finalized
        let newStatus;
        if (index < todo.status) {
            newStatus = index;
        } else {
            newStatus = index + 1;
        }
        const updatedTodo = { ...todo, status: newStatus };
        golangAxios
            .put(`/api/todos/${todo.id}`, updatedTodo)
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

        const dayNumber = parseInt(result.source.droppableId, 10);
        const reorderedTodos = Array.from(groupedTodos[dayNumber]);

        // Remove the dragged item from the source list
        const [movedTodo] = reorderedTodos.splice(result.source.index, 1);

        // Insert it back in the new position
        reorderedTodos.splice(result.destination.index, 0, movedTodo);

        // Update the grouped todos for the day
        groupedTodos[dayNumber] = reorderedTodos;

        // Flatten the grouped todos back into a single array
        const newTodos = Object.keys(groupedTodos).reduce((acc, day) => {
            return acc.concat(groupedTodos[day]);
        }, []);

        setTodos(newTodos);

        // Create the JSON object mapping todo id to new sort index for each day
        const sortIndexMap = {};
        Object.keys(groupedTodos).forEach((day) => {
            groupedTodos[day].forEach((todo, index) => {
                sortIndexMap[todo.id] = index;
            });
        });

        // Save the new order to the backend
        golangAxios
            .post("/api/update-sort-indexes", sortIndexMap)
            .then((response) => console.log("Order saved:", response))
            .catch((error) => console.error("Error saving order:", error));
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

    const formatSpecialDate = (dayNumber) => {
        const referenceDate = new Date("2024-06-16");
        referenceDate.setDate(referenceDate.getDate() + dayNumber);
        const options = {
            month: "long", // Full month name
            day: "numeric",
        };
        const [month, day] = referenceDate
            .toLocaleDateString("en-US", options)
            .replace(/,/g, "")
            .split(" ");
        const dayWithSuffix = `${day}${getOrdinalSuffix(parseInt(day, 10))}`;
        return `${month} ${dayWithSuffix}`;
    };

    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return "th"; // Covers 11th to 20th
        switch (day % 10) {
            case 1:
                return "st";
            case 2:
                return "nd";
            case 3:
                return "rd";
            default:
                return "th";
        }
    };

    const sortedDayNumbers = Object.keys(groupedTodos)
        .map(Number)
        .sort((a, b) => b - a); // Sort day numbers in descending order

    const handleTodoClick = (todo) => {
        if (isUpdateMode && currentTodo && currentTodo.id === todo.id) {
            handleCancelUpdate();
        } else {
            onEditTodo(todo);
        }
    };

    return (
        <>
            {sortedDayNumbers.map((dayNumber, index) => (
                <React.Fragment key={dayNumber}>
                    <div className="day col-start-1 col-end-2 justify-self-end text-lg">
                        <div className="flex items-center mb-5 leading-none">
                            <span className="day-of-week text-xs mr-1.5">
                                {formatDayNumber(dayNumber).weekday}
                            </span>
                            <div className="date-details text-right">
                                <div className="day-of-month text-5xl">
                                    {formatDayNumber(dayNumber).day}
                                </div>
                                <div className="month text-sm">
                                    {formatDayNumber(dayNumber).month}
                                </div>
                                <div className="year text-sm">
                                    {formatDayNumber(dayNumber).year}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        key={dayNumber}
                        className="todo-list col-start-3 col-end-4"
                    >
                        {index === 0 ? (
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable
                                    key={dayNumber}
                                    droppableId={String(dayNumber)}
                                >
                                    {(provided) => (
                                        <ul
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="p-0 m-0 border-t border-gray-200"
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
                                                                className={`group grid grid-cols-1 gap-2 px-1 py-0.5 border-b border-gray-200 hover:bg-gray-100 ${
                                                                    isUpdateMode &&
                                                                    currentTodo &&
                                                                    currentTodo.id ===
                                                                        todo.id
                                                                        ? "bg-gray-100 rounded"
                                                                        : ""
                                                                }`}
                                                            >
                                                                <div className="flex items-center">
                                                                    <div className="flex-1 text-xs mr-2 pl-1 font-normal">
                                                                        <span
                                                                            className={`todo-title cursor-pointer hover:underline ${
                                                                                isUpdateMode &&
                                                                                currentTodo &&
                                                                                currentTodo.id ===
                                                                                    todo.id
                                                                                    ? "font-bold edit-mode"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                handleTodoClick(
                                                                                    todo
                                                                                )
                                                                            }
                                                                        >
                                                                            {
                                                                                todo.title
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <section className="flex">
                                                                        {Array.from(
                                                                            {
                                                                                length: todo.goal,
                                                                            }
                                                                        ).map(
                                                                            (
                                                                                _,
                                                                                idx
                                                                            ) => (
                                                                                <label
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    className={`p-2 flex items-center justify-center ${
                                                                                        finalizedMap[
                                                                                            todo
                                                                                                .day_number
                                                                                        ]
                                                                                            ? "cursor-default"
                                                                                            : "cursor-pointer"
                                                                                    }`}
                                                                                >
                                                                                    <input
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
                                                                                        className={`transform scale-100 ${
                                                                                            finalizedMap[
                                                                                                todo
                                                                                                    .day_number
                                                                                            ]
                                                                                                ? "cursor-default"
                                                                                                : "cursor-pointer"
                                                                                        }`}
                                                                                        disabled={
                                                                                            finalizedMap[
                                                                                                todo
                                                                                                    .day_number
                                                                                            ]
                                                                                        }
                                                                                    />
                                                                                </label>
                                                                            )
                                                                        )}
                                                                    </section>
                                                                </div>
                                                                {isUpdateMode &&
                                                                    currentTodo &&
                                                                    currentTodo.id ===
                                                                        todo.id && (
                                                                        <UpdateTodo
                                                                            key={
                                                                                currentTodo.id
                                                                            }
                                                                            todo={
                                                                                currentTodo
                                                                            }
                                                                            setTodos={
                                                                                setTodos
                                                                            }
                                                                            onCancel={
                                                                                handleCancelUpdate
                                                                            }
                                                                            isFinalized={
                                                                                finalizedMap[
                                                                                    currentTodo
                                                                                        .day_number
                                                                                ]
                                                                            }
                                                                        />
                                                                    )}
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
                        ) : (
                            <ul className="p-0 m-0 border-t border-gray-200">
                                {groupedTodos[dayNumber].map((todo) => (
                                    <li
                                        key={todo.id}
                                        className={`grid grid-cols-1 gap-2 p-1 border-b border-gray-200 hover:bg-gray-100 ${
                                            isUpdateMode &&
                                            currentTodo &&
                                            currentTodo.id === todo.id
                                                ? "bg-gray-100 rounded"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-center">
                                            <div className="flex-1 text-xs mr-2 pl-1 font-normal group">
                                                <span
                                                    className={`todo-title cursor-pointer hover:underline ${
                                                        isUpdateMode &&
                                                        currentTodo &&
                                                        currentTodo.id ===
                                                            todo.id
                                                            ? "font-bold edit-mode"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        handleTodoClick(todo)
                                                    }
                                                >
                                                    {todo.title}
                                                </span>
                                            </div>
                                            <section className="flex">
                                                {Array.from({
                                                    length: todo.goal,
                                                }).map((_, idx) => (
                                                    <label
                                                        key={idx}
                                                        className={`p-2 flex items-center justify-center ${
                                                            finalizedMap[
                                                                todo.day_number
                                                            ]
                                                                ? "cursor-default"
                                                                : "cursor-pointer"
                                                        }`}
                                                    >
                                                        <input
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
                                                            className={`transform scale-100 ${
                                                                finalizedMap[
                                                                    todo
                                                                        .day_number
                                                                ]
                                                                    ? "cursor-default"
                                                                    : "cursor-pointer"
                                                            }`}
                                                            disabled={
                                                                finalizedMap[
                                                                    todo
                                                                        .day_number
                                                                ]
                                                            }
                                                        />
                                                    </label>
                                                ))}
                                            </section>
                                        </div>
                                        {isUpdateMode &&
                                            currentTodo &&
                                            currentTodo.id === todo.id && (
                                                <UpdateTodo
                                                    key={currentTodo.id}
                                                    todo={currentTodo}
                                                    setTodos={setTodos}
                                                    onCancel={
                                                        handleCancelUpdate
                                                    }
                                                    isFinalized={
                                                        finalizedMap[
                                                            currentTodo
                                                                .day_number
                                                        ]
                                                    }
                                                />
                                            )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!finalizedMap[dayNumber] && (
                            <div className="flex justify-end mt-2 mr-2">
                                <button
                                    onClick={() => finalizeDay(dayNumber)}
                                    className="bg-black text-white p-2 px-4 rounded cursor-pointer text-xs hover:bg-gray-800"
                                >
                                    Finalize {formatSpecialDate(dayNumber)}
                                </button>
                            </div>
                        )}
                    </div>
                </React.Fragment>
            ))}
        </>
    );
}

export default TodoList;
