import React, { useEffect, useContext, useState, useCallback } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { AuthContext } from "./context/AuthProvider";
import { AppStateContext } from "./context/AppStateContext";
import { golangAxios, pythonBackendUrl } from "./axiosConfig";
import AddTodo from "./components/AddTodo";
import TodoList from "./components/TodoList";
import Markdown from "react-markdown";
import AuthForm from "./components/AuthForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import ProfilePage from "./components/ProfilePage";
import HealthCheck from "./components/HealthCheck";

function AppContent() {
    const { user, logout, login, portfolioLogin } = useContext(AuthContext);
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
    const { routeView } = useParams();
    const [finalizedMap, setFinalizedMap] = useState({});

    const isPortfolioView = routeView === "skool";

    useEffect(() => {
        if (isPortfolioView && !user) {
            // Automatically log in to a special account
            golangAxios
                .post("/api/portfolio-login")
                .then((response) => {
                    portfolioLogin(response.data);
                })
                .catch((error) =>
                    console.error("Error logging in portfolio viewer:", error)
                );
        }
    }, [isPortfolioView, user, portfolioLogin]);

    const fetchDailyMessage = useCallback(
        (newDayNumber) => {
            if (!user) return;
            const eventSource = new EventSource(
                `${pythonBackendUrl}/api/daily-message?user_id=${user.id}&new_day_number=${newDayNumber}`,
                { withCredentials: true }
            );

            const cleanMarkdownStart = (message) => {
                return message.replace(/^```markdown\s*/, "");
            };

            eventSource.onmessage = (event) => {
                const unescapedMessage = event.data.replace(/\\n/g, "\n");
                setDailyMessage((prevMessage) => {
                    const combinedMessage = prevMessage + unescapedMessage;
                    return cleanMarkdownStart(combinedMessage);
                });
            };

            eventSource.addEventListener("end", function (event) {
                console.log("Stream ended");
                setDailyMessage((prevMessage) =>
                    prevMessage.replace(/\s*```$/, "")
                );
                eventSource.close();
            });

            eventSource.onerror = (error) => {
                console.error("Error fetching daily message:", error);
                eventSource.close();
            };
        },
        [user, setDailyMessage, pythonBackendUrl]
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

    const toggleView = () => {
        setView((prevView) => (prevView === "todos" ? "profile" : "todos"));
    };

    const handleLogout = () => {
        logout(isPortfolioView);
    };

    return (
        <>
            <div className="header-container w-full max-w-[540px] mx-auto">
                {isPortfolioView && (
                    <div className="portfolio-info bg-blue-100 p-4 mb-4 rounded">
                        <h2 className="text-xl font-bold mb-2">
                            Welcome to my Daily Todo App!
                        </h2>
                        <p>
                            This app showcases my skills in React, Go, and
                            Python. It features real-time updates, user
                            authentication, and integration with AI for daily
                            messages.
                        </p>
                    </div>
                )}
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
                                onClick={handleLogout}
                                className="btn-logout hover:underline"
                            >
                                logout
                            </button>
                        </div>
                    )}
                </header>
                {user && view === "todos" && <AddTodo setTodos={setTodos} />}
                {!user && <AuthForm />}
            </div>
            <div className="main-container w-[1300px] mx-auto grid grid-cols-[1fr_20px_540px_20px_1fr] grid-rows-auto gap-x-0 gap-y-[45px]">
                {user && view === "todos" && (
                    <>
                        {dailyMessage && (
                            <div className="daily-message col-start-5 col-end-6 row-start-1 row-span-10 text-sm">
                                <Markdown>{dailyMessage}</Markdown>
                            </div>
                        )}
                        <TodoList
                            todos={todos}
                            setTodos={setTodos}
                            onEditTodo={handleEditTodo}
                            finalizedMap={finalizedMap}
                            finalizeDay={finalizeDay}
                            handleCancelUpdate={handleCancelUpdate}
                        />
                    </>
                )}
                {user && view === "profile" && <ProfilePage />}
            </div>
        </>
    );
}

function App() {
    return (
        <Routes>
            <Route path="/health" element={<HealthCheck />} />
            <Route path="/:routeView?/*" element={<AppContent />} />
        </Routes>
    );
}

export default App;
