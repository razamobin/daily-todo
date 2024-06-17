import React, { useState } from 'react';
import axios from 'axios';

function AddTodo({ setTodos }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('yes_no');
  const [goal, setGoal] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:8080/api/todos', { title, type, goal })
      .then(response => {
        setTodos(prevTodos => [...prevTodos, response.data]);
        setTitle('');
        setType('yes_no');
        setGoal(0);
      })
      .catch(error => console.error(error));
  };

  return (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <button onClick={() => document.getElementById('addTodoForm').style.display = 'block'} style={{ padding: '10px 20px', borderRadius: '5px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>Add Task</button>
      <form id="addTodoForm" onSubmit={handleSubmit} style={{ display: 'none', marginTop: '20px' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          style={{ padding: '10px', width: '80%', marginBottom: '10px' }}
        />
        <br />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '10px', width: '80%', marginBottom: '10px' }}>
          <option value="yes_no">Yes/No</option>
          <option value="quantity">Quantity</option>
        </select>
        <br />
        {type === 'quantity' && (
          <input
            type="number"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Goal"
            required
            style={{ padding: '10px', width: '80%', marginBottom: '10px' }}
          />
        )}
        <br />
        <button type="submit" style={{ padding: '10px 20px', borderRadius: '5px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>Add Todo</button>
      </form>
    </div>
  );
}

export default AddTodo;


