import React, { useRef, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

// Make sure you don't have trailing slashes
const API_URL = process.env.REACT_APP_API_URL || 'https://instantboard.onrender.com';

// Utility functions
const generateRandomName = () => {
  const adjectives = ['Creative', 'Brilliant', 'Amazing', 'Fantastic', 'Wonderful', 'Awesome', 'Super', 'Cool'];
  const nouns = ['Artist', 'Designer', 'Creator', 'Maker', 'Builder', 'Innovator', 'Dreamer', 'Visionary'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
};

const generateRandomColor = () => {
  const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Grid snap utility
const snapToGrid = (point, gridSize = 20) => {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  };
};

// Toast notification component
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  );
};

// Sticky Note Component
const StickyNote = ({ note, onUpdate, onDelete, isDragging, onDragStart }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(note.text);

  const handleSave = () => {
    onUpdate(note.id, { ...note, text });
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div
      className={`sticky-note ${isDragging ? 'dragging' : ''}`}
      style={{
        left: note.x,
        top: note.y,
        background: note.color
      }}
      onMouseDown={(e) => onDragStart(e, note.id)}
    >
      <div className="sticky-note-header">
        <span className="sticky-note-time">{formatTime(note.createdAt)}</span>
        <button
          className="sticky-note-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
        >
          ×
        </button>
      </div>
      
      {isEditing ? (
        <textarea
          className="sticky-note-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          autoFocus
          placeholder="Type your note..."
        />
      ) : (
        <div
          className="sticky-note-content"
          onClick={() => setIsEditing(true)}
        >
          {note.text || 'Click to edit...'}
        </div>
      )}
      
      <div className="sticky-note-author">- {note.author}</div>
    </div>
  );
};

// Comment Component
const Comment = ({ comment, onDelete }) => {
  return (
    <div className="comment-marker" style={{ left: comment.x, top: comment.y }}>
      <div className="comment-icon">💬</div>
      <div className="comment-popup">
        <div className="comment-header">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-time">{formatTime(comment.createdAt)}</span>
          <button
            className="comment-delete"
            onClick={() => onDelete(comment.id)}
          >
            ×
          </button>
        </div>
        <div className="comment-text">{comment.text}</div>
      </div>
    </div>
  );
};

