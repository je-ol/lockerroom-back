import { client } from "./server.js";

// Check if user is part of server
const checkMembership = async (req, res, next) => {
    const { username } = req.user;

    try {
        const result = await client.query(
            'SELECT member_id FROM members WHERE username=$1',
            [username ? username : '']
        );

        if (result.rows.length === 0) {
            console.log('User not found');
            return res.status(401).send({ error: 'You are not a member of this lobby' });
        }

        const member_id = result.rows[0].member_id;
        const lobby_id = req.params.id;

        if (!lobby_id) {
            console.log('Lobby ID is undefined');
            return res.status(400).send({ error: 'Lobby ID is required' });
        }

        const searchQ = await client.query(
            'SELECT * FROM roles WHERE member = $1 AND in_lobby = $2',
            [member_id, lobby_id]
        );

        if (searchQ.rows.length > 0) {
            console.log('Found user');
            next();
        } else {
            console.log('User not found');
            return res.status(401).send({ error: 'You are not a member of this lobby' });
        }
    } catch (error) {
        console.error('Error checking membership:', error);
        return res.status(500).send({ error: 'Internal server error' });
    }
};


const checkAdmin = async (req, res, next) => {
    try {
        const { username } = req.user;
        const member_id = (await client.query('SELECT member_id FROM members WHERE username=$1',
            [username])).rows[0].member_id;
        const lobby_id = req.params.id;
        // search for member role for current lobby
        const searchQ = await client.query('SELECT role FROM roles WHERE in_lobby=$1 AND member=$2', [lobby_id, member_id])
        if (searchQ.rows.length === 0) {
            return res.status(403).send({ error: 'Admin privileges required' })
        }
        const role = searchQ.rows[0].role;
        if (role === 'Admin') {
            next()
        } else if (role === 'User') {
            return res.status(401).send({ error: 'Admin privileges required' })
        } else {
            return res.status(403).send({ error: 'User privileges not found' })
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send({ error: 'Internal server error' })
    }
}

const alreadyJoined = async (member_id, lobby_id) => {
    const searchQ = await client.query(`SELECT * FROM roles WHERE member=${member_id} AND in_lobby = ${lobby_id}`)
    if (searchQ.rows.length > 0) {
        return true
    }
}

const checkMsgAuthor = async (req, res, next) => {
    try {
        const lobby_id = req.params.id;
        const username = req.user.username;
        const member_id = (await client.query('SELECT member_id FROM members WHERE username = $1', [username])).rows[0].member_id
        const message_id = req.params.msgId;
        //check for Admin:
        const searchQ = (await client.query('SELECT role FROM roles WHERE in_lobby=$1 AND member=$2', [lobby_id, member_id])).rows[0].role

        // Find if member is the author of said message
        const selectedMessage = (await client.query(`SELECT message FROM lobby_${lobby_id} WHERE author=$1 AND message_id=$2`,
        [member_id, message_id]))
        if (selectedMessage.rows.length > 0 || searchQ === 'Admin') {
            next()
        } 

        
    } catch (err) {
        console.log('no message matched', err)
        return res.status(404).send({ error: 'Message match not found, either wrong message or this message is from a different member' })
    }
}


export { checkMembership, checkAdmin, alreadyJoined, checkMsgAuthor }