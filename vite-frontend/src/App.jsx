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
import {
    faCircle,
    faMinus,
    faPlus,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons";
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
    const [initialCheckDone, setInitialCheckDone] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPortfolioInfoExpanded, setIsPortfolioInfoExpanded] =
        useState(true);
    const [isDailyMessageLoading, setIsDailyMessageLoading] = useState(false);

    const isPortfolioView = routeView === "skool";

    useEffect(() => {
        if (initialCheckDone) return;

        setIsLoading(true);
        golangAxios
            .get("/api/logged-in-user")
            .then((response) => {
                if (response.data.loggedIn) {
                    // User is logged in, do nothing
                } else if (isPortfolioView) {
                    // User is not logged in and it's a portfolio view
                    return golangAxios.post("/api/portfolio-login");
                }
                return null;
            })
            .then((response) => {
                if (response) {
                    portfolioLogin(response.data);
                }
            })
            .catch((error) => {
                console.error("Error checking login status:", error);
            })
            .finally(() => {
                setInitialCheckDone(true);
                setIsLoading(false);
            });
    }, [initialCheckDone, isPortfolioView, portfolioLogin, golangAxios]);

    const fetchDailyMessage = useCallback(
        (newDayNumber) => {
            if (!user) return;
            setIsDailyMessageLoading(true);
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
                setIsDailyMessageLoading(false); // Set loading to false after receiving the first message
            };

            eventSource.addEventListener("end", function (event) {
                console.log("Stream ended");
                setDailyMessage((prevMessage) =>
                    prevMessage.replace(/\s*```$/, "")
                );
                setIsDailyMessageLoading(false);
                eventSource.close();
            });

            eventSource.onerror = (error) => {
                console.error("Error fetching daily message:", error);
                setIsDailyMessageLoading(false);
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

    if (isLoading) {
        return <></>;
    }

    return (
        <>
            <div className="header-container w-full max-w-[540px] mx-auto">
                {isPortfolioView && (
                    <div className="portfolio-info bg-blue-100 p-6 mb-4 mt-4 rounded">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">
                                Hi Skool, my name is Raza!
                            </h2>
                            <button
                                onClick={() =>
                                    setIsPortfolioInfoExpanded(
                                        !isPortfolioInfoExpanded
                                    )
                                }
                                className="text-blue-600 hover:text-blue-800"
                                aria-label={
                                    isPortfolioInfoExpanded
                                        ? "Collapse"
                                        : "Expand"
                                }
                            >
                                <FontAwesomeIcon
                                    icon={
                                        isPortfolioInfoExpanded
                                            ? faMinus
                                            : faPlus
                                    }
                                />
                            </button>
                        </div>
                        {isPortfolioInfoExpanded && (
                            <>
                                <p className="mt-4">
                                    I built this <strong>daily todo app</strong>
                                    , with AI encouragement, as a way to learn
                                    React, Golang, and the OpenAI Assistants
                                    API. I ended up deploying it to prod using
                                    AWS, so I learned that too :D
                                </p>
                                <p className="mt-4">
                                    I've logged you into a demo account and
                                    filled in some relevant data. Let me know
                                    how you like it!
                                </p>
                                <p className="mt-4">
                                    You can add your own todos, check them off,
                                    and you can click any todo to add more
                                    details &mdash; like a daily journal. You
                                    can finalize the day once you're done, and
                                    the AI will generate an encouraging message
                                    for you.
                                </p>
                                <p className="mt-4">
                                    I use the app daily to make sure I stay on
                                    top of my daily health routines as well as
                                    my daily coding routine. I would love to
                                    talk more about Skool and the backend
                                    engineering position you have available. You
                                    can reach me via:
                                </p>
                                <ul className="mt-4 list-disc list-inside">
                                    <li>
                                        Email:{" "}
                                        <a
                                            href="mailto:raza.mobin@gmail.com"
                                            className="text-blue-600 hover:underline"
                                        >
                                            raza.mobin@gmail.com
                                        </a>
                                    </li>
                                    <li>
                                        LinkedIn:{" "}
                                        <a
                                            href="https://www.linkedin.com/in/razamobin"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            linkedin.com/in/razamobin
                                        </a>
                                    </li>
                                    <li>
                                        GitHub:{" "}
                                        <a
                                            href="https://github.com/razamobin/daily-todo"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            github.com/razamobin/daily-todo
                                        </a>
                                    </li>
                                    <li>
                                        Piano IG:{" "}
                                        <a
                                            href="https://www.instagram.com/p/B6_DES1H5tQ"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            instagram.com/p/B6_DES1H5tQ
                                        </a>
                                    </li>
                                </ul>
                                <p className="mt-4">Talk soon!</p>
                                <p>Raza</p>
                            </>
                        )}
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
                {!user && !isLoading && <AuthForm />}
            </div>
            <div className="main-container w-[1300px] mx-auto grid grid-cols-[1fr_20px_540px_20px_1fr] grid-rows-auto gap-x-0 gap-y-[45px]">
                {user && view === "todos" && (
                    <>
                        {isDailyMessageLoading ? (
                            <div className="daily-message-loading col-start-5 col-end-6 row-start-1 row-span-10 text-sm">
                                <FontAwesomeIcon icon={faSpinner} spin />{" "}
                                Loading daily message...
                            </div>
                        ) : dailyMessage ? (
                            <div className="daily-message col-start-5 col-end-6 row-start-1 row-span-10 text-sm">
                                <Markdown>{dailyMessage}</Markdown>
                            </div>
                        ) : null}
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
