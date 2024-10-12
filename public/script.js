const socket = io();
let currentUserName = '';
let selectedUser = '';
let isRegistering = false;
let latestMessages = {}; // Object to store latest messages for each user
let latestMessageTime = {}; // Object to store latest message timestamps

// Handle auth logic
document.getElementById('auth-submit').onclick = () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (username && password) {
        if (isRegistering) {
            socket.emit('register', { username, password });
        } else {
            socket.emit('login', { username, password });
        }
    }
};

// Toggle between login/register
document.getElementById('toggle-auth').onclick = () => {
    isRegistering = !isRegistering;
    document.getElementById('auth-title').textContent = isRegistering ? 'Register' : 'Login';
    document.getElementById('auth-submit').textContent = isRegistering ? 'Register' : 'Login';
    document.getElementById('toggle-auth').textContent = isRegistering ? 'Already have an account? Login here.' : "Don't have an account? Register here.";
};

// Handle login response
socket.on('loginSuccess', (username) => {
    currentUserName = username;
    document.getElementById('auth-modal').style.display = 'none';
    document.querySelector('.chat-container').style.display = 'flex';
    socket.emit('setUsername', currentUserName);
});

socket.on('loginError', (msg) => {
    alert(msg);
});

socket.on('registerSuccess', () => {
    alert('Registration successful! Please login.');
    isRegistering = false;
    document.getElementById('auth-title').textContent = 'Login';
    document.getElementById('auth-submit').textContent = 'Login';
    document.getElementById('toggle-auth').textContent = "Don't have an account? Register here.";
});

// Send private message
document.getElementById('send-message').onclick = () => {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();


    if (message && selectedUser) {
        // Display the message in the chat box
        const chatBox = document.getElementById(`chat-box-${selectedUser}`);
        const newMessage = document.createElement('div');
        newMessage.classList.add('message', 'sent');
        newMessage.textContent = message;
        chatBox.appendChild(newMessage);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Scroll to the bottom after adding a new message
        chatBox.scrollTop = chatBox.scrollHeight;

        // Save message to local storage
        saveMessage(currentUserName, selectedUser, message);

        // Update latest message for the recipient
        latestMessages[selectedUser] = { message, unread: false };
        latestMessageTime[selectedUser] = Date.now(); // Update timestamp for the latest message


        // Send message to the server for the selected user
        socket.emit('privateMessage', { recipient: selectedUser, message });
        messageInput.value = ''; // Clear input after sending


        // Update the user list to show the latest message
        updateUserList();
    }
};

// Receive private message
socket.on('privateMessage', ({ sender, message }) => {
    if (sender !== currentUserName) { // Only handle messages from other users

        saveMessage(currentUserName, selectedUser, message, 'sent');
        // Store the latest message for the sender
        latestMessages[sender] = { message, unread: true };
        latestMessageTime[sender] = Date.now(); // Update timestamp for the latest message


        // If the chat with this user is not currently open, we do not display the message
        if (selectedUser !== sender) {
            // Update the user list to show the latest message
            updateUserList();
        } else {
            // If the chat is open, show the message immediately
            let chatBox = document.getElementById(`chat-box-${sender}`);
            if (!chatBox) {
                // Create a new chat box if it doesn't exist
                chatBox = document.createElement('div');
                chatBox.classList.add('chat-box');
                chatBox.id = `chat-box-${sender}`;
                document.querySelector('.chat-window').appendChild(chatBox);
            }


            // Display the received message in the correct chat box
            const newMessage = document.createElement('div');
            newMessage.classList.add('message', 'received');
            newMessage.textContent = `${sender}: ${message}`;
            chatBox.appendChild(newMessage);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }
});

// Mark as read when the user opens a chat
function markAsRead(user) {
    if (latestMessages[user]) {
        latestMessages[user].unread = false; // Mark the message as read
        updateUserList(); // Update the user list to reflect the read status
    }
}


// Function to open chat with a specific user
function openChat(user) {
    selectedUser = user;
    document.getElementById('chat-user').textContent = `Chat with ${user}`;
    // Hide all chat boxes first
    const allChats = document.querySelectorAll('.chat-box');
    allChats.forEach(chat => chat.style.display = 'none');


    // Show the selected user's chat
    let chatBox = document.getElementById(`chat-box-${user}`);
    if (!chatBox) {
        // Create a new chat box if it doesn't exist
        chatBox = document.createElement('div');
        chatBox.classList.add('chat-box');
        chatBox.id = `chat-box-${user}`;
        document.querySelector('.chat-window').appendChild(chatBox);
    }
    chatBox.style.display = 'block';
    document.querySelector('.chat-input').style.display = 'flex'; // Show chat input

    // Display any stored messages and No need to call displayStoredMessages if the chat box already exists
    if (!chatBox.innerHTML) {
        displayStoredMessages(chatBox, user);
    }
    
}

// Display stored messages in the chat box
function displayStoredMessages(chatBox, user) {
    if (latestMessages[user]) {
        const storedMessage = document.createElement('div');
        storedMessage.classList.add('message', 'received');
        storedMessage.textContent = `${user}: ${latestMessages[user].message}`;
        chatBox.appendChild(storedMessage);
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom
    }
}

// Update the user list with latest messages
function updateUserList() {
    const userList = document.getElementById('user-list');
    const users = userList.querySelectorAll('li');
    users.forEach(user => {
        const userName = user.textContent.trim(); // Get username
        if (latestMessages[userName]) {
            user.classList.toggle('unread', latestMessages[userName].unread); // Toggle unread class
        }
    });


    // Re-sort the user list after updating the messages
    const sortedUsers = Array.from(users).sort((a, b) => {
        const aUserName = a.textContent.trim();
        const bUserName = b.textContent.trim();
        return (latestMessageTime[bUserName] || 0) - (latestMessageTime[aUserName] || 0);
    });


    // Clear the current user list and append the sorted users
    userList.innerHTML = '';
    sortedUsers.forEach(userItem => userList.appendChild(userItem));
}

// Handle fetching user list
socket.emit('getUserList');

// Fetch user list on login
socket.on('userList', (users) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';

    const sortedUsers = users.filter(user => user !== currentUserName)
        .sort((a, b) => (latestMessageTime[b] || 0) - (latestMessageTime[a] || 0));

    sortedUsers.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user;
        userItem.onclick = () => {
            openChat(user);
            markAsRead(user);
        };
        userList.appendChild(userItem);
    });
});

