import React from 'react';
import axios from 'axios';

function TodoList({ todos, setTodos }) {
  const handleCheckboxChange = (todo, checked) => {
    const updatedTodo = { ...todo, status: checked ? 1 : 0 };
    axios.put(`http://localhost:8080/api/todos/${todo.id}`, updatedTodo)
      .then(() => {
        setTodos(prevTodos => prevTodos.map(t => t.id === todo.id ? updatedTodo : t));
      })
      .catch(error => console.error(error));
  };

  const handleQuantityChange = (todo, count) => {
    const updatedTodo = { ...todo, status: count };
    axios.put(`http://localhost:8080/api/todos/${todo.id}`, updatedTodo)
      .then(() => {
        setTodos(prevTodos => prevTodos.map(t => t.id === todo.id ? updatedTodo : t));
      })
      .catch(error => console.error(error));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {todos.map(todo => (
        <div key={todo.id} style={{ marginBottom: '20px' }}>
          <h3>{todo.title}</h3>
          {todo.type === 'yes_no' ? (
            <input
              type="checkbox"
              checked={todo.status === 1}
              onChange={(e) => handleCheckboxChange(todo, e.target.checked)}
            />
          ) : (
            <div>
              {Array.from({ length: todo.goal }).map((_, index) => (
                <input
                  key={index}
                  type="checkbox"
                  checked={index < todo.status}
                  onChange={() => handleQuantityChange(todo, index + 1)}
                  style={{ marginRight: '5px' }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default TodoList;


