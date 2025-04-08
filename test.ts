// File: App.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import './App.css';

interface Task {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

const mock = new AxiosMockAdapter(axios, { delayResponse: 500 });

// Mock upload endpoint
mock.onPost('/upload').reply(config => {
  const taskId = Math.random().toString(36).substr(2, 9);
  simulateTask(taskId);
  return [200, { taskId }];
});

const taskStatus: Record<string, 'pending' | 'completed' | 'failed'> = {};

const simulateTask = (taskId: string) => {
  taskStatus[taskId] = 'pending';
  setTimeout(() => {
    taskStatus[taskId] = Math.random() > 0.2 ? 'completed' : 'failed';
  }, 5000 + Math.random() * 5000);
};

mock.onGet(/\/status\/\w+/).reply(config => {
  const taskId = config.url!.split('/').pop()!;
  const status = taskStatus[taskId] || 'pending';
  return [200, { status }];
});

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const pollingRefs = useRef<Record<string, any>>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !(file.type.includes('pdf') || file.type.includes('image')) || file.size > 2 * 1024 * 1024) {
      alert('Only PDFs or images under 2MB are allowed');
      return;
    }

    const res = await axios.post('/upload');
    const newTask: Task = { id: res.data.taskId, status: 'pending' };
    setTasks(prev => [...prev, newTask]);
    pollStatus(newTask.id);
  };

  const pollStatus = (taskId: string, retries = 3) => {
    pollingRefs.current[taskId] = setInterval(async () => {
      try {
        const res = await axios.get(`/status/${taskId}`);
        setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: res.data.status } : task));

        if (res.data.status !== 'pending') {
          clearInterval(pollingRefs.current[taskId]);
        }
      } catch {
        if (retries > 0) {
          pollStatus(taskId, retries - 1);
        } else {
          setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: 'failed' } : task));
          clearInterval(pollingRefs.current[taskId]);
        }
      }
    }, 2000);
  };

  const cancelTask = (taskId: string) => {
    clearInterval(pollingRefs.current[taskId]);
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: 'cancelled' } : task));
  };

  useEffect(() => {
    return () => {
      Object.values(pollingRefs.current).forEach(clearInterval);
    };
  }, []);

  return (
    <div className="app">
      <h1>File Upload & Status Polling</h1>
      <input type="file" onChange={handleFileUpload} />
      <ul>
        {tasks.map(task => (
          <li key={task.id}>
            Task {task.id}: {task.status}
            {task.status === 'pending' && <button onClick={() => cancelTask(task.id)}>Cancel</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
