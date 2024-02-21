import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
const app = express();
const port = process.env.PORT || 3001;
const TASK_FILE_PATH = path.join(__dirname, 'public', 'tasks.json');

interface Task {
  id: string;
  date: string;
  title: string;
  completed: boolean;
}

interface TaskData {
  tasks: Task[];
}

app.use(express.json());
app.use(cors());

const readTasksFromFile = (): Task[] => {
  try {
    const fileContent = fs.readFileSync(TASK_FILE_PATH, 'utf-8');
    const data: TaskData = JSON.parse(fileContent);
    return data.tasks || [];
  } catch (error) {
    console.error('Error reading tasks from file:', error);
    return [];
  }
};

const writeTasksToFile = (tasks: Task[]): void => {
  try {
    const data: TaskData = { tasks };
    fs.writeFileSync(TASK_FILE_PATH, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing tasks to file:', error);
  }
};

app.get('/task/:date', (req, res) => {
  try {
    const { date } = req.params;
    const tasks = readTasksFromFile().filter(task => task.date === date);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/task', (req, res) => {
  try {
    const tasks = readTasksFromFile();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/task', (req, res) => {
  const newTaskData = req.body;

  try {
    const tasks = readTasksFromFile();
    const newTask: Task = { ...newTaskData, id: uuidv4() };
    tasks.push(newTask);
    writeTasksToFile(tasks);
    
    res.status(201).json({ message: 'Task added successfully', task: newTask });
  } catch (error) {
    console.error('Error saving task:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.delete('/task/:id', (req, res) => {
  const taskId = req.params.id;

  try {
    let tasks = readTasksFromFile();
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    writeTasksToFile(updatedTasks);
    
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.patch('/task/:id', (req, res) => {
  const taskId = req.params.id;
  const updatedTaskData = req.body;

  try {
    let tasks = readTasksFromFile();
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, ...updatedTaskData };
      }
      return task;
    });
    writeTasksToFile(updatedTasks);
    
    res.status(200).json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).send('Internal Server Error');
  }
});

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

