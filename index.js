const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c6qkm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create MongoDB client
const client = new MongoClient(uri, {
 serverApi: {
  version: ServerApiVersion.v1,
  strict: true,
  deprecationErrors: true,
 }
});

// Create an HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
 cors: {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE"]
 }
});

async function run() {
 try {
  await client.connect();
  const taskDB = client.db('taskDB');
  const tasks = taskDB.collection('tasks');
  const users = taskDB.collection('users');

  // Middleware to verify JWT
  const verifyToken = (req, res, next) => {
   if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
   }
   const token = req.headers.authorization.split(' ')[1];
   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
     return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
   });
  };

  // JWT Authentication API
  app.post('/jwt', async (req, res) => {
   const user = req.body;
   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1h'
   });
   res.send({ token });
  });

  // Users API
  app.post('/users', async (req, res) => {
   const user = req.body;
   const query = { email: user.email };
   const existingUser = await users.findOne(query);
   if (existingUser) {
    return res.send({ message: 'User already exists', insertedId: null });
   }
   const result = await users.insertOne(user);
   res.send(result);
  });

  // TASKS API

  // Create Task
  app.post('/tasks', async (req, res) => {
   const { title, description, category, taskAdder } = req.body;

   // Validation
   if (!title || title.length > 50) {
    return res.status(400).send({ message: "Title is required (max 50 characters)." });
   }
   if (description && description.length > 200) {
    return res.status(400).send({ message: "Description max length is 200 characters." });
   }
   const validCategories = ["To-Do", "In Progress", "Done"];
   if (!validCategories.includes(category)) {
    return res.status(400).send({ message: "Invalid category." });
   }

   const newTask = {
    title,
    description,
    timestamp: new Date(),
    category,
    taskAdder,
   };

   const result = await tasks.insertOne(newTask);
   io.emit("task_updated");
   res.send(result);
  });

  // Get User's Tasks
  app.get("/tasks/:email", verifyToken, async (req, res) => {
   const email = req.params.email;
   const query = { taskAdder: email };
   const result = await tasks.find(query).sort({ position: 1 }).toArray();
   res.send(result);
  });

  app.get('/tasks/:id', verifyToken, async (req, res) => {
   const id = req.params.id
   const query = { _id: new ObjectId(id) }
   const result = await tasks.findOne(query)
   res.send(result)
  })
  // Update Task (Move, Edit, Reorder)
  app.patch("/tasks/update-order", verifyToken, async (req, res) => {
   const { updatedTasks } = req.body;

   if (!Array.isArray(updatedTasks) || updatedTasks.length === 0) {
    return res.status(400).send({ message: "Invalid tasks data." });
   }

   const bulkOperations = updatedTasks.map((task) => ({
    updateOne: {
     filter: { _id: new ObjectId(task.id) },
     update: {
      $set: {
       timestamp: new Date(),
       category: task.category,
       position: task.position, // Update position for reordering
      },
     },
    },
   }));

   await tasks.bulkWrite(bulkOperations);

   io.emit("task_updated"); // Notify clients about updates
   res.send({ message: "Tasks updated successfully" });
  });

  app.patch('/tasks/:id', verifyToken, async (req, res) => {
   const id = req.params.id
   const query = { _id: new ObjectId(id) }
   const { title, description } = req.body;
   const updatedDoc =
    { $set: { title, description, timestamp: new Date(), } }
   const result = await tasks.updateOne(query, updatedDoc)
   res.send(result)
  })
  // Delete Task
  app.delete("/tasks/:id", verifyToken, async (req, res) => {
   const id = req.params.id;
   const result = await tasks.deleteOne({ _id: new ObjectId(id) });

   io.emit("task_updated");
   res.send(result);
  });

  // REAL-TIME UPDATES WITH CHANGE STREAMS
  const changeStream = tasks.watch();
  changeStream.on("change", () => {
   io.emit("task_updated"); 
  });

  // console.log("Real-time updates enabled!");

  app.get('/', (req, res) => {
   res.send('Task Manager is Running');
  });

  server.listen(port, () => {
   console.log(`Task Manager is running on port ${port}`);
  });

 } catch (error) {
  console.error(error);
 }
}

run().catch(console.dir);