// Implement search functionality
document.getElementById('user-search').addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const users = document.querySelectorAll('#user-list li');
    users.forEach(user => {
        const userName = user.textContent.toLowerCase();
        user.style.display = userName.includes(searchTerm) ? 'block' : 'none';
    });
});

// Function to initiate new chat with searched user
function initiateNewChat(username) {
    if (username && !chatHistory[currentUserName].includes(username)) {
        openChat(username);
        latestMessages[username] = { message: '', unread: false }; // Initialize message state for new user
        latestMessageTime[username] = Date.now(); // Set current time
    }
}



// Logout functionality
document.getElementById('logout').onclick = () => {
    location.reload(); // Reload the page to reset
};

// Function to save message to local storage
function saveMessage(sender, recipient, message, type) {
    let storedMessages = JSON.parse(localStorage.getItem('chatMessages')) || {};
    if (!storedMessages[sender]) storedMessages[sender] = {};
    if (!storedMessages[recipient]) storedMessages[recipient] = {};
    
    if (!storedMessages[sender][recipient]) storedMessages[sender][recipient] = [];
    if (!storedMessages[recipient][sender]) storedMessages[recipient][sender] = [];
    
    // Push the message to both sender and recipient's message history
    storedMessages[sender][recipient].push({ sender, message, type });
    storedMessages[recipient][sender].push({ sender, message, type: 'received' }); // Store received messages
    localStorage.setItem('chatMessages', JSON.stringify(storedMessages));
}

// Function to load stored messages from local storage
function loadStoredMessages() {
    const storedMessages = JSON.parse(localStorage.getItem('chatMessages')) || {};
    if (storedMessages[currentUserName]) {
        for (const recipient in storedMessages[currentUserName]) {
            const chatBox = document.getElementById(`chat-box-${recipient}`) || createChatBox(recipient);
            storedMessages[currentUserName][recipient].forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', msg.sender === currentUserName ? 'sent' : 'received');
                messageDiv.textContent = `${msg.sender}: ${msg.message}`;
                chatBox.appendChild(messageDiv);
            });
        }
    }
}

// Call loadStoredMessages after successful login
socket.on('loginSuccess', (username) => {
    currentUserName = username;
    document.getElementById('auth-modal').style.display = 'none';
    document.querySelector('.chat-container').style.display = 'flex';
    socket.emit('setUsername', currentUserName);
    loadStoredMessages(); // Load messages when user logs in
});

function displayStoredMessages(chatBox, user) {
    const storedMessages = JSON.parse(localStorage.getItem('chatMessages')) || {};
    if (storedMessages[currentUserName] && storedMessages[currentUserName][user]) {
        storedMessages[currentUserName][user].forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', msg.sender === currentUserName ? 'sent' : 'received');
            messageDiv.textContent = `${msg.sender}: ${msg.message}`;
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight; // Automatically scroll to the bottom
        });
    }
}