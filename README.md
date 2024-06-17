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
