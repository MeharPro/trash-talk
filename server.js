const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Endpoint to handle user signup
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const usersFilePath = path.join(__dirname, 'public', 'users.txt');
        
        // Read existing users
        let content = '';
        try {
            content = await fs.readFile(usersFilePath, 'utf8');
        } catch (error) {
            // File doesn't exist yet, that's okay
        }

        const users = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [email] = line.split(',');
                return email;
            });

        // Check if user already exists
        if (users.includes(email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Append new user with 0 CO2 emissions
        const newUser = `${email},${password},0\n`;
        await fs.appendFile(usersFilePath, newUser);

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error in /api/signup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 