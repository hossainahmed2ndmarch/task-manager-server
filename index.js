const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()

const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


app.get('/', (req, res) => {
 res.send('Task Manager is Sitting')
})

app.listen(port, () => {
 console.log(`Task Manager is Sitting on ${port}`);
})