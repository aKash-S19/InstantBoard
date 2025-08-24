const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://instant-board.vercel.app',  // Your current frontend URL
    'https://instantboard.vercel.app'    // Add without dash as backup
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: [
      'http://localhost:3000',
      'https://instant-board.vercel.app',  // Your current frontend URL
      'https://instantboard.vercel.app'    // Add without dash as backup
    ],
    methods: ['GET', 'POST'],
    credentials: true
  } 
});

// Store boards in memory (use Redis/DB for production)
const boards = {};
const boardPasswords = {};

// Cleanup old boards (24-48 hours)
function cleanupBoards() {
  const now = Date.now();
  const CLEANUP_TIME = 48 * 60 * 60 * 1000; // 48 hours
  
  Object.keys(boards).forEach(boardId => {
    if (boards[boardId] && (now - boards[boardId].createdAt) > CLEANUP_TIME) {
      console.log(`Cleaning up board ${boardId}`);
      delete boards[boardId];
      delete boardPasswords[boardId];
    }
  });
}

// Run cleanup every hour
setInterval(cleanupBoards, 60 * 60 * 1000);

// API Routes
app.post('/api/board', (req, res) => {
  const boardId = uuidv4().slice(0, 12);
  const { password, title } = req.body;
  
  boards[boardId] = {
    id: boardId,
    title: title || 'Untitled Board',
    data: [],
    users: {},
    createdAt: Date.now(),
    lastActivity: Date.now(),
    owner: null,
    settings: {
      background: '#ffffff',
      gridEnabled: true
    }
  };
  
  if (password) {
    boardPasswords[boardId] = password;
  }
  
  res.json({ 
    id: boardId,
    title: boards[boardId].title,
    hasPassword: !!password 
  });
});

app.get('/api/board/:id', (req, res) => {
  const { id } = req.params;
  const board = boards[id];
  
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }
  
  res.json({ 
    id: board.id,
    title: board.title,
    data: board.data,
    settings: board.settings,
    hasPassword: !!boardPasswords[id],
    userCount: Object.keys(board.users).length,
    lastActivity: board.lastActivity
  });
});

app.post('/api/board/:id/join', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const board = boards[id];
  
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }
  
  if (boardPasswords[id] && boardPasswords[id] !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  res.json({ success: true });
});

app.get('/api/board', (req, res) => {
  res.json({ message: 'Board API working', status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date().toISOString() });
});

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'InstantBoard Backend API', version: '1.0.0' });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join-board', ({ boardId, user, password }) => {
    const board = boards[boardId];
    
    if (!board) {
      socket.emit('error', { message: 'Board not found' });
      return;
    }
    
    // Check password if required
    if (boardPasswords[boardId] && boardPasswords[boardId] !== password) {
      socket.emit('error', { message: 'Invalid password' });
      return;
    }
    
    // Join the board room
    socket.join(boardId);
    socket.boardId = boardId;
    socket.userId = socket.id;
    
    // Add user to board
    board.users[socket.id] = {
      id: socket.id,
      name: user.name,
      color: user.color,
      cursor: { x: 0, y: 0 },
      joinedAt: Date.now()
    };
    
    // Set owner if first user
    if (!board.owner) {
      board.owner = socket.id;
      socket.emit('owner-status', { isOwner: true });
    }
    
    // Send initial board data
    socket.emit('board-init', {
      board: {
        id: board.id,
        title: board.title,
        data: board.data,
        settings: board.settings
      },
      isOwner: board.owner === socket.id
    });
    
    // Broadcast user list to all users in the board
    io.to(boardId).emit('users-update', Object.values(board.users));
    
    console.log(`User ${user.name} joined board ${boardId}`);
  });
  
  socket.on('draw-action', ({ boardId, action }) => {
    const board = boards[boardId];
    if (!board) return;
    
    // Add timestamp and user info
    action.id = uuidv4();
    action.timestamp = Date.now();
    action.userId = socket.id;
    
    // Store the action
    board.data.push(action);
    board.lastActivity = Date.now();
    
    // Broadcast to other users
    socket.to(boardId).emit('draw-action', action);
  });
  
  socket.on('cursor-move', ({ boardId, cursor }) => {
    const board = boards[boardId];
    if (!board || !board.users[socket.id]) return;
    
    board.users[socket.id].cursor = cursor;
    
    // Broadcast cursor position to other users
    socket.to(boardId).emit('cursor-update', {
      userId: socket.id,
      user: board.users[socket.id],
      cursor
    });
  });
  
  socket.on('clear-board', ({ boardId }) => {
    const board = boards[boardId];
    if (!board) return;
    
    // Only owner or admin can clear
    if (board.owner !== socket.id) {
      socket.emit('error', { message: 'Only board owner can clear the board' });
      return;
    }
    
    board.data = [];
    board.lastActivity = Date.now();
    
    io.to(boardId).emit('board-cleared');
  });
  
  socket.on('update-board-settings', ({ boardId, settings }) => {
    const board = boards[boardId];
    if (!board) return;
    
    // Only owner can update settings
    if (board.owner !== socket.id) {
      socket.emit('error', { message: 'Only board owner can update settings' });
      return;
    }
    
    board.settings = { ...board.settings, ...settings };
    board.lastActivity = Date.now();
    
    io.to(boardId).emit('settings-update', board.settings);
  });
  
  socket.on('add-sticky-note', ({ boardId, note }) => {
    const board = boards[boardId];
    if (!board) return;
    
    const noteAction = {
      id: uuidv4(),
      type: 'sticky-note',
      ...note,
      timestamp: Date.now(),
      userId: socket.id
    };
    
    board.data.push(noteAction);
    board.lastActivity = Date.now();
    
    io.to(boardId).emit('sticky-note-added', noteAction);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const boardId = socket.boardId;
    const board = boards[boardId];
    
    if (board && board.users[socket.id]) {
      delete board.users[socket.id];
      
      // Transfer ownership if owner disconnects
      if (board.owner === socket.id) {
        const remainingUsers = Object.keys(board.users);
        board.owner = remainingUsers.length > 0 ? remainingUsers[0] : null;
        
        if (board.owner) {
          io.to(board.owner).emit('owner-status', { isOwner: true });
        }
      }
      
      // Broadcast updated user list
      io.to(boardId).emit('users-update', Object.values(board.users));
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Instant Whiteboard Backend running on port ${PORT}`);
  console.log(`📝 WebSocket server ready for real-time collaboration`);
});