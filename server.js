import express from 'express'
import bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import dotenv from 'dotenv'
import { promisify } from 'util'
import { pool } from './db.js'
import cors from 'cors'
import { checkMembership, checkAdmin, alreadyJoined, checkMsgAuthor } from './middleware.js'
const port = process.env.PORT || 3000;
const server = express();
const client = await pool.connect()
dotenv.config()

const sign = promisify(JWT.sign)
const verify = promisify(JWT.verify)
const getMsgID = () => {
    const num = Math.floor(Math.random() * 999999) + 1
    return String(num).padStart(6, '0')
}

/* const corsOptions = {
    origin: 'http://127.0.0.1:5174', // Allow requests from this origin
    methods: 'GET, POST, PUT, DELETE', // Allow these HTTP methods
    allowedHeaders: 'Content-Type, Authorization', // Allow these headers
    credentials: true, // Allow cookies to be sent
  }; */
  
server.use(cors());

server.use(express.json())

// Register new users
server.post('/api/register', async (req, res) => {
    const { email, username, password } = req.body

    if (!email || !password || !username)
        return res.status(400).send({ error: 'Invalid request ' })

    try {
        const encryptedPassword = await bcrypt.hash(password, 10)

        await client.query(
            'INSERT INTO members (email, password, username) VALUES ($1, $2, $3)',
            [email, encryptedPassword, username]
        )
        const { rows } = await client.query('SELECT * FROM members');
        console.log(rows)
        return res.send({ info: 'User succesfully created' })
    } catch (err) {
        console.log(err)
        return res.status(500).send({ error: 'Internal server error' })
    }
})

// Login existing users
server.post('/api/login', async (req, res) => {
    const { email, password } = req.body

    if (!email || !password)
        return res.status(400).send({ error: 'Invalid request' })

    const q = await client.query(
        'SELECT password, member_id, username FROM members WHERE email=$1', [email]
    )

    if (q.rowCount === 0) {
        return res.status(404).send({ error: 'This user does not exist' })
    }

    const result = q.rows[0]
    // Check that the password logged is the same as the one saved previously
    const match = await bcrypt.compare(password, result.password)

    if (!match) {
        return res.status(403).send({ error: 'Wrong password' })
    }

    try {
        const token = await sign(
            { id: result.id, username: result.username, email },
            process.env.SECRET_TOKEN_KEY,
            {
                algorithm: 'HS512',
                expiresIn: '1d',
            }
        )
        return res.send({ "token": token })
    } catch (err) {
        console.log(err)
        return res.status(500).send({ error: 'Cannot generate token' })
    }
})

server.use(async (req, res, next) => {
    if (!req.headers.authorization)
        return res.status(401).send('Unauthorized')
    try {
        const decoded = await verify(
            req.headers.authorization.split(' ')[1],
            process.env.SECRET_TOKEN_KEY
        )
        if (decoded !== undefined) {
            req.user = decoded
            return next()
        }
    } catch (err) {
        console.log(err)
    }

    return res.status(403).send('Invalid token')
})


server.get('/api/home', (req, res) => {
    res.send({ info: 'Welcome, ' + req.user.username })
})

server.get('/api/members', async (req, res) => {
    // show only the members of lobbies you are admin of

    const q = await client.query('SELECT member, in_lobby FROM roles')
    return res.send(q.rows)
})

// 
server.post('/api/create-lobby', async (req, res) => {
    // request must contain username(creator) and name of lobby(id, n in the 100s)
    // Setting up necesary variables
    const messageID = getMsgID()
    const { username } = await req.user
    const { lobby_id } = await req.body
    const member_id = (await client.query('SELECT member_id FROM members WHERE username=$1',
        [username])).rows[0].member_id;
    try {// Create lobby
        const intoLobbiesDB = await client.query(`INSERT INTO lobbies (lobby_id, created_by) VALUES (${lobby_id}, ${member_id})`)

        const newLobby = await client.query(`CREATE TABLE lobby_${lobby_id} (
        lobby_id INT REFERENCES lobbies(lobby_id),
        message TEXT,
        message_id INT,
        author INT REFERENCES members(member_id)
        ) 
    `);
        // Add the creator to lobby and setting role as Admin
        const addAdmin = await client.query(`INSERT INTO lobby_${lobby_id}(lobby_id, message, message_id, author) VALUES ($1, $2, $3, $4)`, [lobby_id, `Lobby ${lobby_id} was just created by ${username}`, messageID, member_id])

        const intoRolesDB = await client.query('INSERT INTO roles(member, in_lobby, role) VALUES ($1, $2, $3)', [member_id, lobby_id, 'Admin'])

        res.status(200).send({ message: `Lobby ${lobby_id} was succefully created by ${username}` })
    } catch (err) {
        res.status(500).send({ info: 'Error setting up lobby' })
    }
})

