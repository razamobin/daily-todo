import React, { useEffect, useContext } from "react";
import { AuthContext } from "./context/AuthProvider";
import { AppStateContext } from "./context/AppStateContext";
import axios from "./axiosConfig";
import AddTodo from "./components/AddTodo";
import UpdateTodo from "./components/UpdateTodo";
import TodoList from "./components/TodoList";
import ReactMarkdown from "react-markdown";
import rehypeReact from "rehype-react";
import remarkGfm from "remark-gfm"; // Optional: for GitHub flavored markdown
import remarkBreaks from "remark-breaks"; // Plugin to convert newlines to <br>
import AuthForm from "./components/AuthForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";

function App() {
    const { user, logout } = useContext(AuthContext);
    const {
        todos,
        setTodos,
        dailyMessage,
        setDailyMessage,
        isUpdateMode,
        setIsUpdateMode,
        currentTodo,
        setCurrentTodo,
    } = useContext(AppStateContext);

    useEffect(() => {
        if (!user) return;
        const fetchDailyMessage = (newDayNumber) => {
            if (!user) return;
            const eventSource = new EventSource(
                `http://localhost:5001/api/daily-message?user_id=${user.id}&new_day_number=${newDayNumber}`,
                { withCredentials: true }
            );

            eventSource.onmessage = (event) => {
                const unescapedMessage = event.data.replace(/\\n/g, "\n");
                setDailyMessage(
                    (prevMessage) => prevMessage + unescapedMessage
                );
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
    }, [user, setTodos, setDailyMessage]);

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
            <div className="header-container">
                <header className="header flex justify-between items-center border-b-2 border-current pb-1">
                    <h1 className="text-3xl">
                        daily <span>todos</span>
                    </h1>
                    {user && (
                        <div className="user-controls flex items-center">
                            <p className="">
                                hello,{" "}
                                <span className="font-bold">
                                    {user.username}
                                </span>
                            </p>
                            <FontAwesomeIcon
                                icon={faCircle}
                                className="mx-2 text-[6px]"
                            />{" "}
                            {/* Font Awesome icon */}
                            <button
                                onClick={logout}
                                className="btn-logout underline"
                            >
                                logout
                            </button>
                        </div>
                    )}
                </header>
                {user ? (
                    <>
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
                    </>
                ) : (
                    <AuthForm />
                )}
            </div>
            <div className="main-container">
                {user ? (
                    <>
                        {dailyMessage && (
                            <div className="daily-message">
                                <ReactMarkdown
                                    children={dailyMessage}
                                    remarkPlugins={[remarkGfm, remarkBreaks]} // Optional: for GitHub flavored markdown
                                    rehypePlugins={[
                                        [
                                            rehypeReact,
                                            {
                                                createElement:
                                                    React.createElement,
                                            },
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
                    </>
                ) : (
                    <></>
                )}
            </div>
        </>
    );
}

export default App;
