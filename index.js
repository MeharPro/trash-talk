const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const app = express();

// OpenRouter API Configuration
const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(fileUpload());

// Serve static files from public directory
app.use(express.static('public'));

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Read existing users
        let users = [];
        try {
            const data = await fs.readFile('users.txt', 'utf8');
            users = data.split('\n').filter(line => line.trim());
        } catch (error) {
            // File doesn't exist yet, that's okay
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Check if user already exists
        const existingUser = users.find(line => line.split(',')[0] === email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Add new user with 0 CO2 emissions
        const newUser = `${email},${password},0`;
        await fs.appendFile('users.txt', users.length ? '\n' + newUser : newUser);

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// API endpoint for image analysis
app.post('/analyze-image', async (req, res) => {
    try {
        const { image, prompt } = req.body;
        
        if (!image) {
            console.error('No image provided');
            return res.status(400).json({ error: 'Image is required' });
        }

        if (!prompt) {
            console.error('No prompt provided');
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Sending request to OpenRouter...');
        
        const requestBody = {
            model: "meta-llama/llama-3.2-90b-vision-instruct:free",
            max_tokens: 400,
            messages: [
                {
                    role: "system",
                    content: "You are an expert in waste management and environmental impact analysis. When analyzing images of waste items, provide detailed information about: 1) The type of waste item and what materials it is made of, 2) The correct disposal method (recycling, composting, or trash) with explanation, 3) Environmental impact including estimated CO2 emissions. Be specific and educational in your responses."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ]
        };

        const parsedUrl = new URL(OPENROUTER_URL);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Waste Analysis App',
                'Content-Type': 'application/json'
            }
        };

        const openRouterResponse = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        data: data
                    });
                });
            });

            req.on('error', (error) => {
                console.error('Request error:', error);
                reject(error);
            });

            req.write(JSON.stringify(requestBody));
            req.end();
        });

        if (!openRouterResponse.ok) {
            const errorData = JSON.parse(openRouterResponse.data);
            console.error('OpenRouter API error:', {
                status: openRouterResponse.status,
                statusText: openRouterResponse.statusText,
                error: errorData
            });
            return res.status(openRouterResponse.status).json({ 
                error: 'OpenRouter API error', 
                details: errorData.error?.message || 'Failed to analyze image'
            });
        }

        const data = JSON.parse(openRouterResponse.data);
        console.log('Received response from OpenRouter:', data);

        if (!data.choices?.[0]?.message?.content) {
            console.error('Invalid response structure:', data);
            return res.status(500).json({ error: 'Invalid response from OpenRouter' });
        }

        const aiResponse = data.choices[0].message.content;
        
        // Parse the AI response into sections
        const analysis = {
            itemType: extractSection(aiResponse, "Type of waste") || "Not identified",
            disposalMethod: extractSection(aiResponse, "Disposal method") || "Not specified",
            co2Impact: extractSection(aiResponse, "Environmental impact") || "Not calculated",
            fullAnalysis: aiResponse
        };

        console.log('Sending analysis:', analysis);
        res.json(analysis);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze image', 
            details: error.message 
        });
    }
});

// Helper function to extract sections from AI response
function extractSection(text, sectionName) {
    const regex = new RegExp(`${sectionName}:?(.+?)(?=(?:Type of waste|Disposal method|Environmental impact|$))`, 'is');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

// Update user's CO2 emissions
app.post('/api/update-emissions', async (req, res) => {
    try {
        const { email, emissions, content } = req.body;

        if (!email || typeof emissions !== 'number' || !content) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Write the updated content to users.txt
        await fs.writeFile('users.txt', content);

        res.json({ 
            message: 'Emissions updated successfully'
        });
    } catch (error) {
        console.error('Error updating emissions:', error);
        res.status(500).json({ error: 'Failed to update emissions' });
    }
});

// Update users.txt file
app.put('/users.txt', async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.files.file;
        await fs.writeFile('users.txt', file.data);
        res.json({ message: 'File updated successfully' });
    } catch (error) {
        console.error('Error updating users.txt:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
});

// Save emissions data
app.post('/save-emissions', async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile('public/emissions.json', JSON.stringify(data, null, 2));
        res.json({ message: 'Emissions updated successfully' });
    } catch (error) {
        console.error('Error saving emissions:', error);
        res.status(500).json({ error: 'Failed to save emissions' });
    }
});

// Save groups data
app.post('/save-groups', async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile('public/groups.json', JSON.stringify(data, null, 2));
        res.json({ message: 'Groups updated successfully' });
    } catch (error) {
        console.error('Error saving groups:', error);
        res.status(500).json({ error: 'Failed to save groups' });
    }
});

// Read groups data
app.get('/groups.json', async (req, res) => {
    try {
        const data = await fs.readFile('public/groups.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading groups:', error);
        res.status(500).json({ error: 'Failed to read groups' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
