document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // Get user email from localStorage
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        window.location.href = '/login.html';
        return;
    }

    // Load user's emissions data
    async function loadUserData() {
        try {
            const response = await fetch('/emissions.json');
            if (!response.ok) throw new Error('Failed to fetch emissions data');
            const data = await response.json();
            const userEmissions = data.users[userEmail]?.emissions || [];
            
            // Calculate total emissions
            const totalEmissions = userEmissions.reduce((sum, val) => sum + val, 0);
            
            // Update emissions display (CO₂ Saved)
            const emissionsDisplay = document.querySelector('.stat-item:nth-child(2) .stat-value');
            if (emissionsDisplay) {
                emissionsDisplay.textContent = totalEmissions.toFixed(2) + ' kg';
            }

            // Update number of items recycled
            const itemsDisplay = document.querySelector('.stat-item:nth-child(1) .stat-value');
            if (itemsDisplay) {
                itemsDisplay.textContent = userEmissions.length.toString();
            }

            // Set day streak to 1
            const streakDisplay = document.querySelector('.stat-item:nth-child(3) .stat-value');
            if (streakDisplay) {
                streakDisplay.textContent = '1';
            }

            // Update recent activity
            const recentPhotos = document.getElementById('recentPhotos');
            if (recentPhotos) {
                if (userEmissions.length > 0) {
                    const activityHtml = `
                        <div class="activity-stats">
                            <div class="stat">
                                <span class="stat-number">${userEmissions.length}</span>
                                <span class="stat-label">Total Items</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">${totalEmissions.toFixed(2)}</span>
                                <span class="stat-label">kg CO₂ Impact</span>
                            </div>
                        </div>
                        <div class="recent-activity-list">
                            ${userEmissions.map((emission, index) => `
                                <div class="activity-item">
                                    <div class="activity-details">
                                        <h4>Item ${index + 1}</h4>
                                        <p class="co2-impact">+${emission.toFixed(2)} kg CO₂</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    recentPhotos.innerHTML = activityHtml;
                } else {
                    recentPhotos.innerHTML = `
                        <div class="empty-state">
                            <i data-lucide="camera-off" style="width: 48px; height: 48px; margin-bottom: 1rem; color: var(--text-secondary)"></i>
                            <p>No items analyzed yet.</p>
                            <a href="capture.html" class="btn btn-primary" style="margin-top: 1rem;">
                                <i data-lucide="camera"></i>
                                Start Analyzing
                            </a>
                        </div>
                    `;
                }
                // Reinitialize icons for new content
                lucide.createIcons();
            }

            return { userEmissions, totalEmissions };
        } catch (error) {
            console.error('Error loading user data:', error);
            return { userEmissions: [], totalEmissions: 0 };
        }
    }

    // Load initial user data
    await loadUserData();

    // Generate a random 6-digit code
    function generateGroupCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Get user emissions
    async function getUserEmissions(email) {
        try {
            const response = await fetch('/emissions.json');
            if (!response.ok) throw new Error('Failed to fetch emissions data');
            const data = await response.json();
            const userEmissions = data.users[email]?.emissions || [];
            return userEmissions.reduce((sum, val) => sum + val, 0);
        } catch (error) {
            console.error('Error getting user emissions:', error);
            return 0;
        }
    }

    // Create new group
    async function createGroup(groupName) {
        try {
            const response = await fetch('/groups.json');
            if (!response.ok) throw new Error('Failed to fetch groups data');
            const data = await response.json();
            
            const groupCode = generateGroupCode();
            const userEmail = localStorage.getItem('userEmail');
            const userEmissions = await getUserEmissions(userEmail);
            
            // Add new group
            data.groups[groupCode] = {
                name: groupName,
                members: [userEmail],
                totalEmissions: userEmissions
            };
            
            // Save updated data
            const saveResponse = await fetch('/save-groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!saveResponse.ok) throw new Error('Failed to save group data');
            
            return groupCode;
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    }

    // Join existing group
    async function joinGroup(groupCode) {
        try {
            const response = await fetch('/groups.json');
            if (!response.ok) throw new Error('Failed to fetch groups data');
            const data = await response.json();
            
            // Check if group exists
            if (!data.groups || !data.groups[groupCode]) {
                throw new Error('Invalid group code. Please check and try again.');
            }
            
            const group = data.groups[groupCode];
            const userEmail = localStorage.getItem('userEmail');

            // Check if user is already a member
            if (group.members.includes(userEmail)) {
                throw new Error('You are already a member of this group');
            }
            
            // Add user to group
            group.members.push(userEmail);
            
            // Calculate total emissions for all members
            let totalEmissions = 0;
            for (const member of group.members) {
                const memberEmissions = await getUserEmissions(member);
                totalEmissions += memberEmissions;
            }
            group.totalEmissions = totalEmissions;
            
            // Save updated data
            const saveResponse = await fetch('/save-groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save group data');
            }
            
            return {
                name: group.name,
                code: groupCode,
                members: group.members,
                totalEmissions: group.totalEmissions
            };
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    // Update leaderboard display
    async function updateLeaderboard(group) {
        const leaderboardList = document.getElementById('leaderboardList');
        if (leaderboardList && group) {
            try {
                // Get emissions for each member
                const memberEmissions = await Promise.all(
                    group.members.map(async member => ({
                        email: member,
                        emissions: await getUserEmissions(member)
                    }))
                );

                // Sort by emissions (highest to lowest)
                memberEmissions.sort((a, b) => b.emissions - a.emissions);

                leaderboardList.innerHTML = `
                    <div class="leaderboard-header">
                        <h3>${group.name} Leaderboard</h3>
                        <p>Total Group Impact: ${group.totalEmissions.toFixed(2)} kg CO₂</p>
                    </div>
                    <div class="leaderboard-members">
                        ${memberEmissions.map((member, index) => `
                            <div class="leaderboard-item ${index === 0 ? 'top-emitter' : ''}">
                                <div class="member-info">
                                    <span class="member-email">
                                        ${index === 0 ? '⭐ ' : ''}${member.email}
                                    </span>
                                    <span class="member-impact">${member.emissions.toFixed(2)} kg CO₂</span>
                                </div>
                                <div class="member-rank">Rank #${index + 1}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } catch (error) {
                console.error('Error updating leaderboard:', error);
                leaderboardList.innerHTML = '<p class="empty-state">Failed to load leaderboard data</p>';
            }
        }
    }

    // Load and display groups
    async function loadGroups() {
        try {
            const response = await fetch('/groups.json');
            if (!response.ok) throw new Error('Failed to load groups');
            const data = await response.json();
            
            const userEmail = localStorage.getItem('userEmail');
            const userGroups = [];
            
            // Calculate total emissions for each group
            for (const [code, group] of Object.entries(data.groups)) {
                let totalEmissions = 0;
                for (const member of group.members) {
                    const memberEmissions = await getUserEmissions(member);
                    totalEmissions += memberEmissions;
                }
                group.totalEmissions = totalEmissions;
                
                if (group.members.includes(userEmail)) {
                    userGroups.push({ code, ...group });
                }
            }
            
            // Save updated emissions
            await fetch('/save-groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            // Display groups in the list
            const groupsList = document.getElementById('groupsList');
            if (groupsList) {
                if (userGroups.length === 0) {
                    groupsList.innerHTML = '<p class="empty-state">You haven\'t joined any groups yet.</p>';
                } else {
                    groupsList.innerHTML = userGroups.map(group => `
                        <div class="group-item">
                            <div class="group-info">
                                <h3>${group.name}</h3>
                                <p>Code: ${group.code}</p>
                                <p>Members: ${group.members.length}</p>
                                <p>Total Impact: ${group.totalEmissions.toFixed(2)} kg CO₂</p>
                            </div>
                            <div class="group-members">
                                ${group.members.map(member => `
                                    <div class="member">${member}</div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Update group select dropdown
            const groupSelect = document.getElementById('groupSelect');
            if (groupSelect) {
                groupSelect.innerHTML = `
                    <option value="">Select a group</option>
                    ${userGroups.map(group => `
                        <option value="${group.code}">${group.name}</option>
                    `).join('')}
                `;

                // Add change event listener for the select
                groupSelect.addEventListener('change', (e) => {
                    const selectedGroupCode = e.target.value;
                    if (selectedGroupCode) {
                        const selectedGroup = userGroups.find(g => g.code === selectedGroupCode);
                        updateLeaderboard(selectedGroup);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            const groupsList = document.getElementById('groupsList');
            if (groupsList) {
                groupsList.innerHTML = '<p class="empty-state">Failed to load groups</p>';
            }
        }
    }

    // Event Listeners for modal
    const createGroupBtn = document.getElementById('createGroupBtn');
    const joinGroupBtn = document.getElementById('joinGroupBtn');
    const groupModal = document.getElementById('groupModal');
    const closeModal = document.getElementById('closeModal');
    const groupForm = document.getElementById('groupForm');
    const createGroupFields = document.getElementById('createGroupFields');
    const joinGroupFields = document.getElementById('joinGroupFields');
    const modalTitle = document.getElementById('modalTitle');

    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            modalTitle.textContent = 'Create New Group';
            createGroupFields.style.display = 'block';
            joinGroupFields.style.display = 'none';
            groupModal.classList.add('active');
            document.getElementById('groupName').focus();
        });
    }

    if (joinGroupBtn) {
        joinGroupBtn.addEventListener('click', () => {
            modalTitle.textContent = 'Join Group';
            createGroupFields.style.display = 'none';
            joinGroupFields.style.display = 'block';
            groupModal.classList.add('active');
            document.getElementById('groupCode').focus();
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            groupModal.classList.remove('active');
            groupForm.reset();
        });

        // Close modal when clicking outside
        groupModal.addEventListener('click', (e) => {
            if (e.target === groupModal) {
                groupModal.classList.remove('active');
                groupForm.reset();
            }
        });
    }

    // Handle form submission
    if (groupForm) {
        const groupNameInput = document.getElementById('groupName');
        const groupCodeInput = document.getElementById('groupCode');

        // Add input validation
        groupNameInput.addEventListener('input', () => {
            if (groupNameInput.value.length < 3) {
                groupNameInput.setCustomValidity('Group name must be at least 3 characters long');
            } else {
                groupNameInput.setCustomValidity('');
            }
        });

        groupCodeInput.addEventListener('input', (e) => {
            // Remove any non-numeric characters
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            
            if (e.target.value.length !== 6) {
                groupCodeInput.setCustomValidity('Group code must be exactly 6 digits');
            } else {
                groupCodeInput.setCustomValidity('');
            }
        });

        groupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const isCreating = createGroupFields.style.display === 'block';
            const submitBtn = groupForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            
            try {
                if (isCreating) {
                    const groupName = groupNameInput.value.trim();
                    if (groupName.length < 3) {
                        throw new Error('Group name must be at least 3 characters long');
                    }
                    const groupCode = await createGroup(groupName);
                    alert(`Group created! Your group code is: ${groupCode}`);
                } else {
                    const groupCode = groupCodeInput.value.trim();
                    if (!/^\d{6}$/.test(groupCode)) {
                        throw new Error('Invalid group code. Must be exactly 6 digits');
                    }
                    const group = await joinGroup(groupCode);
                    alert(`Successfully joined group: ${group.name}`);
                }
                
                groupModal.classList.remove('active');
                groupForm.reset();
                await loadGroups(); // Refresh the groups list
                
            } catch (error) {
                alert(error.message);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // Load groups when page loads
    try {
        await loadGroups();
    } catch (error) {
        console.error('Error loading initial groups:', error);
    }
});

