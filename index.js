const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.port || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

app.use(express.json());

app.use(cors({
    // origin: ["http://localhost:5173"]
    origin: "*"

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

        // jwt 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }



        // save user in database 
        app.post('/user', async (req, res) => {

            const { name, email, number, pin, role, status } = req.body;
            const query = { number: number }
            const isExistingUser = await usersCollection.findOne(query);

            if (isExistingUser) {
                return res.send({
                    message: 'user already exists', insertedId: null
                })
            }

            const salt = await bcrypt.genSaltSync(10);

            const secPin = await bcrypt.hash(pin, salt);
            const user = {
                name,
                email,
                pin: secPin,
                number,
                role,
                status
            }
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        // check  password with hash password from database 
        app.post('/login', async (req, res) => {
            const { number, pin } = req.body;
            const query = { number: number };

            try {
                console.log('Received login request:', req.body);

                const result = await usersCollection.findOne(query);
                if (!result) {
                    console.log('User not found for number:', number);
                    return res.status(400).json({ message: 'User not found' });
                }

                console.log('User found:', result);

                const isMatch = await bcrypt.compare(pin, result.pin);
                if (isMatch) {
                    console.log('Password match for user:', number);

                    res.status(200).json({ message: 'Login successful' });
                } else {
                    console.log('Invalid password for user:', number);
                    res.status(400).json({ message: 'Invalid password' });
                }
            } catch (err) {
                console.error('Error during login:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });


        // check role for user 

        app.get('/user/:number', async (req, res) => {
            const number = req.params.number;
            console.log(number);
            query = { number: number }
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        // get all user 
        app.get('/allUser', async (req, res) => {
            const search = req.query.search;
            console.log(search);
            const query = {
                name: { $regex: search, $options: 'i' }
            }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })





        //update user status pending to active and also give bonus on first active




        app.patch('/activeUser/:id', async (req, res) => {
            const id = req.params.id;
            let query;
            let updateOne;

            // Check if the user is a pending Regular User
            query = {
                _id: new ObjectId(id),
                status: 'pending',
                role: 'Regular User'
            };
            let user = await usersCollection.findOne(query);
            if (user) {
                updateOne = {
                    $set: {
                        status: "active",
                        balance: 40
                    }
                };
                const result = await usersCollection.updateOne(query, updateOne);
                return res.send(result);
            }

            // Check if the user is a pending Agent
            query = {
                _id: new ObjectId(id),
                status: 'pending',
                role: 'Agent'
            };
            user = await usersCollection.findOne(query);
            if (user) {
                updateOne = {
                    $set: {
                        status: "active",
                        balance: 10000
                    }
                };
                const result = await usersCollection.updateOne(query, updateOne);
                return res.send(result);
            }

            // Default case: update status to active without changing balance
            query = { _id: new ObjectId(id) };
            updateOne = {
                $set: {
                    status: "active"
                }
            };
            const result = await usersCollection.updateOne(query, updateOne);
            res.send(result);
        });



        //update user status to block
        app.patch('/blockUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const updateOne = {
                $set: {
                    status: "block"
                }
            }
            const result = await usersCollection.updateOne(query, updateOne);
            res.send(result);

        })



        //send money
        // app.post('/sendMoney', async(req, res)=>{
        //     const sendMoney = req.body;
        //     const {sender, receiver, money, password} = sendMoney;

        //     try{
        //         const query = {number: sender}
        //         const result = await usersCollection.findOne(query);


        //         const isMatch = await bcrypt.compare(password, result.pin);
        //         if (!isMatch) {
        //             return res.status(400).json({ message: 'Wrong password' });
        //         } 


        //         const searchReceiver = {
        //             number: receiver,
        //             role:'Regular User'
        //         }
        //         const filter = await usersCollection.findOne(searchReceiver);
        //         if (!filter) {
        //             console.log('User not found');
        //             return res.status(400).json({ message: 'User not found' });
        //         }else{
        //             const updateReceiver = {
        //                 $set: {
        //                     balance : filter.balance + money
        //                 }
        //             }
        //             const updateSender = {
        //                 $set : {
        //                     balance : result.balance - money
        //                 }
        //             }

        //             const updateSend = await usersCollection.updateOne(result, updateSender);
        //             res.send(updateSend);

        //             const updateRec = await usersCollection.updateOne(filter, updateReceiver);
        //             res.send(updateRec);
        //         }
        //     }catch(err){
        //         console.error('Error during send money:', err);
        //         res.status(500).json({ message: 'Internal server error' });
        //     }
        // })
        app.post('/sendMoney', async (req, res) => {
            let { sender, receiver, money, password } = req.body;
            

            try {
                // Find the sender
                const senderQuery = { number: sender };
                const senderResult = await usersCollection.findOne(senderQuery);

                if (!senderResult) {
                    return res.status(400).json({ message: 'Sender not found' });
                }

                // Check if the password matches
                const isMatch = await bcrypt.compare(password, senderResult.pin);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Wrong password' });
                }

                // Find the receiver
                const receiverQuery = { number: receiver, role: 'Regular User' };
                const receiverResult = await usersCollection.findOne(receiverQuery);

                if (!receiverResult) {
                    return res.status(400).json({ message: 'Receiver not found' });
                }

                // Update the sender's balance
                const updateSender = {
                    $set: {
                        balance: senderResult.balance - money
                    }
                };
                await usersCollection.updateOne(senderQuery, updateSender);


                if (money > 100) {
                    money -= 5;
                }

                // Update the receiver's balance
                const updateReceiver = {
                    $set: {
                        balance: receiverResult.balance + money
                    }
                };
                await usersCollection.updateOne(receiverQuery, updateReceiver);

                // Send a success response
                res.status(200).json({ message: 'Money sent successfully' });

            } catch (err) {
                console.error('Error during send money:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });































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