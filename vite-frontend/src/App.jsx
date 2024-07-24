import React, { useEffect, useContext, useState, useCallback } from "react";
import { AuthContext } from "./context/AuthProvider";
import { AppStateContext } from "./context/AppStateContext";
import { golangAxios, pythonAxios, pythonBackendUrl } from "./axiosConfig";
import AddTodo from "./components/AddTodo";
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
        setIsUpdateMode,
        setCurrentTodo,
        view,
        setView,
    } = useContext(AppStateContext);

    const [finalizedMap, setFinalizedMap] = useState({});

    const fetchDailyMessage = useCallback(
        (newDayNumber) => {
            if (!user) return;
            const eventSource = new EventSource(
                `${pythonBackendUrl}/api/daily-message?user_id=${user.id}&new_day_number=${newDayNumber}`,
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
        },
        [user, setDailyMessage]
    );

    useEffect(() => {
        if (!user) return;
        golangAxios
            .get("/api/todos")
            .then((response) => {
                setTodos(response.data.todos);
                setFinalizedMap(response.data.finalized_map); // Set the finalized map
                if (response.data.new_finalized_day) {
                    console.log("new finalized day!");
                } else {
                    console.log("not a new finalized day :(");
                }
                fetchDailyMessage(response.data.highest_finalized_day);
            })
            .catch((error) => console.error(error));
    }, [user, setTodos, setDailyMessage, fetchDailyMessage]);

    const handleEditTodo = (todo) => {
        setCurrentTodo(todo);
        setIsUpdateMode(true);
    };

    const handleCancelUpdate = () => {
        setIsUpdateMode(false);
        setCurrentTodo(null);
    };

    const finalizeDay = (dayNumber) => {
        golangAxios
            .post(`/api/finalize-day`, {
                day_number: dayNumber,
            })
            .then((response) => {
                setFinalizedMap((prevMap) => ({
                    ...prevMap,
                    [dayNumber]: true,
                }));
                setDailyMessage(""); // Clear the daily message
                fetchDailyMessage(dayNumber); // Fetch a new daily message
            })
            .catch((error) => console.error("Error finalizing day:", error));
    };

    const renderAddUpdateTodoView = () => {
        if (user) {
            if (view === "todos") {
                return <AddTodo setTodos={setTodos} />;
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
                            finalizedMap={finalizedMap} // Pass the finalized map
                            finalizeDay={finalizeDay} // Pass the finalizeDay function
                            handleCancelUpdate={handleCancelUpdate}
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
            <div className="header-container w-full max-w-[540px] mx-auto">
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
            <div className="main-container w-[1300px] mx-auto grid grid-cols-[1fr_20px_540px_20px_1fr] grid-rows-auto gap-x-0 gap-y-[45px]">
                {renderMainView()}
            </div>
        </>
    );
}

export default App;
