# daily-todo

![App Screenshot](assets/images/screen3.png)

1. Clone the repo:

    ```
    git clone https://github.com/razamobin/daily-todo.git
    ```

2. Create your .env at the root of the project with the following environment variables:

    - OPENAI_API_KEY='sk-my-project-123'
    - BEARER_TOKEN: a shared secret between the golang and python backends
    - (Add any other required environment variables here)

    Use .env.example as a reference.

3. Run Docker Compose to build and start the app:

    ```
    docker compose up --build
    ```

4. Create the AI assistant with curl:

    ```
    curl -X POST http://localhost:5001/api/create-assistant
    ```

5. create a new user by signing up on the frontend http://localhost:3000
6. you can add todos for today
7. check off todos as you do them
8. come tomorrow - new set of todos are copied from previous day and ready to be checked off
9. you can finalize any day, and whenever a day is finalized, the AI will be called to come up with an encouraging message for you! (gotta be patient though, AI takes its time)
10. repeat forever and do the most important things every day for the rest of your life :D (and don't get distracted by social media and AI driven distractions)

To access MySQL:

```
docker exec -it mysql mysql -u user -p
```

## project layout

1. vite-frontend (react app build with vite)
2. golang-backend (for db and session biz logic)
3. python-backend (for AI API calls logic)
4. mysql
5. flyway for sql migrations
6. redis for session storage
