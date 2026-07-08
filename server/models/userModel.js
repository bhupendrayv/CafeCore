const { getPool } = require('../config/db');

class User {
    static async findByEmail(email) {
        const pool = getPool();
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async create(name, email, hashedPassword) {
        const pool = getPool();
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );
        return result.insertId;
    }
}

module.exports = User;
