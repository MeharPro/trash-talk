document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();
    
    const loginForm = document.getElementById('loginForm');
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

    // Function to write user to file
    async function writeUser(email, password) {
        try {
            const users = await readUsersFile();
            const existingUser = users.find(u => u.email === email);
            
            if (existingUser) {
                throw new Error('User already exists');
            }

            // Initialize with 0 CO2 emissions for new users
            const newUser = `${email},${password},0\n`;
            
            // In a real application, you would make an API call to append to the file
            // For demo purposes, we'll just show what would be written
            console.log('Would write to file:', newUser);
            
            return true;
        } catch (error) {
            console.error('Error writing user:', error);
            throw error;
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (!email.includes('@')) {
                throw new Error('Invalid email format');
            }

            // Read users from file and check credentials
            const users = await readUsersFile();
            const user = users.find(u => u.email === email && u.password === password);

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Store user info in localStorage
            localStorage.setItem('userToken', 'user_' + Math.random().toString(36).substring(7));
            localStorage.setItem('userEmail', email);
            localStorage.setItem('co2Emissions', user.co2Emissions.toString());
            
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

