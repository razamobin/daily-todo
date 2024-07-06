import React, { useEffect, useContext, useState } from "react";
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
import ProfilePage from "./components/ProfilePage";

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
    const [view, setView] = useState("todos");

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

    const renderAddUpdateTodoView = () => {
        if (user) {
            if (view === "todos") {
                if (isUpdateMode) {
                    return (
                        <UpdateTodo
                            key={currentTodo ? currentTodo.id : "new"}
                            todo={currentTodo}
                            setTodos={setTodos}
                            onCancel={handleCancelUpdate}
                        />
                    );
                } else {
                    return <AddTodo setTodos={setTodos} />;
                }
            }
        } else {
            return <AuthForm />;
        }
    };

    const renderMainView = () => {
        if (user) {
            if (view === "todos") {
                return (
                    <>
                        {dailyMessage && (
                            <div className="daily-message col-start-5 col-end-6 row-start-1 row-span-10 text-sm">
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
                );
            } else if (view === "profile") {
                return <ProfilePage />;
            }
        } else {
            return <></>;
        }
    };

    const toggleView = () => {
        setView((prevView) => (prevView === "todos" ? "profile" : "todos"));
    };

    return (
        <>
            <div className="header-container w-full max-w-[600px] mx-auto">
                <header className="header flex justify-between items-center border-b-2 border-current pb-1">
                    <h1 className="text-3xl">
                        daily <span>todos</span>
                    </h1>
                    {user && (
                        <div className="user-controls flex items-center">
                            <p className="">
                                hello,{" "}
                                <button
                                    onClick={toggleView}
                                    className="font-bold hover:underline"
                                >
                                    {user.username}
                                </button>
                            </p>
                            <FontAwesomeIcon
                                icon={faCircle}
                                className="mx-2 text-[6px]"
                            />{" "}
                            {/* Font Awesome icon */}
                            <button
                                onClick={logout}
                                className="btn-logout hover:underline"
                            >
                                logout
                            </button>
                        </div>
                    )}
                </header>
                {renderAddUpdateTodoView()}
            </div>
            <div className="main-container w-[1300px] mx-auto grid grid-cols-[1fr_20px_600px_20px_1fr] grid-rows-auto gap-x-0 gap-y-[45px]">
                {renderMainView()}
            </div>
        </>
    );
}

export default App;
