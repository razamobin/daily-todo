import React, { useState, useEffect } from "react";
import axios from "axios";
import AddTodo from "./components/AddTodo";
import UpdateTodo from "./components/UpdateTodo";
import TodoList from "./components/TodoList";
import ReactMarkdown from "react-markdown";
import rehypeReact from "rehype-react";
import remarkGfm from "remark-gfm"; // Optional: for GitHub flavored markdown
import remarkBreaks from "remark-breaks"; // Plugin to convert newlines to <br>
// import NumberList from "./NumberList";

function App() {
    const [todos, setTodos] = useState([]);
    const [dailyMessage, setDailyMessage] = useState("");
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [currentTodo, setCurrentTodo] = useState(null);

    useEffect(() => {
        axios
            .get("http://localhost:8080/api/todos")
            .then((response) => {
                setTodos(response.data.todos);
                if (response.data.new_day) {
                    console.log("new day!");
                }
                fetchDailyMessage(response.data.new_day_number);
            })
            .catch((error) => console.error(error));
    }, []);

    const fetchDailyMessage = (newDayNumber) => {
        const eventSource = new EventSource(
            `http://localhost:5001/api/daily-message?user_id=1&new_day_number=${newDayNumber}`
        );
        /*
        const eventSource = new EventSource(
            "http://localhost:5001/api/stream-test"
        );
        */

        eventSource.onmessage = (event) => {
            const unescapedMessage = event.data.replace(/\\n/g, "\n");
            setDailyMessage((prevMessage) => prevMessage + unescapedMessage);
        };

        eventSource.addEventListener("end", function (event) {
            console.log("Stream ended");
            eventSource.close();
        });

        eventSource.onerror = (error) => {
            console.error("Error fetching daily message:", error);
            eventSource.close();
        };
    };

    const handleEditTodo = (todo) => {
        setCurrentTodo(todo);
        setIsUpdateMode(true);
    };

    const handleCancelUpdate = () => {
        setIsUpdateMode(false);
        setCurrentTodo(null);
    };

    return (
        <>
            {/* <NumberList /> */}
            <div className="header-container">
                <header>
                    <h1>
                        daily <span>todos</span>
                    </h1>
                </header>
                {isUpdateMode ? (
                    <UpdateTodo
                        key={currentTodo ? currentTodo.id : "new"}
                        todo={currentTodo}
                        setTodos={setTodos}
                        onCancel={handleCancelUpdate}
                    />
                ) : (
                    <AddTodo setTodos={setTodos} />
                )}
            </div>
            <div className="main-container">
                {dailyMessage && (
                    <div className="daily-message">
                        <ReactMarkdown
                            children={dailyMessage}
                            remarkPlugins={[remarkGfm, remarkBreaks]} // Optional: for GitHub flavored markdown
                            rehypePlugins={[
                                [
                                    rehypeReact,
                                    { createElement: React.createElement },
                                ],
                            ]}
                        />
                    </div>
                )}
                <TodoList
                    todos={todos}
                    setTodos={setTodos}
                    onEditTodo={handleEditTodo}
                />
            </div>
        </>
    );
}

export default App;
