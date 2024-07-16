const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.port || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(express.json());

app.use(cors({
  // origin: ["http://localhost:5173"]
  origin:"*"

}))

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z7hla77.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;





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

    const usersCollection = client.db('Mobile_Financial_Service').collection('users');


    app.post('/user',async (req, res)=>{
        const user = req.body;

        const query = { number: user.number }
        const isExistingUser = await usersCollection.findOne(query);
  
        if (isExistingUser) {
          return res.send({
            message: 'user already exists', insertedId: null
          })
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    })
 
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Mobile Financial Service');
  })
  
  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  })