# daily-todo

1. clone the repo: git clone https://github.com/razamobin/daily-todo.git
2. create your .env at the root of the project with your openai api key: OPENAI_API_KEY='sk-my-project-123'
3. run docker-compose up --build to build and start the app
4. hit create assistant w curl / wget
- curl -X POST http://localhost:5001/api/create-assistant
5. create a new user, since there are no accounts yet
6. you can add todos for today. it's all you can do i think on blank state
7. check off todos as you do them
8. come tomorrow - new set of todos are copied from previous day and ready to be checked off
9. since yesterday is done, AI will come up with an encouraging message for you!
10. repeat forever and do the most important things every day for the rest of your life :D

docker-compose up --build

docker exec -it mysql mysql -u user -p

## project layout
1. frontend (react app)
2. golang-backend (backend for db and session biz logic)
3. python-backend (backend for AI API calls logic)
4. mysql
5. flyway for sql migrations
