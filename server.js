const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// To store users and their associated socket IDs
let users = {};
let chatMessages = {}; // Clear on each server start
let chatHistory = {}; // Object to store chat history for each user

app.use(express.static('public')); // Serve static files from 'public' folder

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle login event
socket.on('login', ({ username, password }) => {
    if (users[username] && users[username].password === password) {
        // Store socket ID
        users[username].socketId = socket.id;
        socket.username = username; // Store username in socket for later use
        socket.emit('loginSuccess', username);
        // Send the updated user list to all clients
        io.emit('userList', Object.keys(users)); // Consider modifying this if only logged-in users should be listed
        console.log(`${username} logged in with socket ID: ${socket.id}`); // Use backticks for template literals
    } else {
        socket.emit('loginError', 'Invalid username or password.');
    }
});
    // Handle registration event
    socket.on('register', ({ username, password }) => {
        if (users[username]) {
            socket.emit('loginError', 'Username already taken.');
        } else {
            // Register new user
            users[username] = { password, socketId: socket.id }; // Store socket ID on registration
            socket.emit('registerSuccess');
            console.log(`New user registered: ${username} with socket ID: ${socket.id}`);
        }
    });

    // Handle sending a private message
    socket.on('privateMessage', ({ recipient, message }) => {
        // Send the message to the recipient if they are online
        const recipientData = users[recipient];
        if (recipientData && recipientData.socketId) {
            io.to(recipientData.socketId).emit('privateMessage', {
                sender: socket.username,
                message
            });
        }
    
        // Maintain chat history for both users
        if (!chatHistory[socket.username]) {
            chatHistory[socket.username] = [];
        }
        if (!chatHistory[recipient]) {
            chatHistory[recipient] = [];
        }
        if (!chatHistory[socket.username].includes(recipient)) {
            chatHistory[socket.username].push(recipient);
        }
        if (!chatHistory[recipient].includes(socket.username)) {
            chatHistory[recipient].push(socket.username);
        }
    });

    // Handle fetching user list for logged-in users
socket.on('getUserList', () => {
    const interactedUsers = chatHistory[socket.username] || [];
    socket.emit('userList', interactedUsers);
});

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        // Optionally handle removing the user's data from the users object
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});