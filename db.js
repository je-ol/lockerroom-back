import dotenv from 'dotenv'
import pg from 'pg'

const { Pool } = pg
dotenv.config()

const pool = new Pool( {
    user: process.env.DB_USER,
    host: "localhost",
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432

});

/* (async () => {
    const client = await pool.connect()
    const { rows } = await client.query('SELECT * FROM members');
    console.log(rows)
})() */


  

export { pool }