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

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const groupedTodos = todos.reduce((acc, todo) => {
    const date = formatDate(todo.date);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(todo);
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {Object.keys(groupedTodos).map(date => (
        <div key={date} style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
          <h2>{date}</h2>
          {groupedTodos[date].map(todo => (
            <div key={todo.id} style={{ marginBottom: '10px' }}>
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
      ))}
    </div>
  );
}

export default TodoList;

