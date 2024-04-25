import dotenv from 'dotenv'
import pg from 'pg'

const { Pool } = pg
dotenv.config()

const pool = new Pool( {
    user: process.env.DB_USER,
    host: "cdgn4ufq38ipd0.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com" || "localhost",
    database: "d8tn11flae61h5" || process.env.DB_NAME,
    password: "pc73ff0a684ba92bffb95b350f57879b22a3f1d927573c6d4ea8d441bf7c4a9f1" ||process.env.DB_PASSWORD,
    URI: "postgres://u2pfb8087mprde:pc73ff0a684ba92bffb95b350f57879b22a3f1d927573c6d4ea8d441bf7c4a9f1@cdgn4ufq38ipd0.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com:5432/d8tn11flae61h5",
    port: 5432

});

/* (async () => {
    const client = await pool.connect()
    const { rows } = await client.query('SELECT * FROM members');
    console.log(rows)
})() */


  

export { pool }