# daily-todo

docker-compose up --build

docker exec -it mysql mysql -u user -p

curl -X GET http://localhost:8080/api/todos

curl -X POST http://localhost:8080/api/todos \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Example Task",
        "type": "yes_no",
        "status": 1
    }'

curl -X PUT http://localhost:8080/api/todos/1 \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Updated Task",
        "type": "yes_no",
        "status": 1
    }'

curl -X GET http://localhost:5001

steps
1. create your user in users table
2. create .env with OPENAI_API_KEY='<your openai api key>' and ASSISTANT_ID='<your assistant ai>'
3. go to python-backend to see how to create the assistant above and get the assistant id
