const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
// const port = process.env.port || 5000;
const port = process.env.PORT || 5000;

const jwt = require('jsonwebtoken');


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

app.use(express.json());

app.use(cors({
    // origin: ["http://localhost:5173","https://mobilefinancialservice.netlify.app"],
    origin: "*",
    credentials: true

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
        const transectionsCollection = client.db('Mobile_Financial_Service').collection('transections');

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
                console.log('Error during login:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });


        // check role for user 
        app.get('/user/:number', async (req, res) => {
            const number = req.params.number;
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
            // const result = await usersCollection.find().toArray();
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



        //send money from regular user
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
                const typeOfTransection = 'Send money';
                const status = 'Done';

                const transection = {
                    money,
                    sender,
                    receiver,
                    typeOfTransection,
                    status

                }
                transectionsCollection.insertOne(transection);
                // res.send(transection);
                // Send a success response
                res.status(200).json({ message: 'Money sent successfully' });


            } catch (err) {
                console.error('Error during send money:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });




        //cash out from regular user
        app.post('/cashOut', async (req, res) => {
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
                const receiverQuery = { number: receiver, role: 'Agent' };
                const receiverResult = await usersCollection.findOne(receiverQuery);

                if (!receiverResult) {
                    return res.status(400).json({ message: 'Agent not found' });
                }

                // Update the sender's balance
                const updateSender = {
                    $set: {
                        balance: senderResult.balance - money
                    }
                };
                await usersCollection.updateOne(senderQuery, updateSender);


                // Update the receiver's balance
                const updateReceiver = {
                    $set: {
                        balance: receiverResult.balance + money
                    }
                };
                await usersCollection.updateOne(receiverQuery, updateReceiver);
                const typeOfTransection = 'Cash out'
                const transection = {
                    status: 'Done',
                    money,
                    sender,
                    receiver,
                    typeOfTransection

                }
                transectionsCollection.insertOne(transection);

                // Send a success response
                res.status(200).json({ message: 'Money sent successfully' });


            } catch (err) {
                console.error('Error during cash out:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });



        //send request for cash in
        app.post('/cashIn', async (req, res) => {
            let { receiver, agent, money, password } = req.body;

            try {
                // Find the receiver
                const receiverQuery = { number: receiver };
                const receiverResult = await usersCollection.findOne(receiverQuery);

                if (!receiverResult) {
                    return res.status(400).json({ message: 'receiver not found' });
                }

                // Check if the password matches
                const isMatch = await bcrypt.compare(password, receiverResult.pin);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Wrong password' });
                }

                // Find the agent
                const agentQuery = { number: agent, role: 'Agent' };
                const agentResult = await usersCollection.findOne(agentQuery);

                if (!agentResult) {
                    return res.status(400).json({ message: 'Agent not found' });
                }


                const requestForCashIn = {
                    status: 'pending',
                    typeOfTransection: 'cash in',
                    money,
                    receiver,
                    agent
                }

                const result = await transectionsCollection.insertOne(requestForCashIn);
                res.send(result);

            } catch (err) {
                console.error('Error during cash out:', err);
                res.status(500).json({ message: 'Internal server error' });
            }
        });



        // get all cash in request for agent
        app.get('/cashInRequest/:agentNumber', async (req, res) => {
            const agentNumber = req.params.agentNumber;
            const query = {
                agent: agentNumber,
                status: 'pending',
                typeOfTransection: 'cash in'
            };
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })


        // Cash in Transection management for Agent
        app.patch('/ConfirmCashIn/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await transectionsCollection.findOne(query);
            const { money, receiver, agent } = result;



            // Update the sender's balance(agent)
            const searchAgentDetails = { number: agent };
            const agentDetails = await usersCollection.findOne(searchAgentDetails);

            // check agent balance
            if (agentDetails.balance < money) {
                return res.status(400).json({ message: 'No efficient balance' });
            }
            const updateAgentDetails = {
                $set: {
                    balance: agentDetails.balance - money
                }
            };
            await usersCollection.updateOne(agentDetails, updateAgentDetails);


            // Update the receiver's balance

            const searchReceiverDetails = { number: receiver };
            const receiverDetails = await usersCollection.findOne(searchReceiverDetails);

            const updateReceiverDetails = {
                $set: {
                    balance: receiverDetails.balance + money
                }
            };
            await usersCollection.updateOne(receiverDetails, updateReceiverDetails);

            //update status after receive money
            const updateStatus = {
                $set: {
                    status: 'done'
                }
            }
            await transectionsCollection.updateOne(result, updateStatus);

            // Send a success response
            res.status(200).json({ message: 'Cash in successfully' });
        })



        //get all cash in transection for admin
        app.get('/allCashInTransection', async (req, res) => {
            const query = {
                typeOfTransection: 'cash in'
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })

        //get all cash out transection for admin
        app.get('/allCashOutTransection', async (req, res) => {
            const query = {
                typeOfTransection: 'Cash out'
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })

        //get all send money transection for admin
        app.get('/allSendMoneyTransection', async (req, res) => {
            const query = {
                typeOfTransection: 'Send money'
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })



        //get all cash in transection for a single agent
        app.get('/allCashInTransection/:agentNumber', async (req, res) => {
            const agentNumber = req.params.agentNumber;
            const query = {
                typeOfTransection: 'cash in',
                agent: agentNumber
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })



        //get all cash out transection for a single agent
        app.get('/allCashOutTransection/:agentNumber', async (req, res) => {
            const agentNumber = req.params.agentNumber;
            const query = {
                typeOfTransection: 'Cash out',
                receiver: agentNumber
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })



        //get all cash in transection for a single regular user
        app.get('/CashInTransection/:userNumber', async (req, res) => {
            const userNumber = req.params.userNumber;
            const query = {
                typeOfTransection: 'cash in',
                receiver: userNumber
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })



        //get all cash out transection for a single regular user
        app.get('/CashOutTransection/:userNumber', async (req, res) => {
            const userNumber = req.params.userNumber;
            const query = {
                typeOfTransection: 'Cash out',
                sender: userNumber
            }
            const result = await transectionsCollection.find(query).toArray();
            res.send(result);
        })


        //get all send money transection for a single regular user
        app.get('/SendMoneyTransection/:userNumber', async (req, res) => {
            const userNumber = req.params.userNumber;
            const query = {
                typeOfTransection: 'Send money',
                sender: userNumber
            }
            const result = await transectionsCollection.find(query).toArray();
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