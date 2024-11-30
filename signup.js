document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();
    
    const signupForm = document.getElementById('signupForm');
    const errorMessage = document.getElementById('errorMessage');

    // Function to read users from file
    async function readUsersFile() {
        try {
            const response = await fetch('users.txt');
            const content = await response.text();
            return content.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [email, password, co2Emissions] = line.split(',');
                    return { email, password, co2Emissions: parseFloat(co2Emissions) || 0 };
                });
        } catch (error) {
            console.error('Error reading users file:', error);
            return [];
        }
    }

    // Function to write user to file using fetch
    async function writeUser(email, password) {
        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error('Failed to create account');
            }

            return true;
        } catch (error) {
            console.error('Error writing user:', error);
            throw error;
        }
    }

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        try {
            // Validate email format
            if (!email.includes('@')) {
                throw new Error('Invalid email format');
            }

            // Validate password match
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            // Check if user already exists
            const users = await readUsersFile();
            const existingUser = users.find(u => u.email === email);
            if (existingUser) {
                throw new Error('Email already registered');
            }

            // Create new user
            await writeUser(email, password);

            // Store user info in localStorage
            localStorage.setItem('userToken', 'user_' + Math.random().toString(36).substring(7));
            localStorage.setItem('userEmail', email);
            localStorage.setItem('co2Emissions', '0');
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.hidden = false;
        }
    });

    // Add animation to form inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', () => {
            if (!input.value) {
                input.parentElement.classList.remove('focused');
            }
        });
    });
});