// Text Editor Modal Component
const TextEditor = ({ isOpen, onClose, onSave, initialText = '', position }) => {
  const [text, setText] = useState(initialText);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [textAlign, setTextAlign] = useState('left');

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const handleSave = () => {
    onSave({
      text,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textAlign,
      position
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="text-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Text</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="text-editor-content">
          <div className="text-controls">
            <div className="control-group">
              <label>Font Family:</label>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
              </select>
            </div>

            <div className="control-group">
              <label>Font Size:</label>
              <input
                type="range"
                min="12"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span>{fontSize}px</span>
            </div>

            <div className="control-group">
              <label>Style:</label>
              <div className="style-buttons">
                <button
                  className={`style-btn ${fontWeight === 'bold' ? 'active' : ''}`}
                  onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                >
                  <b>B</b>
                </button>
                <button
                  className={`style-btn ${fontStyle === 'italic' ? 'active' : ''}`}
                  onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                >
                  <i>I</i>
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>Align:</label>
              <div className="align-buttons">
                <button
                  className={`style-btn ${textAlign === 'left' ? 'active' : ''}`}
                  onClick={() => setTextAlign('left')}
                >
                  ⬅️
                </button>
                <button
                  className={`style-btn ${textAlign === 'center' ? 'active' : ''}`}
                  onClick={() => setTextAlign('center')}
                >
                  ↔️
                </button>
                <button
                  className={`style-btn ${textAlign === 'right' ? 'active' : ''}`}
                  onClick={() => setTextAlign('right')}
                >
                  ➡️
                </button>
              </div>
            </div>
          </div>

          <textarea
            className="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here..."
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight,
              fontStyle,
              textAlign
            }}
          />

          <div className="text-editor-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Add Text</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Comment Modal Component
const CommentModal = ({ isOpen, onClose, onSave, position }) => {
  const [text, setText] = useState('');

  const handleSave = () => {
    if (text.trim()) {
      onSave({
        text: text.trim(),
        position
      });
      setText('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Comment</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="comment-modal-content">
          <textarea
            className="comment-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your comment..."
            autoFocus
          />

          <div className="comment-modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Add Comment</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// User Cursor Component
const UserCursor = ({ user, position }) => {
  return (
    <div 
      className="user-cursor" 
      style={{ 
        left: position.x, 
        top: position.y,
        color: user.color 
      }}
    >
      <div 
        className="cursor-pointer" 
        style={{ borderColor: `${user.color} transparent transparent ${user.color}` }}
      ></div>
      <div 
        className="cursor-label" 
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  // State management
  const [boardId, setBoardId] = useState('');
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [user, setUser] = useState({ 
    name: generateRandomName(), 
    color: generateRandomColor() 
  });
  const [users, setUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0 });
  
  // Drawing state
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [background, setBackground] = useState('#ffffff');
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStartPoint, setShapeStartPoint] = useState({ x: 0, y: 0 });
  const [currentShapePreview, setCurrentShapePreview] = useState(null);
  const [boardActions, setBoardActions] = useState([]);
  
  // New feature states
  const [stickyNotes, setStickyNotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [userCursors, setUserCursors] = useState({});
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false);
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Canvas state
  const [canvasSize, setCanvasSize] = useState({ width: 3000, height: 2000 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Refs
  const canvasRef = useRef();
  const socketRef = useRef();
  const drawing = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef();

  // Color palettes
  const colorPalettes = {
    basic: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
    professional: ['#1a1a1a', '#4a4a4a', '#737373', '#a3a3a3', '#d4d4d8', '#f4f4f5', '#fafafa', '#ffffff'],
    vibrant: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6'],
    pastels: ['#fecaca', '#fed7aa', '#fde68a', '#fef3c7', '#d9f99d', '#bbf7d0', '#a7f3d0', '#99f6e4'],
    neon: ['#ff006e', '#fb5607', '#ffbe0b', '#8ecae6', '#219ebc', '#023047', '#8b5cf6', '#a855f7']
  };

  const [selectedPalette, setSelectedPalette] = useState('basic');

  // Sticky note colors
  const stickyColors = ['#ffeb3b', '#ff9800', '#4caf50', '#2196f3', '#9c27b0', '#f44336', '#00bcd4', '#8bc34a'];

  // Utility functions - DEFINED FIRST
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Drawing functions
  const drawAction = useCallback((ctx, action) => {
    if (!ctx) return;

    ctx.save();
    
    switch (action.type) {
      case 'pen':
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(action.from.x, action.from.y);
        ctx.lineTo(action.to.x, action.to.y);
        ctx.stroke();
        break;
      
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = action.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(action.from.x, action.from.y);
        ctx.lineTo(action.to.x, action.to.y);
        ctx.stroke();
        break;
      
      case 'rectangle':
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
        ctx.strokeRect(action.from.x, action.from.y, action.to.x - action.from.x, action.to.y - action.from.y);
        break;
      
      case 'circle':
        const radius = Math.sqrt(Math.pow(action.to.x - action.from.x, 2) + Math.pow(action.to.y - action.from.y, 2));
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
        ctx.beginPath();
        ctx.arc(action.from.x, action.from.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      
      case 'line':
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(action.from.x, action.from.y);
        ctx.lineTo(action.to.x, action.to.y);
        ctx.stroke();
        break;
      
      case 'text':
        ctx.fillStyle = action.color;
        ctx.font = `${action.fontWeight} ${action.fontStyle} ${action.fontSize}px ${action.fontFamily}`;
        ctx.textAlign = action.textAlign;
        
        const lines = action.text.split('\n');
        const lineHeight = action.fontSize * 1.2;
        lines.forEach((line, index) => {
          ctx.fillText(line, action.from.x, action.from.y + (index * lineHeight));
        });
        break;
      
      default:
        break;
    }
    
    ctx.restore();
  }, []);

  // History management
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      imageData,
      actions: [...boardActions],
      stickyNotes: [...stickyNotes],
      comments: [...comments]
    });
    
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    
    setHistory(newHistory);
  }, [history, historyIndex, boardActions, stickyNotes, comments]);

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      
      setBoardActions(state.actions);
      setStickyNotes(state.stickyNotes);
      setComments(state.comments);
      setHistoryIndex(newIndex);
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = state.imageData;
      
      showToast('Undone', 'info');
    }
  }, [historyIndex, history, showToast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      
      setBoardActions(state.actions);
      setStickyNotes(state.stickyNotes);
      setComments(state.comments);
      setHistoryIndex(newIndex);
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = state.imageData;
      
      showToast('Redone', 'info');
    }
  }, [historyIndex, history, showToast]);

  // Initialize board
  useEffect(() => {
    const initializeBoard = async () => {
      let id = window.location.pathname.split('/board/')[1];
      
      if (!id) {
        try {
          const response = await fetch(`${API_URL}/api/board`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: boardTitle })
          });
          const data = await response.json();
          setBoardId(data.id);
          setBoardTitle(data.title);
          window.history.replaceState({}, '', `/board/${data.id}`);
        } catch (error) {
          showToast('Failed to create board', 'error');
        }
      } else {
        setBoardId(id);
        try {
          const response = await fetch(`${API_URL}/api/board/${id}`);
          if (response.ok) {
            const data = await response.json();
            setBoardTitle(data.title);
          }
        } catch (error) {
          showToast('Failed to load board', 'error');
        }
      }
      setLoading(false);
    };

    initializeBoard();
  }, [boardTitle, showToast]);

  // Dark mode effect
  useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : '';
    if (darkMode && background === '#ffffff') {
      setBackground('#1a1a1a');
      setColor('#ffffff');
    } else if (!darkMode && background === '#1a1a1a') {
      setBackground('#ffffff');
      setColor('#000000');
    }
  }, [darkMode, background]);

  // Socket connection
  useEffect(() => {
    if (!boardId) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-board', { boardId, user });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('board-init', (data) => {
      setBoardTitle(data.board.title);
      setIsOwner(data.isOwner);
      if (data.board.settings) {
        setBackground(data.board.settings.background || '#ffffff');
      }
      setBoardActions(data.board.data || []);
      setStickyNotes(data.board.stickyNotes || []);
      setComments(data.board.comments || []);
      
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && data.board.data) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        data.board.data.forEach(action => drawAction(ctx, action));
      }
    });

    socket.on('users-update', (usersList) => {
      setUsers(usersList);
    });

    socket.on('draw-action', (action) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        drawAction(ctx, action);
        setBoardActions(prev => [...prev, action]);
      }
    });

    socket.on('sticky-note-added', (note) => {
      setStickyNotes(prev => [...prev, note]);
    });

    socket.on('sticky-note-updated', (note) => {
      setStickyNotes(prev => prev.map(n => n.id === note.id ? note : n));
    });

    socket.on('sticky-note-deleted', (noteId) => {
      setStickyNotes(prev => prev.filter(n => n.id !== noteId));
    });

    socket.on('comment-added', (comment) => {
      setComments(prev => [...prev, comment]);
    });

    socket.on('comment-deleted', (commentId) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
    });

    socket.on('user-cursor', (data) => {
      setUserCursors(prev => ({
        ...prev,
        [data.userId]: data.position
      }));
    });

    socket.on('board-cleared', () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setBoardActions([]);
      setStickyNotes([]);
      setComments([]);
      showToast('Board cleared', 'info');
    });

    socket.on('owner-status', (data) => {
      setIsOwner(data.isOwner);
      if (data.isOwner) {
        showToast('You are now the board owner', 'success');
      }
    });

    socket.on('error', (error) => {
      showToast(error.message, 'error');
    });

    return () => {
      socket.disconnect();
    };
  }, [boardId, user, drawAction, showToast]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      canvas.style.background = background;
      
      const ctx = canvas.getContext('2d');
      if (ctx && boardActions.length > 0) {
        boardActions.forEach(action => drawAction(ctx, action));
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [background, boardActions, drawAction, canvasSize]);

  // Grid drawing
  useEffect(() => {
    if (!showGrid) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.strokeStyle = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [showGrid, gridSize, darkMode]);

  // Event handlers
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    
    if (snapToGridEnabled) {
      point = snapToGrid(point, gridSize);
    }
    
    return point;
  }, [snapToGridEnabled, gridSize]);

  const handleMouseMove = useCallback((e) => {
    if (socketRef.current && isConnected) {
      const point = getCanvasPos(e);
      socketRef.current.emit('cursor-move', {
        boardId,
        userId: user.id || `${user.name}-${Date.now()}`,
        position: point
      });
    }
  }, [boardId, user, isConnected, getCanvasPos]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const point = getCanvasPos(e);
    
    if (tool === 'text') {
      setTextPosition(point);
      setTextEditorOpen(true);
      return;
    }
    
    if (tool === 'comment') {
      setCommentPosition(point);
      setCommentModalOpen(true);
      return;
    }
    
    if (tool === 'sticky-note') {
      const newNote = {
        id: Date.now(),
        x: point.x,
        y: point.y,
        text: '',
        color: stickyColors[Math.floor(Math.random() * stickyColors.length)],
        author: user.name,
        createdAt: Date.now()
      };
      
      setStickyNotes(prev => [...prev, newNote]);
      socketRef.current?.emit('sticky-note-added', { boardId, note: newNote });
      saveToHistory();
      return;
    }
    
    if (['rectangle', 'circle', 'line'].includes(tool)) {
      setIsDrawingShape(true);
      setShapeStartPoint(point);
      return;
    }
    
    drawing.current = true;
    lastPoint.current = point;
  }, [tool, getCanvasPos, user, boardId, stickyColors, saveToHistory]);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    handleMouseMove(e);
    
    const newPoint = getCanvasPos(e);
    
    if (isDrawingShape && ['rectangle', 'circle', 'line'].includes(tool)) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      boardActions.forEach(action => drawAction(ctx, action));
      
      const previewAction = {
        type: tool,
        color,
        size,
        from: shapeStartPoint,
        to: newPoint
      };
      
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.7;
      drawAction(ctx, previewAction);
      ctx.restore();
      
      setCurrentShapePreview(previewAction);
      return;
    }
    
    if (!drawing.current) return;
    
    const action = {
      type: tool,
      color,
      size,
      from: lastPoint.current,
      to: newPoint,
      id: Date.now()
    };
    
    drawAction(canvasRef.current.getContext('2d'), action);
    socketRef.current?.emit('draw-action', { boardId, action });
    setBoardActions(prev => [...prev, action]);
    
    lastPoint.current = newPoint;
  }, [tool, color, size, boardId, getCanvasPos, drawAction, isDrawingShape, shapeStartPoint, boardActions, handleMouseMove]);

  const handlePointerUp = useCallback(() => {
    if (isDrawingShape && currentShapePreview) {
      const finalAction = {
        ...currentShapePreview,
        id: Date.now()
      };
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      boardActions.forEach(action => drawAction(ctx, action));
      
      ctx.save();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      drawAction(ctx, finalAction);
      ctx.restore();
      
      socketRef.current?.emit('draw-action', { boardId, action: finalAction });
      setBoardActions(prev => [...prev, finalAction]);
      
      setIsDrawingShape(false);
      setCurrentShapePreview(null);
      saveToHistory();
      return;
    }
    
    if (drawing.current) {
      saveToHistory();
    }
    
    drawing.current = false;
  }, [isDrawingShape, currentShapePreview, boardId, drawAction, boardActions, saveToHistory]);

  // Sticky note drag handlers
  const handleStickyNoteDragStart = useCallback((e, noteId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    
    setDraggedNote(noteId);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    document.addEventListener('mousemove', handleStickyNoteDrag);
    document.addEventListener('mouseup', handleStickyNoteDragEnd);
  }, [stickyNotes]);

  const handleStickyNoteDrag = useCallback((e) => {
    if (!draggedNote) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    let newX = e.clientX - canvasRect.left - dragOffset.x;
    let newY = e.clientY - canvasRect.top - dragOffset.y;
    
    if (snapToGridEnabled) {
      const snapped = snapToGrid({ x: newX, y: newY }, gridSize);
      newX = snapped.x;
      newY = snapped.y;
    }
    
    setStickyNotes(prev => prev.map(note => 
      note.id === draggedNote 
        ? { ...note, x: Math.max(0, newX), y: Math.max(0, newY) }
        : note
    ));
  }, [draggedNote, dragOffset, snapToGridEnabled, gridSize]);

  const handleStickyNoteDragEnd = useCallback(() => {
    if (draggedNote) {
      const note = stickyNotes.find(n => n.id === draggedNote);
      if (note) {
        socketRef.current?.emit('sticky-note-updated', { boardId, note });
      }
      saveToHistory();
    }
    
    setDraggedNote(null);
    setDragOffset({ x: 0, y: 0 });
    
    document.removeEventListener('mousemove', handleStickyNoteDrag);
    document.removeEventListener('mouseup', handleStickyNoteDragEnd);
  }, [draggedNote, stickyNotes, boardId, saveToHistory]);

  const handleClear = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the entire board?')) {
      socketRef.current?.emit('clear-board', { boardId });
      saveToHistory();
    }
  }, [boardId, saveToHistory]);

  const copyBoardLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Board link copied to clipboard!', 'success');
    } catch (error) {
      showToast('Failed to copy link', 'error');
    }
  }, [showToast]);

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `${boardTitle}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showToast('Board downloaded!', 'success');
  }, [boardTitle, showToast]);

  const handleTextSave = useCallback((textData) => {
    const action = {
      type: 'text',
      color,
      from: textData.position,
      text: textData.text,
      fontSize: textData.fontSize,
      fontFamily: textData.fontFamily,
      fontWeight: textData.fontWeight,
      fontStyle: textData.fontStyle,
      textAlign: textData.textAlign,
      id: Date.now()
    };
    
    drawAction(canvasRef.current.getContext('2d'), action);
    socketRef.current?.emit('draw-action', { boardId, action });
    setBoardActions(prev => [...prev, action]);
    saveToHistory();
  }, [color, boardId, drawAction, saveToHistory]);

  const handleCommentSave = useCallback((commentData) => {
    const comment = {
      id: Date.now(),
      x: commentData.position.x,
      y: commentData.position.y,
      text: commentData.text,
      author: user.name,
      createdAt: Date.now()
    };
    
    setComments(prev => [...prev, comment]);
    socketRef.current?.emit('comment-added', { boardId, comment });
    saveToHistory();
  }, [user, boardId, saveToHistory]);

  const handleStickyNoteUpdate = useCallback((noteId, updatedNote) => {
    setStickyNotes(prev => prev.map(note => 
      note.id === noteId ? updatedNote : note
    ));
    socketRef.current?.emit('sticky-note-updated', { boardId, note: updatedNote });
    saveToHistory();
  }, [boardId, saveToHistory]);

  const handleStickyNoteDelete = useCallback((noteId) => {
    setStickyNotes(prev => prev.filter(note => note.id !== noteId));
    socketRef.current?.emit('sticky-note-deleted', { boardId, noteId });
    saveToHistory();
  }, [boardId, saveToHistory]);

  const handleCommentDelete = useCallback((commentId) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId));
    socketRef.current?.emit('comment-deleted', { boardId, commentId });
    saveToHistory();
  }, [boardId, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 's':
            e.preventDefault();
            downloadCanvas();
            break;
          case 'g':
            e.preventDefault();
            setShowGrid(!showGrid);
            break;
          default:
            break;
        }
      }
      
      switch (e.key) {
        case 'p':
          setTool('pen');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 't':
          setTool('text');
          break;
        case 'r':
          setTool('rectangle');
          break;
        case 'c':
          setTool('circle');
          break;
        case 'l':
          setTool('line');
          break;
        case 'n':
          setTool('sticky-note');
          break;
        case 'm':
          setTool('comment');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [undo, redo, downloadCanvas, showGrid]);

  // Tools data
  const tools = [
    { id: 'pen', name: 'Pen', icon: '✏️', shortcut: 'P' },
    { id: 'eraser', name: 'Eraser', icon: '🧹', shortcut: 'E' },
    { id: 'line', name: 'Line', icon: '📏', shortcut: 'L' },
    { id: 'rectangle', name: 'Rectangle', icon: '⬜', shortcut: 'R' },
    { id: 'circle', name: 'Circle', icon: '⭕', shortcut: 'C' },
    { id: 'text', name: 'Text', icon: 'T', shortcut: 'T' },
    { id: 'sticky-note', name: 'Sticky Note', icon: '📝', shortcut: 'N' },
    { id: 'comment', name: 'Comment', icon: '💬', shortcut: 'M' }
  ];

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <img src="/logoh.png" alt="Logo" className="logo-image" style={{width: '24px', height: '24px'}} />
            InstantBoard
          </div>
          <div className="board-title">{boardTitle}</div>
        </div>
        
        <div className="header-center">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>

        <div className="header-right">
          <button
            className={`tool-button ${darkMode ? 'active' : ''}`}
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <div className="user-count">
            👥 {users.length}
          </div>
          <button 
            className="tool-button"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
          >
            ☰
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="tool-group">
          {tools.map(toolItem => (
            <button
              key={toolItem.id}
              className={`tool-button ${tool === toolItem.id ? 'active' : ''}`}
              onClick={() => setTool(toolItem.id)}
              title={`${toolItem.name} (${toolItem.shortcut})`}
              data-tool={toolItem.id}
            >
              <span>{toolItem.icon}</span>
              <span className="hidden md:inline">{toolItem.name}</span>
            </button>
          ))}
        </div>

        <div className="tool-group">
          <button
            className={`tool-button ${historyIndex > 0 ? '' : 'disabled'}`}
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className={`tool-button ${historyIndex < history.length - 1 ? '' : 'disabled'}`}
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
        </div>

        <div className="tool-group">
          <label className="text-sm font-medium">Palette:</label>
          <select 
            value={selectedPalette} 
            onChange={(e) => setSelectedPalette(e.target.value)}
            className="palette-selector"
          >
            <option value="basic">Basic</option>
            <option value="professional">Professional</option>
            <option value="vibrant">Vibrant</option>
            <option value="pastels">Pastels</option>
            <option value="neon">Neon</option>
          </select>
        </div>

        <div className="tool-group color-picker">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-input"
            title="Pick custom color"
          />
          <div className="color-palette">
            {colorPalettes[selectedPalette].map(paletteColor => (
              <button
                key={paletteColor}
                className={`color-swatch ${color === paletteColor ? 'active' : ''}`}
                style={{ backgroundColor: paletteColor }}
                onClick={() => setColor(paletteColor)}
                title={paletteColor}
              />
            ))}
          </div>
        </div>

        <div className="tool-group size-slider">
          <label className="text-sm font-medium">Size</label>
          <input
            type="range"
            min="1"
            max="50"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="slider"
          />
          <span className="text-sm">{size}px</span>
        </div>

        <div className="tool-group">
          <button
            className={`tool-button ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid (Ctrl+G)"
          >
            ⊞ Grid
          </button>
          <button
            className={`tool-button ${snapToGridEnabled ? 'active' : ''}`}
            onClick={() => setSnapToGridEnabled(!snapToGridEnabled)}
            title="Snap to grid"
          >
            🧲 Snap
          </button>
        </div>

        <div className="tool-group">
          <button
            className="tool-button"
            onClick={handleClear}
            disabled={!isOwner}
            title={isOwner ? "Clear board" : "Only owner can clear"}
          >
            🗑️ Clear
          </button>
          <button
            className="tool-button"
            onClick={downloadCanvas}
            title="Download as PNG (Ctrl+S)"
          >
            💾 Save
          </button>
        </div>
      </div>

      <div ref={canvasContainerRef} className="canvas-container scrollable">
        <canvas
          ref={canvasRef}
          className={`whiteboard-canvas scrollable ${tool === 'eraser' ? 'eraser-mode' : ''} ${isDrawingShape ? 'drawing-shape' : ''}`}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          style={{ 
            touchAction: 'none', 
            background,
            cursor: tool === 'sticky-note' ? 'copy' : tool === 'comment' ? 'help' : tool === 'text' ? 'text' : 'crosshair'
          }}
          data-tool={tool}
        />

        {stickyNotes.map(note => (
          <StickyNote
            key={note.id}
            note={note}
            onUpdate={handleStickyNoteUpdate}
            onDelete={handleStickyNoteDelete}
            isDragging={draggedNote === note.id}
            onDragStart={handleStickyNoteDragStart}
          />
        ))}

        {comments.map(comment => (
          <Comment
            key={comment.id}
            comment={comment}
            onDelete={handleCommentDelete}
          />
        ))}

        {Object.entries(userCursors).map(([userId, position]) => {
          const cursorUser = users.find(u => u.id === userId);
          if (!cursorUser || userId === user.id) return null;
          return (
            <UserCursor
              key={userId}
              user={cursorUser}
              position={position}
            />
          );
        })}
      </div>

      <TextEditor
        isOpen={textEditorOpen}
        onClose={() => setTextEditorOpen(false)}
        onSave={handleTextSave}
        position={textPosition}
      />

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleCommentSave}
        position={commentPosition}
      />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">Board Controls</h3>
          <button 
            className="close-button"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="sidebar-content">
          <div className="stats-section">
            <h4 className="section-title">Board Stats</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{boardActions.length}</span>
                <span className="stat-label">Drawing Actions</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stickyNotes.length}</span>
                <span className="stat-label">Sticky Notes</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{comments.length}</span>
                <span className="stat-label">Comments</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{history.length}</span>
                <span className="stat-label">History Items</span>
              </div>
            </div>
          </div>

          <div className="canvas-controls-section">
            <h4 className="section-title">Canvas Controls</h4>
            <div className="control-item">
              <label>Grid Size:</label>
              <input
                type="range"
                min="10"
                max="50"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
              />
              <span>{gridSize}px</span>
            </div>
            <div className="control-item">
              <label>Canvas Width:</label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="100"
                value={canvasSize.width}
                onChange={(e) => setCanvasSize(prev => ({ ...prev, width: Number(e.target.value) }))}
              />
              <span>{canvasSize.width}px</span>
            </div>
            <div className="control-item">
              <label>Canvas Height:</label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="100"
                value={canvasSize.height}
                onChange={(e) => setCanvasSize(prev => ({ ...prev, height: Number(e.target.value) }))}
              />
              <span>{canvasSize.height}px</span>
            </div>
          </div>

          <div className="users-section">
            <h4 className="section-title">Active Users ({users.length})</h4>
            <div className="users-list">
              {users.map(userData => (
                <div key={userData.id} className="user-item">
                  <div 
                    className="user-avatar"
                    style={{ backgroundColor: userData.color }}
                  >
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{userData.name}</div>
                    <div className="user-status">
                      {userData.joinedAt && `Joined ${formatTime(userData.joinedAt)}`}
                    </div>
                  </div>
                  <div className="user-online"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="share-section">
            <h4 className="section-title">Share Board</h4>
            <div className="share-buttons">
              <button 
                className="share-button primary"
                onClick={copyBoardLink}
              >
                🔗 Copy Link
              </button>
              <button 
                className="share-button"
                onClick={() => setShowQRModal(true)}
              >
                📱 Show QR Code
              </button>
            </div>
          </div>

          {isOwner && (
            <div className="settings-section">
              <h4 className="section-title">Board Settings</h4>
              <div className="setting-item">
                <label className="text-sm font-medium">Background Color</label>
                <input
                  type="color"
                  value={background}
                  onChange={(e) => {
                    setBackground(e.target.value);
                    socketRef.current?.emit('update-board-settings', {
                      boardId,
                      settings: { background: e.target.value }
                    });
                  }}
                  className="color-input"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Share via QR Code</h3>
              <button 
                className="close-button"
                onClick={() => setShowQRModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="qr-container">
              <div className="qr-code">
                <QRCodeSVG 
                  value={window.location.href} 
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="share-url">{window.location.href}</p>
              <button 
                className="share-button primary"
                onClick={copyBoardLink}
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      <button 
        className="fab"
        onClick={() => setSidebarOpen(true)}
        style={{ display: sidebarOpen ? 'none' : 'flex' }}
      >
        👥
      </button>

      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
}

export default App;