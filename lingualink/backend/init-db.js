require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        type_document VARCHAR(20) NOT NULL,
        number_document VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vocabularies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        level VARCHAR(50) NOT NULL,
        theme VARCHAR(150),
        emoji VARCHAR(20),
        color VARCHAR(150),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vocabulary_words (
        id SERIAL PRIMARY KEY,
        vocabulary_id INTEGER REFERENCES vocabularies(id) ON DELETE CASCADE,
        english VARCHAR(150) NOT NULL,
        spanish VARCHAR(150) NOT NULL,
        audio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        vocabulary_id INTEGER REFERENCES vocabularies(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        title VARCHAR(150) NOT NULL,
        instructions TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activity_results (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        percentage NUMERIC(5,2),
        answers_json TEXT,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS student_progress (
       id SERIAL PRIMARY KEY,
       student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       level VARCHAR(20) NOT NULL,
       completed_activities INTEGER DEFAULT 0,
       total_score INTEGER DEFAULT 0,
       total_questions INTEGER DEFAULT 0,
       progress_percentage NUMERIC(5,2) DEFAULT 0,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(student_id, level)
       );

      INSERT INTO users (type_document, number_document, password, role)
      VALUES 
      ('CC', '34556667', '1234', 'teacher'),
      ('TI', '22344556', '4321', 'student')
      ON CONFLICT (number_document) DO NOTHING;
    `);

    console.log('Tablas creadas correctamente en PostgreSQL');
  } catch (error) {
    console.error('Error creando las tablas:', error.message);
  } finally {
    await pool.end();
  }
}

initDB();