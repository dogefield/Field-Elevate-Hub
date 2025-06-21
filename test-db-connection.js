const { Client } = require('pg');

const connectionString = 'postgresql://fieldelevate:9yxg4DLkpYm6z5qn1mX4MhJAHuPhVBcC@dpg-d15cv97diees73ftl5c0-a.oregon-postgres.render.com/fieldelevate';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL database!');
    
    const result = await client.query('SELECT NOW()');
    console.log('Current time from database:', result.rows[0].now);
    
    await client.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection(); 