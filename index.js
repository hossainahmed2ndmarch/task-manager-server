const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()

const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c6qkm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
 serverApi: {
  version: ServerApiVersion.v1,
  strict: true,
  deprecationErrors: true,
 }
});

async function run() {
 try {
  // Connect the client to the server	(optional starting in v4.7)
  // await client.connect();

  const taskCollection = client.db('taskDB')
  const tasks = taskCollection.collection('tasks')
  const users = taskCollection.collection('users')

  // Middlewares
  const verifyToken = (req, res, next) => {
   // console.log(req.headers);
   if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' })
   }
   const token = req.headers.authorization.split(' ')[1]
   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
     return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded
    next()
   })
  }

  // JWT API
  app.post('/jwt', async (req, res) => {
   const user = req.body
   // console.log("User Info Received:", user);
   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1h'
   })
   res.send({ token })
  })

  // Users API
  app.post('/users', async (req, res) => {
   const user = req.body
   const query = { email: user.email }
   const existingUser = await users.findOne(query)
   if (existingUser) {
    return res.send({ message: 'user already exist', insertedId: null })
   }
   const result = await users.insertOne(user)
   res.send(result)
  })


  // TASKS API
  app.post('/tasks', async (req, res) => {
   const task = req.body;
   task.timestamp = new Date();
   const result = await tasks.insertOne(task);
   res.send(result);
  })


  app.get("/tasks/:email", async (req, res) => {
   const email = req.params.email
   const query = { taskAdder: email }
   const result = await tasks.find(query).toArray()
   res.send(result);
  });


  app.patch("/tasks/:id", async (req, res) => {
   const { id } = req.params;
   const updatedTask = req.body;
   await tasks.updateOne({ _id: new ObjectId(id) }, { $set: updatedTask });
   res.send({ message: "Task updated" });
  });


  app.delete("/tasks/:id", async (req, res) => {
   const id = req.params.id
   const query = { _id: new ObjectId(id) }
   const result = await tasks.deleteOne(query)
   res.send(result)
  });

  // Send a ping to confirm a successful connection
  await client.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");
 } finally {
  // Ensures that the client will close when you finish/error
  await client.close();
 }
}
run().catch(console.dir);



app.get('/', (req, res) => {
 res.send('Task Manager is Sitting')
})

app.listen(port, () => {
 console.log(`Task Manager is Sittingj on ${port}`);
})