// See all the members of a given lobby
server.get('/api/lobby/:id/members', checkMembership, async (req, res) => {
    const lobby_id = await req.params.id;
    const searchQ = await client.query(`SELECT roles.member, members.username
    FROM roles
    LEFT JOIN members ON roles.member = members.member_id
    WHERE roles.in_lobby = ${lobby_id}`)
    const members = searchQ.rows
    return res.status(200).send({ members })
})

// See all the messages posted in a given lobby, need to be member
server.get(`/api/lobby/:id`, checkMembership, async (req, res) => {
    const lobby_id = await req.params.id
    try {
        const result = await client.query(`SELECT message, message_id FROM lobby_${lobby_id}`);
        const messages = result.rows.map(row => ({
            message: row.message,
            message_id: row.message_id
        }))
        res.send({ messages })
    } catch (err) {
        res.send('Lobby not found')
    }
})

// Post a new message into a given lobby, need to be a member. { "message": "----" }
server.post('/api/lobby/:id', checkMembership, async (req, res) => {
    const messageID = getMsgID()
    const lobby_id = req.params.id
    const newMessage = req.body.message;
    const username = req.user.username;
    const author = (await client.query('SELECT member_id FROM members WHERE username=$1',
        [username])).rows[0].member_id;
    if (!newMessage) {
        return res.status(400).send({ info: 'No content found, please add a message to the body in the following format: { message: "your message here" } ' })
    }
    try {
        await client.query(`INSERT INTO lobby_${lobby_id} (lobby_id, message, message_id, author) VALUES($1, $2, $3, $4)`, [lobby_id, newMessage, messageID, author])
        return res.send({ info: `Your message "${newMessage}" was successfully posted to lobby ${lobby_id}` })
    } catch (err) {
        console.log(err)
        return res.send("Could not post new message")
    }
})

// See a single msg from a given lobby by using the msg unique id
server.get('/api/lobby/:id/:msgId', async (req, res) => {
    const lobby_id = req.params.id;
    const message_id = req.params.msgId;
    try {
        const result = await client.query(`SELECT message FROM lobby_${lobby_id} WHERE message_id = ${message_id}`);
        const message = result.rows.map(row => row.message)

        res.send({ message })
    } catch (err) {

        res.send('Message not found')
    }
})

// Add a member to a lobby, need to be admin of said lobby { username: ---}
server.post('/api/lobby/:id/add-user', checkAdmin, async (req, res) => {
    try {
        const messageID = getMsgID()
        const { username } = req.body;
        const lobby_id = req.params.id;
        const member_id = (await client.query('SELECT member_id FROM members WHERE username=$1',
            [username])).rows[0].member_id;
        // Check if user is already part of the lobby
        if (await alreadyJoined(member_id, lobby_id) === true) {
            return res.status(409).send({ error: 'Member is already part of the lobby' })
        }
        // Add member to selected lobby
        const newLobbyMember = await client.query(`INSERT INTO roles (member, in_lobby, role) VALUES (${member_id}, ${lobby_id}, 'User')`)
        // Autimated msg for a new member
        const WelcomeMsg = await client.query(`INSERT INTO lobby_${lobby_id} (lobby_id, message, message_id, author) VALUES ($1, $2, $3, $4)`, [lobby_id, `Member ${username} just joined this lobby, Welcome!`, messageID, member_id])

        return res.status(200).send({ info: `Member ${username} was successfully added to lobby ${lobby_id}` })
    } catch (err) {
        return res.status(500).send({ error: 'Internal server error' })
    }
})

// Edit or delete routes:

// Edit a specific msg in a lobby, need to either be the author or be an admin of the server { "message": "----"}
server.patch('/api/lobby/:id/:msgId', checkMsgAuthor, async (req, res) => {
    const lobby_id = req.params.id;
    // Get the new inputted message from the body object
    const patchMessage = req.body.message + ` - edited by ${req.user.username}`;
    const message_id = req.params.msgId;

    const finalMessage = await client.query(`UPDATE lobby_${lobby_id} SET message = $1 WHERE message_id = $2`, [patchMessage, message_id])
    return res.status(200).send({ info: `Message successfully edited by ${req.user.username}` })
})



server.listen(port, () => {
    console.log(`Listening on port: ${port}`);
})

export { client } 