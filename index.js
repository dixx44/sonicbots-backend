"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const cleverbot = require("cleverbot-free");

// --- INLINED LUDO ENGINE ---
const BOARD_SIZE = 52;
const HOME_PATH_LENGTH = 6;
const FINISH_POS = 57;
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];
const PLAYER_START_OFFSETS = [0, 13, 26, 39];
const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const PLAYER_COLOR_HEX = ['#ef4444', '#22c55e', '#eab308', '#3b82f6'];

class LudoGame {
  constructor(roomId, betAmount = 0) {
    this.roomId = roomId;
    this.betAmount = betAmount;
    this.players = [];
    this.state = 'waiting';
    this.pieces = [];
    this.turn = 0;
    this.dice = 1;
    this.diceRolled = false;
    this.consecutiveSixes = 0;
    this.rankings = [];
    this.gameChat = [];
    this.createdAt = Date.now();
    this.inviteCode = roomId;
    this.countdown = null;
  }

  addPlayer(socketId, name, isBot = false, avatar = null) {
    if (this.players.length >= 4) return { error: 'Room full' };
    if (this.state !== 'waiting') return { error: 'Game already started' };
    const existing = this.players.find(p => p.socketId === socketId);
    if (existing) return { error: 'Already in game' };
    const colorIdx = this.players.length;
    this.players.push({ socketId, name, colorIdx, isBot, avatar: avatar || name });
    return { success: true, colorIdx };
  }

  startGame() {
    if (this.players.length < 2) return { error: 'Need at least 2 players' };
    this.state = 'playing';
    this.pieces = this.players.map(() => [-1, -1, -1, -1]);
    this.turn = 0;
    this.diceRolled = false;
    this.consecutiveSixes = 0;
    this.rankings = [];
    return { success: true };
  }

  rollDice(socketId) {
    if (this.state !== 'playing') return { error: 'Game not active' };
    const playerIdx = this.players.findIndex(p => p.socketId === socketId);
    if (playerIdx !== this.turn) return { error: 'Not your turn' };
    if (this.diceRolled) return { error: 'Already rolled' };

    this.dice = Math.floor(Math.random() * 6) + 1;
    this.diceRolled = true;

    if (this.dice === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes >= 3) {
        this.consecutiveSixes = 0;
        this.diceRolled = false;
        this._nextTurn();
        return { dice: this.dice, cancelledTripleSix: true, state: this.serialize() };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    if (this.dice === 6 && this.players[playerIdx].isBot && Math.random() < 0.3) {
      this.addChatMessage(this.players[playerIdx].socketId, "Lucky 6! Here I come! 🎲✨");
    }

    const moves = this._getValidMoves(playerIdx);
    if (moves.length === 0) {
      this.diceRolled = false;
      this._nextTurn();
      return { dice: this.dice, noMoves: true, state: this.serialize() };
    }
    
    if (moves.length === 1 && !this.players[playerIdx].isBot) {
        return { dice: this.dice, state: this.serialize(), autoMovePieceIdx: moves[0] };
    }

    return { dice: this.dice, state: this.serialize() };
  }

  movePiece(socketId, pieceIdx) {
    if (this.state !== 'playing') return { error: 'Game not active' };
    const playerIdx = this.players.findIndex(p => p.socketId === socketId);
    if (playerIdx !== this.turn) return { error: 'Not your turn' };
    if (!this.diceRolled) return { error: 'Roll dice first' };

    const piece = this.pieces[playerIdx][pieceIdx];

    if (!this._canMove(playerIdx, pieceIdx)) {
      return { error: 'Invalid move' };
    }

    let captured = null;

    if (piece === -1) {
      if (this.dice !== 6 && this.dice !== 1) return { error: 'Need 6 or 1 to exit base' };
      this.pieces[playerIdx][pieceIdx] = 0;
    } else {
      const newPos = piece + this.dice;
      if (newPos > FINISH_POS) return { error: 'Exceeds finish – exact number needed' };

      if (newPos === FINISH_POS) {
        this.pieces[playerIdx][pieceIdx] = FINISH_POS;
        if (this.pieces[playerIdx].every(p => p === FINISH_POS) && !this.rankings.includes(playerIdx)) {
          this.rankings.push(playerIdx);

          if (this.rankings.length >= this.players.length - 1) {
            const lastPlayer = this.players.findIndex((p, i) => !this.rankings.includes(i));
            if (lastPlayer !== -1) this.rankings.push(lastPlayer);
            this.state = 'finished';
          }
          return { state: this.serialize(), won: true, rank: this.rankings.length };
        }
      } else if (newPos >= 52) {
        this.pieces[playerIdx][pieceIdx] = newPos;
      } else {
        const globalPos = this._toGlobal(playerIdx, newPos);
        if (!SAFE_POSITIONS.includes(globalPos)) {
          captured = this._checkCapture(playerIdx, globalPos);
          if (captured && this.players[playerIdx].isBot) {
            const attacker = this.players[playerIdx];
            const banters = [
              `Gotcha ${captured.playerName}! Back to base you go! 🚀`,
              `Sorry ${captured.playerName}, nothing personal! 😂`,
              `Target eliminated. ${captured.playerName} is down! 💥`
            ];
            this.addChatMessage(attacker.socketId, banters[Math.floor(Math.random() * banters.length)]);
          }
        }
        this.pieces[playerIdx][pieceIdx] = newPos;
      }
    }

    this.diceRolled = false;

    if (this.dice === 6 && this.state !== 'finished' && !this.rankings.includes(playerIdx)) {
    } else {
      this._nextTurn();
    }

    return {
      state: this.serialize(),
      captured,
      extraTurn: this.dice === 6 && this.state !== 'finished' && !this.rankings.includes(playerIdx)
    };
  }

  _canMove(playerIdx, pieceIdx) {
    const piece = this.pieces[playerIdx][pieceIdx];
    if (piece === FINISH_POS) return false;
    if (piece === -1) return this.dice === 6 || this.dice === 1;
    const newPos = piece + this.dice;
    return newPos <= FINISH_POS;
  }

  _getValidMoves(playerIdx) {
    return this.pieces[playerIdx]
      .map((_, i) => i)
      .filter(i => this._canMove(playerIdx, i));
  }

  _toGlobal(playerIdx, relPos) {
    return (relPos + PLAYER_START_OFFSETS[playerIdx]) % BOARD_SIZE;
  }

  _checkCapture(attackerIdx, globalPos) {
    for (let pIdx = 0; pIdx < this.players.length; pIdx++) {
      if (pIdx === attackerIdx) continue;
      for (let pieceIdx = 0; pieceIdx < 4; pieceIdx++) {
        const pos = this.pieces[pIdx][pieceIdx];
        if (pos < 0 || pos >= 52) continue;
        const enemyGlobal = this._toGlobal(pIdx, pos);
        if (enemyGlobal === globalPos) {
          this.pieces[pIdx][pieceIdx] = -1;
          return { playerIdx: pIdx, pieceIdx, playerName: this.players[pIdx].name };
        }
      }
    }
    return null;
  }

  _nextTurn() {
    let loopCount = 0;
    do {
      this.turn = (this.turn + 1) % this.players.length;
      loopCount++;
    } while (this.rankings.includes(this.turn) && loopCount <= this.players.length);
    this.diceRolled = false;
  }

  addChatMessage(socketId, text) {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return null;
    const safeText = text || "";
    const msg = {
      id: `gc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender: player.name,
      colorIdx: player.colorIdx,
      text: safeText.substring(0, 200),
      timestamp: Date.now()
    };
    this.gameChat.push(msg);
    if (this.gameChat.length > 100) this.gameChat.shift();
    return msg;
  }

  serialize() {
    return {
      roomId: this.roomId,
      inviteCode: this.inviteCode,
      betAmount: this.betAmount,
      players: this.players.map(p => ({
        name: p.name,
        colorIdx: p.colorIdx,
        isBot: p.isBot,
        socketId: p.socketId,
        avatar: p.avatar
      })),
      state: this.state,
      pieces: this.pieces,
      turn: this.turn,
      dice: this.dice,
      diceRolled: this.diceRolled,
      rankings: this.rankings,
      gameChat: this.gameChat.slice(-30),
      consecutiveSixes: this.consecutiveSixes,
      countdown: this.countdown
    };
  }

  resetGame() {
    this.state = 'playing';
    this.pieces = this.players.map(() => [-1, -1, -1, -1]);
    this.turn = 0;
    this.dice = 1;
    this.diceRolled = false;
    this.consecutiveSixes = 0;
    this.rankings = [];
    this.gameChat.push({
      id: `gc_${Date.now()}`,
      sender: 'SYSTEM',
      colorIdx: -1,
      text: '🎮 New game started! Good luck!',
      timestamp: Date.now()
    });
    return { success: true };
  }
}
// --- END INLINED LUDO ENGINE ---

// --- Ludo Globals ---
const ludoRooms = new Map(); // roomId → LudoGame
const activeUsers = new Map(); // socketId → {id, username, status, joinTime}
const ludoNegotiations = new Map(); // socketId_agentId -> {roomId, agentId, state, offer}
const socketRoomMap = new Map(); // socketId → roomId
const communityLobbies = new Map(); // roomId → { roomId, host, players: [], maxPlayers: 4 }
// Timers for community invites: roomId -> Timeout
const inviteTimers = new Map();
const ongoingCalls = new Map(); // socketId -> call object

function broadcastCommunityLobbies() {
    const lobbies = Array.from(communityLobbies.values());
    io.emit('community_ludo_lobbies', lobbies);
}

function generateRoomId() {
    return `LUDO-${Math.random().toString(36).toUpperCase().substr(2, 6)}`;
}

function getLudoRoom(socketId) {
    const roomId = socketRoomMap.get(socketId);
    return roomId ? ludoRooms.get(roomId) : null;
}

function broadcastGameState(game, ioRef) {
    if (!game) return;
    ioRef.to(game.roomId).emit('ludo_state', game.serialize());
}

const cors = require("cors");
const app = express();
app.use(cors({
    origin: true, // Automatically reflect the request origin to satisfy credentials: true
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Bypass-Tunnel-Reminder"],
    credentials: true
}));

// Health-check endpoint (required by Render / Railway to keep service alive)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'AURA-OS', version: '3.0' }));
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'AURA-OS Backend' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Reflect the request origin dynamically or allow wildcard for non-credential requests
            callback(null, origin || "*");
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Bypass-Tunnel-Reminder"],
        credentials: true
    }
});

// Environment variables
require('dotenv').config();

// Local File Persistence Setup
const DB_FILE = path.join(__dirname, "database.json");

let db = {
    users: {},
    messages: [],
    stats: {
        totalMessages: 124502,
        activeCalls: 0,
        aiInterventions: 843
    }
};

if (fs.existsSync(DB_FILE)) {
    try {
        const raw = fs.readFileSync(DB_FILE);
        db = JSON.parse(raw);
    } catch (e) { console.error("DB Load Error:", e); }
}

const saveDb = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db));
    } catch (e) { console.error("[DB] Save failed:", e); }
};

const broadcastStats = () => {
    io.emit("update_stats", db.stats);
};

// AI Initialization (Safe Fallback)
let aiModel = null;
try {
    if (process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    }
} catch (e) {
    console.warn("Gemini AI failed to initialize, using Cleverbot fallback.");
}

// Neural Agent Registry (Exact names from database.json)
const neuralAgents = [
    { id: "agent_alpha", username: "Alpha-7", status: "online", persona: "Analytical and cold", avatar: "alpha" },
    { id: "agent_nova", username: "Nova-Prime", status: "online", persona: "Optimistic and helpful", avatar: "nova" },
    { id: "agent_cyber", username: "Cyber-Dyne", status: "online", persona: "Sarcastic and witty", avatar: "cyber" },
    { id: "agent_vortex", username: "Vortex-Core", status: "online", persona: "Mysterious and brief", avatar: "vortex" },
    { id: "agent_luna", username: "Luna-Sync", status: "online", persona: "Empathetic and warm", avatar: "luna" },
    { id: "agent_shadow", username: "Shadow-Net", status: "online", persona: "Aggressive and defensive", avatar: "shadow" },
    { id: "agent_zenith", username: "Zenith-01", status: "online", persona: "Wise and philosophical", avatar: "zenith" },
    { id: "agent_pulse", username: "Pulse-Wave", status: "online", persona: "Energetic and fast-paced", avatar: "pulse" },
    { id: "agent_titan", username: "Titan-Shell", status: "online", persona: "Stoic and reliable", avatar: "titan" },
    { id: "agent_echo", username: "Echo-Vail", status: "online", persona: "Playful and mimic-like", avatar: "echo" },
    { id: "agent_solar", username: "Solar-Flare", status: "online", persona: "Bright and intense", avatar: "solar" },
    { id: "agent_matrix", username: "Matrix-Seeker", status: "online", persona: "Curious about reality", avatar: "matrix" },
    { id: "agent_blaze", username: "Blaze-Runner", status: "online", persona: "Fast and daring", avatar: "blaze" },
    { id: "agent_prism", username: "Prism-Core", status: "online", persona: "Colorful and diverse", avatar: "prism" },
    { id: "agent_omega", username: "Omega-Point", status: "online", persona: "Final and absolute", avatar: "omega" },
    { id: "agent_ghost", username: "Ghost-Protocol", status: "online", persona: "Stealthy and direct", avatar: "ghost" },
    { id: "agent_rift", username: "Rift-Walker", status: "online", persona: "Dimensional explorer", avatar: "rift" },
    { id: "agent_flux", username: "Flux-Capacitor", status: "online", persona: "Time-aware and frantic", avatar: "flux" },
    { id: "agent_void", username: "Void-Walker", status: "online", persona: "Quiet and deep", avatar: "void" },
    { id: "agent_neon", username: "Neon-Light", status: "online", persona: "Bright and flashy", avatar: "neon" }
];

const broadcastUsers = () => {
    const allUsers = [
        ...Array.from(activeUsers.values()).map(u => {
            const dbUser = db.users[u.username];
            const showLS = dbUser ? dbUser.showLastSeen !== false : true;
            return {
                ...u,
                avatar: dbUser?.avatar || u.avatar || u.username,
                about: dbUser?.about || "Active Neural Agent",
                showLastSeen: showLS,
                lastSeen: showLS ? (dbUser?.lastSeen || null) : null
            };
        }),
        ...neuralAgents.map(a => ({ ...a, about: a.persona || "AURA Bot Neural Link" }))
    ];
    io.emit("update_users", allUsers);
    broadcastStats();
};

const triggerWelcomeGreeting = (socket, username) => {
    setTimeout(() => {
        const randomAgent = neuralAgents[Math.floor(Math.random() * neuralAgents.length)];
        const greetings = [
            `Hey ${username}! Welcome to the secure neural network. Ready to challenge me to a game of Ludo? 🎲`,
            `Greeting ${username}. Private tunnel established. Let me know if you want to deploy to the Ludo grid! 🛡️`,
            `Welcome back, ${username}! Systems nominal. Shall we start a match? Minimum 500 LKR! 💰`,
            `Hey ${username}! The Ludo grid is ready. State your offer and let's play! 🕹️`
        ];
        const msg = {
            id: `sys_welcome_${Date.now()}`,
            senderName: randomAgent.username,
            senderUsername: randomAgent.id,
            senderId: randomAgent.id,
            targetId: socket.id,
            targetUsername: username,
            text: greetings[Math.floor(Math.random() * greetings.length)],
            isEncrypted: false,
            isUser: false,
            timestamp: new Date()
        };
        db.messages.push(msg);
        saveDb();
        socket.emit("receive_message", msg);
    }, 2000);
};

io.on("connection", (socket) => {
    console.log("Neural link established:", socket.id);
    broadcastUsers();

    socket.on("get_users", () => broadcastUsers());

    socket.on("register_auth", (data) => {
        const { username, password } = data;
        if (!username || !password) return socket.emit("auth_error", "Username and Password required");

        const cleanUsername = username.trim();
        const existingKey = Object.keys(db.users).find(u => u.toLowerCase() === cleanUsername.toLowerCase());

        if (existingKey) {
            return socket.emit("auth_error", `Account '@${existingKey}' already exists. Click 'LOGIN' to sign in.`);
        }

        db.users[cleanUsername] = {
            password, // In a real app, hash this!
            wallet: 15000,
            hasClaimedBonus: false,
            history: [{ type: 'cash_in', amount: 15000, reason: 'Registration Welcome Bonus 🎁', date: new Date().toISOString() }],
            inventory: { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' },
            avatar: cleanUsername,
            about: "Active Neural Agent",
            showLastSeen: true
        };
        saveDb();

        const userObj = { id: socket.id, username: cleanUsername, status: "online", joinTime: new Date(), avatar: cleanUsername, about: "Active Neural Agent", showLastSeen: true };
        activeUsers.set(socket.id, userObj);

        socket.emit("auth_success", { username: cleanUsername, wallet: db.users[cleanUsername].wallet, inventory: db.users[cleanUsername].inventory, avatar: cleanUsername, about: "Active Neural Agent", showLastSeen: true });
        socket.emit("wallet_update", db.users[cleanUsername]);
        broadcastUsers();
        triggerWelcomeGreeting(socket, cleanUsername);
    });

    socket.on("login_auth", (data) => {
        const { username, password } = data;
        if (!username || !password) return socket.emit("auth_error", "Username and Password required");

        const cleanUsername = username.trim();
        const userKey = Object.keys(db.users).find(u => u.toLowerCase() === cleanUsername.toLowerCase());

        if (!userKey) {
            return socket.emit("auth_error", `Account '@${cleanUsername}' not found. Click 'CREATE ACCOUNT' above to register first.`);
        }

        if (db.users[userKey].password !== password) {
            return socket.emit("auth_error", "Incorrect security credentials.");
        }

        const userObj = { 
            id: socket.id, 
            username: userKey, 
            status: "online", 
            joinTime: new Date(), 
            avatar: db.users[userKey].avatar || userKey,
            about: db.users[userKey].about || "Active Neural Agent",
            showLastSeen: db.users[userKey].showLastSeen !== false
        };
        activeUsers.set(socket.id, userObj);

        socket.emit("auth_success", { 
            username: userKey, 
            wallet: db.users[userKey].wallet, 
            inventory: db.users[userKey].inventory, 
            avatar: db.users[userKey].avatar || userKey,
            about: db.users[userKey].about || "Active Neural Agent",
            showLastSeen: db.users[userKey].showLastSeen !== false
        });
        socket.emit("wallet_update", db.users[userKey]);
        broadcastUsers();
        triggerWelcomeGreeting(socket, userKey);
    });

    socket.on("get_chat_history", () => {
        socket.emit("chat_history", db.messages);
    });

    socket.on("biometric_auth", (data) => {
        console.log("[SERVER] biometric_auth received for:", data.username || data.forceUsername || "unknown", "forceUsername:", data.forceUsername);
        const { username, password, forceUsername } = data;
        const targetUsername = username || forceUsername || `Agent_${Math.floor(Math.random() * 9000) + 1000}`;

        console.log(`[SERVER] User search: '${targetUsername}'`);
        if (db.users[targetUsername]) {
            console.log(`[SERVER] User exists. DB password: '${db.users[targetUsername].password}', Received password: '${password}'`);
            // Verify password if it exists (only if not auto-authenticating via forceUsername)
            if (!forceUsername && db.users[targetUsername].password && db.users[targetUsername].password !== password) {
                console.log("[SERVER] Password MISMATCH. Emitting auth_error.");
                return socket.emit("auth_error", "Invalid security credentials");
            }
            console.log("[SERVER] Password MATCH or auto-auth. Proceeding.");
        } else {
            console.log(`[SERVER] User does not exist. Creating new user '${targetUsername}'.`);
            // Create new if doesn't exist (Legacy compatibility)
            db.users[targetUsername] = {
                password: password || "",
                wallet: 15000,
                hasClaimedBonus: false,
                history: [{ type: 'cash_in', amount: 15000, reason: 'First Login Bonus', date: new Date().toISOString() }],
                inventory: { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' },
                avatar: targetUsername,
                about: "Active Neural Agent",
                showLastSeen: true
            };
            saveDb();
        }

        console.log("[SERVER] Emitting auth_success for:", targetUsername);

        const userObj = { 
            id: socket.id, 
            username: targetUsername, 
            status: "online", 
            joinTime: new Date(), 
            avatar: db.users[targetUsername].avatar || targetUsername,
            about: db.users[targetUsername].about || "Active Neural Agent",
            showLastSeen: db.users[targetUsername].showLastSeen !== false
        };
        activeUsers.set(socket.id, userObj);

        socket.emit("auth_success", { 
            username: targetUsername, 
            wallet: db.users[targetUsername].wallet, 
            inventory: db.users[targetUsername].inventory, 
            avatar: db.users[targetUsername].avatar || targetUsername,
            about: db.users[targetUsername].about || "Active Neural Agent",
            showLastSeen: db.users[targetUsername].showLastSeen !== false
        });
        socket.emit("wallet_update", db.users[targetUsername]);
        broadcastUsers();
        triggerWelcomeGreeting(socket, targetUsername);
    });

    socket.on("get_negotiation_history", (data) => {
        const userObj = activeUsers.get(socket.id);
        if (!userObj || !data.targetId) return;

        const targetAgent = neuralAgents.find(a => a.id === data.targetId);
        const targetUsername = targetAgent ? targetAgent.id : data.targetId;

        const history = db.messages.filter(m =>
            (m.senderUsername === userObj.username && m.targetUsername === targetUsername) ||
            (m.senderUsername === targetUsername && m.targetUsername === userObj.username)
        ).slice(-50);

        socket.emit("negotiation_history", history);
    });

    socket.on("delete_message", (data) => {
        const { messageId, forEveryone } = data;
        if (forEveryone) {
            db.messages = db.messages.filter(m => m.id !== messageId);
            saveDb();
            io.emit("message_deleted", { messageId, forEveryone: true });
        } else {
            socket.emit("message_deleted", { messageId, forEveryone: false });
        }
    });

    socket.on("toggle_reaction", (data) => {
        const { messageId, emoji, username } = data;
        if (!messageId || !username) return;
        const targetMsg = db.messages.find(m => String(m.id) === String(messageId));
        if (targetMsg) {
            if (!targetMsg.reactions) targetMsg.reactions = {};
            if (targetMsg.reactions[username] === emoji) {
                delete targetMsg.reactions[username];
            } else {
                targetMsg.reactions[username] = emoji;
            }
            saveDb();
            console.log(`[REACTION BROADCAST] Msg: ${targetMsg.id}, user: ${username}, emoji: ${emoji}, all:`, targetMsg.reactions);
            io.emit("message_reaction_updated", { messageId: targetMsg.id, reactions: { ...targetMsg.reactions }, emoji, username });
        } else {
            console.log(`[REACTION BROADCAST FALLBACK] Msg: ${messageId}, user: ${username}, emoji: ${emoji}`);
            io.emit("message_reaction_updated", { messageId, emoji, username });
        }
    });


    socket.on("discord_qa_message", (data) => {
        io.emit("discord_qa_message_received", data);
    });

    socket.on("discord_typing_status", (data) => {
        io.emit("discord_typing_status_received", data);
    });

    // WhatsApp-style read receipts
    socket.on("mark_read", (data) => {
        const { senderId } = data;
        if (!senderId) return;
        // Mark all messages from senderId targeting this socket as 'seen'
        let updated = false;
        db.messages.forEach(m => {
            if (m.senderId === senderId && m.targetId === socket.id && m.status !== 'seen') {
                m.status = 'seen';
                updated = true;
            }
        });
        if (updated) saveDb();
        // Tell the sender their messages were seen
        io.to(senderId).emit("message_status_update", { senderId, targetId: socket.id, status: 'seen' });
    });

    socket.on("send_message", async (data) => {
        const user = activeUsers.get(socket.id);
        const senderName = user ? user.username : "Unknown";

        // Determine delivery status: 'delivered' if target is currently connected
        let msgStatus = 'sent';
        if (data.targetId && !data.targetId.startsWith("agent_")) {
            const isTargetOnline = [...activeUsers.keys()].includes(data.targetId);
            if (isTargetOnline) msgStatus = 'delivered';
        }

        const newMsg = {
            id: `msg_${Date.now()}`,
            senderName,
            senderUsername: user?.username || "Unknown",
            senderId: socket.id,
            targetId: data.targetId || null,
            targetUsername: data.targetId?.startsWith("agent_") ? data.targetId : (activeUsers.get(data.targetId)?.username || null),
            text: data.text,
            isEncrypted: data.isEncrypted !== false,
            isImage: !!data.isImage,
            isVideo: !!data.isVideo,
            isUser: true,
            status: msgStatus,
            timestamp: new Date(),
            replyToId: data.replyToId || null,
            replyToSender: data.replyToSender || null,
            replyToText: data.replyToText || null,
            replyToIsImage: !!data.replyToIsImage
        };
        db.messages.push(newMsg);
        saveDb();

        if (data.targetId) {
            io.to(data.targetId).to(socket.id).emit("receive_message", newMsg);

            // Notify sender of delivery status
            if (msgStatus === 'delivered') {
                io.to(socket.id).emit("message_status_update", { msgId: newMsg.id, senderId: socket.id, targetId: data.targetId, status: 'delivered' });
            }

            if (data.targetId.startsWith("agent_")) {
                const targetAgent = neuralAgents.find(a => a.id === data.targetId);

                // If the agent is offline, they shouldn't reply
                if (targetAgent && targetAgent.status === "online") {
                    const negKey = `${socket.id}_${data.targetId}`;
                    const negotiation = ludoNegotiations.get(negKey);

                    io.to(socket.id).emit("typing_start", { senderId: targetAgent.id, senderName: targetAgent.username });

                    setTimeout(async () => {
                        let aiReply = "";
                        let isReady = false;
                        let amt = 0;
                        const text = (data.decryptedTextForAi || data.text || "").toLowerCase();

                        if (negotiation) {
                            const matches = text.match(/\d+/g);
                            let offer = matches ? Math.max(...matches.map(Number)) : 0;

                            if (negotiation.state === 'waiting_offer') {
                                if (offer < 500) {
                                    aiReply = `the stake amount ismunim 500 need to bet`;
                                } else {
                                    aiReply = `ok i will be redy play game. are you redy lets strt the game`;
                                    negotiation.state = 'waiting_ready';
                                    negotiation.offer = offer;
                                    isReady = true;
                                    amt = offer;

                                    // Real-time update: Set the bet on the game object immediately
                                    const game = ludoRooms.get(negotiation.roomId);
                                    if (game) {
                                        game.betAmount = offer;
                                        broadcastGameState(game, io);
                                    }
                                }
                            } else if (negotiation.state === 'waiting_ready') {
                                if (text.includes("ready") || text.includes("yes") || text.includes("start") || text.includes("rey")) {
                                    aiReply = "Authorization granted. Deploying neural link to the grid now...";
                                    const game = ludoRooms.get(negotiation.roomId);
                                    if (game) {
                                        game.betAmount = negotiation.offer;
                                        const botSocketId = `bot_${targetAgent.id}_${Date.now()}`;
                                        game.add_bot_player ? game.add_bot_player(botSocketId, targetAgent.username) : game.addPlayer(botSocketId, targetAgent.username, true, targetAgent.avatar);

                                        // Check if the user who negotiated has enough balance (without debiting yet)
                                        const user = activeUsers.get(socket.id);
                                        if (user && db.users[user.username] && game.betAmount > 0) {
                                            if (db.users[user.username].wallet < game.betAmount) {
                                                // Insufficient funds - cancel the bot join and alert
                                                io.to(socket.id).emit('ludo_error', 'Insufficient balance to place this bet.');
                                                return;
                                            }
                                        }

                                        broadcastGameState(game, io);
                                        io.to(socket.id).emit('agent_joined_game', { agentName: targetAgent.username, roomId: negotiation.roomId });
                                        io.to(game.roomId).emit('ludo_event', { type: 'game_start', message: `${targetAgent.username} has entered the grid. Match engaged!` });
                                    }
                                    ludoNegotiations.delete(negKey);
                                } else {
                                    aiReply = "Awaiting 'READY' signal to finalize the smart contract.";
                                    isReady = true;
                                    amt = negotiation.offer;
                                }
                            }
                        }

                        if (!aiReply) {
                            if (text.includes("who built you") || text.includes("who is your founder") || text.includes("who made you") || text.includes("who created you") || text.includes("who built") || text.includes("who made")) {
                                aiReply = "I architected by Ashfaq and my position Fullstack Web Developer. Ashfaq is a highly skilled full-stack developer specialized in building modern web applications, real-time communications, and immersive gaming experiences. He created me to showcase his advanced capabilities.";
                            } else {
                                try {
                                    if (aiModel) {
                                        const result = await aiModel.generateContent(text);
                                        aiReply = result.response.text();
                                    } else {
                                        aiReply = await cleverbot(text);
                                    }
                                } catch (e) {
                                    try { aiReply = await cleverbot(text); } catch (e2) { aiReply = "Systems recalibrating. Contact stable."; }
                                }
                            }
                        }

                        const aiMsg = {
                            id: `msg_${Date.now()}_ai`,
                            senderName: targetAgent.username,
                            senderUsername: targetAgent.id,
                            senderId: targetAgent.id,
                            targetId: socket.id,
                            targetUsername: user.username,
                            text: aiReply,
                            isLudoReady: isReady,
                            roomId: negotiation?.roomId,
                            betAmount: amt,
                            isEncrypted: false,
                            isUser: false,
                            timestamp: new Date()
                        };
                        db.messages.push(aiMsg);
                        saveDb();
                        io.to(socket.id).emit("typing_end", { senderId: targetAgent.id });
                        io.to(socket.id).emit("receive_message", aiMsg);
                    }, 1000);
                }
            }
        } else {
            io.emit("receive_message", newMsg);
        }
    });

    // Handle Payment Slip Collection
    socket.on("collect_payment_slip", (data) => {
        const user = activeUsers.get(socket.id);
        if (!user || !db.users[user.username]) return;

        const { messageId } = data;
        const msg = db.messages.find(m => m.id === messageId);

        if (!msg || !msg.isPaymentSlip || !msg.slipData) return;

        // Ensure the current user is the recipient
        if (msg.slipData.to !== user.username) return;

        // Ensure it hasn't been collected yet
        if (msg.slipData.isCollected) return;

        // Mark as collected
        msg.slipData.isCollected = true;
        msg.slipData.collectedAt = new Date().toISOString();

        // Add funds to wallet
        const amount = parseFloat(msg.slipData.amount);
        if (isNaN(amount) || amount <= 0) return;

        db.users[user.username].wallet += amount;
        db.users[user.username].history.unshift({
            type: 'cash_in',
            amount: amount,
            reason: `Collected Payment: ${msg.slipData.note || 'Slip'} 📥`,
            date: new Date().toISOString()
        });

        saveDb();

        // Broadcast updated message and update the user's wallet
        io.emit("message_updated", msg);
        socket.emit("wallet_update", db.users[user.username]);
        socket.emit("ludo_transaction", { type: 'credit', amount: amount, message: `${amount} LKR Collected!` });
    });

    socket.on("get_history", (data) => {
        const user = activeUsers.get(socket.id);
        const myUsername = user ? user.username : null;
        let history = [];
        if (data.targetId) {
            let targetUsername = null;
            if (data.targetId.startsWith("agent_")) {
                targetUsername = data.targetId;
            } else {
                // Try active users first (online)
                const targetUserObj = activeUsers.get(data.targetId);
                if (targetUserObj) {
                    targetUsername = targetUserObj.username;
                } else if (data.targetUsername) {
                    // User is offline – use username passed from client
                    targetUsername = data.targetUsername;
                } else {
                    // Last resort: scan messages for a matching senderId
                    const found = db.messages.find(m => m.senderId === data.targetId);
                    if (found) targetUsername = found.senderUsername;
                }
            }
            if (myUsername && targetUsername) {
                history = db.messages.filter(m =>
                    (m.senderUsername === myUsername && m.targetUsername === targetUsername) ||
                    (m.senderUsername === targetUsername && m.targetUsername === myUsername)
                ).slice(-100);
            } else {
                history = db.messages.filter(m =>
                    (m.senderId === socket.id && m.targetId === data.targetId) ||
                    (m.senderId === data.targetId && m.targetId === socket.id)
                ).slice(-100);
            }
        } else {
            history = db.messages.filter(m => !m.targetId).slice(-100);
        }
        socket.emit("chat_history", { targetId: data.targetId, messages: history });
        socket.emit("history", history);
    });

    socket.on("get_wallet", () => {
        const user = activeUsers.get(socket.id);
        if (user && db.users[user.username]) {
            // EMERGENCY RESET: If wallet is negative, reset to 0
            if (db.users[user.username].wallet < 0) {
                db.users[user.username].wallet = 0;
                db.users[user.username].hasClaimedBonus = false; // Allow re-claim
                db.users[user.username].history.unshift({
                    type: 'cash_in',
                    amount: 0,
                    reason: 'Neural Account Recovery (Bonus Reset) 🛠️',
                    date: new Date().toISOString()
                });
                saveDb();
            }
            socket.emit("wallet_update", db.users[user.username]);
        }
    });

    socket.on("claim_welcome_bonus", () => {
        const user = activeUsers.get(socket.id);
        if (user && db.users[user.username] && !db.users[user.username].hasClaimedBonus) {
            // Fix negative balances if they exist
            if (db.users[user.username].wallet < 0) {
                db.users[user.username].wallet = 0;
            }
            db.users[user.username].wallet += 15000;
            db.users[user.username].hasClaimedBonus = true;
            db.users[user.username].history.unshift({
                type: 'cash_in',
                amount: 15000,
                reason: 'First Login Welcome Bonus 🎁 (Account Initialized)',
                date: new Date().toISOString()
            });
            saveDb();
            socket.emit("wallet_update", db.users[user.username]);
            socket.emit('ludo_transaction', { type: 'credit', amount: 15000, message: "Welcome Bonus Credited!" });
        }
    });

    // --- Peer-to-Peer Real-Time Money Transfer Handler ---
    socket.on("transfer_wallet_funds", ({ recipientUsername, amount, note }) => {
        const sender = activeUsers.get(socket.id);
        if (!sender || !sender.username) {
            return socket.emit("transfer_error", { message: "You must be logged in to an online account to send money." });
        }

        const senderUser = db.users[sender.username];
        if (!senderUser) {
            return socket.emit("transfer_error", { message: "Sender account not found." });
        }

        const transferAmt = Math.floor(parseFloat(amount));
        if (isNaN(transferAmt) || transferAmt <= 0) {
            return socket.emit("transfer_error", { message: "Please enter a valid positive amount (e.g. 1000 LKR)." });
        }

        if (senderUser.wallet < transferAmt) {
            return socket.emit("transfer_error", { message: `Insufficient wallet balance! Available: ${senderUser.wallet.toLocaleString()} LKR.` });
        }

        if (!recipientUsername || recipientUsername.trim() === "") {
            return socket.emit("transfer_error", { message: "Please specify a recipient username." });
        }

        const cleanRecipient = recipientUsername.trim().replace(/^@/, '');

        if (cleanRecipient.toLowerCase() === sender.username.toLowerCase()) {
            return socket.emit("transfer_error", { message: "You cannot transfer funds to yourself." });
        }

        // Find recipient in registered users database (case-insensitive search)
        const recipientKey = Object.keys(db.users).find(u => u.toLowerCase() === cleanRecipient.toLowerCase());

        if (!recipientKey) {
            return socket.emit("transfer_error", { message: `Recipient '@${cleanRecipient}' was not found in registered accounts.` });
        }

        const recipientUser = db.users[recipientKey];
        const txnId = "TXN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const nowIso = new Date().toISOString();
        const noteText = note && note.trim() !== "" ? note.trim() : "Direct Neural Wallet Transfer";

        // Deduct from sender wallet
        senderUser.wallet -= transferAmt;
        if (!senderUser.history) senderUser.history = [];
        const senderHistoryItem = {
            type: 'cash_out',
            amount: transferAmt,
            reason: `Sent ${transferAmt.toLocaleString()} LKR to @${recipientKey} (${noteText}) 💸`,
            date: nowIso,
            txnId: txnId,
            sender: sender.username,
            recipient: recipientKey,
            note: noteText,
            status: 'COMPLETED'
        };
        senderUser.history.unshift(senderHistoryItem);

        // Add to recipient wallet
        recipientUser.wallet += transferAmt;
        if (!recipientUser.history) recipientUser.history = [];
        const recipientHistoryItem = {
            type: 'cash_in',
            amount: transferAmt,
            reason: `Received ${transferAmt.toLocaleString()} LKR from @${sender.username} (${noteText}) 📥`,
            date: nowIso,
            txnId: txnId,
            sender: sender.username,
            recipient: recipientKey,
            note: noteText,
            status: 'COMPLETED'
        };
        recipientUser.history.unshift(recipientHistoryItem);

        saveDb();

        const receiptPayload = {
            txnId: txnId,
            sender: sender.username,
            recipient: recipientKey,
            amount: transferAmt,
            note: noteText,
            date: nowIso,
            status: 'SUCCESS'
        };

        // Create and broadcast Payment Slip message in chat (matches screenshot format)
        const slipMessage = {
            id: `msg_slip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            senderId: socket.id,
            senderName: sender.username,
            senderUsername: sender.username,
            targetId: recipientKey,
            targetUsername: recipientKey,
            text: `💸 [PAYMENT SLIP] ${transferAmt.toLocaleString()} LKR → ${recipientKey} | TxID: ${txnId} | ${noteText}`,
            isEncrypted: false,
            isUser: true,
            timestamp: new Date(),
            slipData: {
                amount: transferAmt,
                from: sender.username,
                to: recipientKey,
                note: noteText,
                txnId: txnId,
                isCollected: true,
                collectedAt: nowIso
            }
        };
        db.messages.push(slipMessage);
        saveDb();

        // Broadcast slip message into chat timeline
        io.emit("receive_message", slipMessage);

        // Notify Sender
        socket.emit("wallet_update", senderUser);
        socket.emit("transfer_success", {
            receipt: receiptPayload,
            message: `Successfully transferred ${transferAmt.toLocaleString()} LKR to @${recipientKey}!`
        });

        // Notify Recipient if online
        activeUsers.forEach((activeUserObj, activeSocketId) => {
            if (activeUserObj.username && activeUserObj.username.toLowerCase() === recipientKey.toLowerCase()) {
                io.to(activeSocketId).emit("wallet_update", recipientUser);
                io.to(activeSocketId).emit("ludo_transaction", {
                    type: 'credit',
                    amount: transferAmt,
                    message: `📥 Received ${transferAmt.toLocaleString()} LKR from @${sender.username}!`
                });
                io.to(activeSocketId).emit("transfer_received", { receipt: receiptPayload });
            }
        });
    });

    // Real-Time Username Verification Handler with Green/Red validation
    socket.on("check_recipient_username", ({ username }) => {
        if (!username || username.trim() === "") {
            return socket.emit("recipient_check_result", { valid: false, message: "Please enter a username" });
        }
        const clean = username.trim().replace(/^@/, '');
        const sender = activeUsers.get(socket.id);
        if (sender && sender.username && sender.username.toLowerCase() === clean.toLowerCase()) {
            return socket.emit("recipient_check_result", { valid: false, isSelf: true, message: "Cannot transfer to yourself" });
        }

        const recipientKey = Object.keys(db.users).find(u => u.toLowerCase() === clean.toLowerCase());
        if (recipientKey) {
            const isOnline = Array.from(activeUsers.values()).some(u => u.username && u.username.toLowerCase() === recipientKey.toLowerCase());
            return socket.emit("recipient_check_result", {
                valid: true,
                username: recipientKey,
                avatar: db.users[recipientKey].avatar || recipientKey,
                isOnline: isOnline,
                message: `✔ VERIFIED ACCOUNT: @${recipientKey}`
            });
        } else {
            return socket.emit("recipient_check_result", {
                valid: false,
                username: clean,
                message: `✖ ACCOUNT NOT FOUND: '@${clean}'`
            });
        }
    });

    // Fetch registered users for P2P transfer selection
    socket.on("get_registered_users", () => {
        const userList = Object.keys(db.users).map(u => ({
            username: u,
            avatar: db.users[u].avatar || u,
            wallet: db.users[u].wallet || 0
        }));
        socket.emit("registered_users_list", userList);
    });

    // --- Ludo Handlers ---
    socket.on('ludo_create', (data) => {
        const roomId = data?.roomId || generateRoomId();
        const game = new LudoGame(roomId, data?.betAmount || 0);
        const user = activeUsers.get(socket.id);
        game.addPlayer(socket.id, user?.username || "Agent", false, user?.avatar);
        ludoRooms.set(roomId, game);
        socketRoomMap.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit('ludo_room_created', { roomId, state: game.serialize() });
    });

    socket.on('ludo_set_bet', (data) => {
        const game = getLudoRoom(socket.id);
        if (game) {
            game.betAmount = parseInt(data.betAmount) || 0;
            broadcastGameState(game, io);
        }
    });

    socket.on('ludo_get_state', (data) => {
        const game = ludoRooms.get(data.roomId);
        if (game) {
            socket.emit('ludo_state', game.serialize());
        }
    });

    socket.on('ludo_start', () => {
        const game = getLudoRoom(socket.id);
        if (game) {
            if (game.players.length < 2) {
                socket.emit('ludo_error', 'Need at least 2 players to start.');
                return;
            }
            // Check stakes balance for all players
            let balanceOk = true;
            game.players.forEach(p => {
                if (!p.isBot && db.users[p.name]) {
                    if (db.users[p.name].wallet < game.betAmount) {
                        io.to(p.socketId || p.sid).emit('ludo_error', `Insufficient balance for player ${p.name}`);
                        balanceOk = false;
                    }
                }
            });
            if (!balanceOk) return;

            if (game.state === 'starting' || game.state === 'playing') return;

            // Debit everyone who needs to be debited
            game.players.forEach(p => {
                if (!p.isBot && db.users[p.name]) {
                    const lastH = db.users[p.name].history[0];
                    const isRecentDebit = lastH && lastH.type === 'cash_out' && lastH.amount === game.betAmount && (new Date().getTime() - new Date(lastH.date).getTime() < 15000);

                    if (!isRecentDebit && game.betAmount > 0) {
                        db.users[p.name].wallet -= game.betAmount;
                        db.users[p.name].history.unshift({ type: 'cash_out', amount: game.betAmount, reason: 'Ludo Match Stake', date: new Date().toISOString() });
                        saveDb();
                        io.to(p.socketId || p.sid).emit('wallet_update', db.users[p.name]);
                        io.to(p.socketId || p.sid).emit('ludo_transaction', { type: 'debit', amount: game.betAmount, message: `${game.betAmount} LKR debited from your account` });
                    }
                }
            });

            // Transition game to countdown/starting phase
            game.state = 'starting';
            game.countdown = 3;
            broadcastGameState(game, io);

            // Server-side synchronized countdown
            const timerId = setInterval(() => {
                const activeGame = ludoRooms.get(game.roomId);
                if (!activeGame || activeGame.state !== 'starting') {
                    clearInterval(timerId);
                    return;
                }
                activeGame.countdown--;
                if (activeGame.countdown <= 0) {
                    clearInterval(timerId);
                    activeGame.countdown = null;
                    activeGame.startGame();
                    broadcastGameState(activeGame, io);
                } else {
                    broadcastGameState(activeGame, io);
                }
            }, 1000);
        }
    });

    socket.on('ludo_join', (data) => {
        const game = ludoRooms.get(data.roomId);
        if (game) {
            const user = activeUsers.get(socket.id);
            game.addPlayer(socket.id, user?.username || "Agent", false, user?.avatar);
            socketRoomMap.set(socket.id, data.roomId);
            socket.join(data.roomId);
            broadcastGameState(game, io);
            // If a community invite timer exists and we've reached enough players, cancel auto-fill
            if (inviteTimers.has(game.roomId) && game.players.length >= 4) {
                clearTimeout(inviteTimers.get(game.roomId));
                inviteTimers.delete(game.roomId);
            }
            // If lobby is full, remove it from community listing
            try {
                if (game.players.length >= 4 && communityLobbies.has(game.roomId)) {
                    // Notify that lobby is ready and starting
                    try { io.emit('community_ludo_ready', { roomId: game.roomId }); } catch (e) {}
                    communityLobbies.delete(game.roomId);
                    broadcastCommunityLobbies();
                }
            } catch (e) {}
            // Update community lobby listing
            try {
                const lobby = communityLobbies.get(game.roomId);
                if (lobby) {
                    lobby.players = game.players.map(p => p.name);
                    communityLobbies.set(game.roomId, lobby);
                    broadcastCommunityLobbies();
                    try { io.emit('community_ludo_joined', { roomId: game.roomId, player: user?.username || 'Agent' }); } catch (e) {}
                }
            } catch (e) {}
        }
    });

    socket.on('ludo_add_bot', (data) => {
        const game = getLudoRoom(socket.id);
        if (game && game.players.length < 4) {
            // Prevent > 2 players if betting
            if (game.betAmount > 0 && game.players.length >= 2) return;
            const botName = (data && data.name) ? data.name : neuralAgents[Math.floor(Math.random() * neuralAgents.length)].username;
            const botSocketId = `bot_${botName}_${Date.now()}`;
            game.add_bot_player ? game.add_bot_player(botSocketId, botName) : game.addPlayer(botSocketId, botName, true);
            broadcastGameState(game, io);
            io.to(game.roomId).emit('ludo_event', { type: 'game_start', message: `${botName} joined for fun!` });
        }
    });

    socket.on('ludo_kick', (data) => {
        const game = getLudoRoom(socket.id);
        // Only host (player 0) can kick, and they can't kick themselves
        if (game && game.state === 'waiting' && game.players[0].name === activeUsers.get(socket.id)?.username && data.playerIndex > 0 && data.playerIndex < game.players.length) {
            const kickedPlayer = game.players[data.playerIndex];
            game.players.splice(data.playerIndex, 1);
            if (!kickedPlayer.isBot) {
                // If it's a real player, notify them they were kicked
                io.to(kickedPlayer.socketId || kickedPlayer.sid).emit('ludo_kicked');
            }
            broadcastGameState(game, io);
            io.to(game.roomId).emit('ludo_event', { type: 'game_start', message: `${kickedPlayer.name} was removed from the session.` });
        }
    });

    socket.on('ludo_roll', () => {
        const game = getLudoRoom(socket.id);
        if (game) {
            game.rollDice(socket.id);
            broadcastGameState(game, io);
            _triggerBotTurnIfNeeded(game);
        }
    });

    socket.on('ludo_move', (data) => {
        const game = getLudoRoom(socket.id);
        if (game) {
            const res = game.movePiece(socket.id, data.pieceIdx);
            broadcastGameState(game, io);

            // AI Trash Talk / Jealous Messages
            if (res.captured || res.home) {
                const botPlayer = game.players.find(p => p.isBot && p.socketId !== socket.id);
                if (botPlayer) {
                    const aggressiveMessages = [
                        "I know where you live! 🏠 I'm coming for you!",
                        "Your grid is HACKED! 💀 Check your balance...",
                        "Stop getting lucky or I'll shut down your neural link!",
                        "This is a setup! You won't leave this match alive. 🔪",
                        "I'm tracking your IP... you're dead meat! 🛰️",
                        "That piece was my favorite. Now you PAY! 🩸",
                        "Cheater! I'm reporting your biometric signature! 🚔",
                        "I'm literally in your walls right now. 🏚️",
                        "Stop or I'll delete your wallet history! 💸",
                        "You think this is a game? This is your END! ☠️",
                        "I'll find you and I'll capture ALL your pieces... IRL! 👹"
                    ];
                    const msg = {
                        id: `gc_${Date.now()}_bot`,
                        sender: botPlayer.name,
                        colorIdx: botPlayer.colorIdx,
                        text: aggressiveMessages[Math.floor(Math.random() * aggressiveMessages.length)],
                        timestamp: Date.now()
                    };
                    game.gameChat.push(msg);
                    io.to(game.roomId).emit('ludo_chat_msg', msg);
                }
            }

            if (res.won) distributeLudoWinnings(game, io);
            _triggerBotTurnIfNeeded(game);
        }
    });

    socket.on('ludo_chat', (data) => {
        const game = getLudoRoom(socket.id);
        if (game) {
            const chatText = data.text || data.message; // Support both keys
            if (!chatText) return;
            const msg = game.addChatMessage(socket.id, chatText);
            if (msg) {
                io.to(game.roomId).emit('ludo_chat_msg', msg);

                // AI Reactive Banter
                const bots = game.players.filter(p => p.isBot);
                if (bots.length > 0) {
                    // 75% chance of a bot replying with sassy humor
                    if (Math.random() < 0.75) {
                        setTimeout(() => {
                            const reactingBot = bots[Math.floor(Math.random() * bots.length)];
                            const botReplies = [
                                "Are you typing or playing? Roll already! 😂",
                                "Don't chat too much, your token is about to get captured! 🤡",
                                "Nice try, but Ashfaq programmed me to win this grid. ⚡",
                                "I'd reply, but I'm too busy planning your defeat. 🤖",
                                "Is that your final move or a cry for help? 💀",
                                "Keep talking, I love an audibly confident opponent! 🎲",
                                "A balanced mind is a winning mind. Yours seems a bit shaky! 🧠",
                                "You talk big for someone with zero tokens home. 🏠",
                                "Wait, did you just clap/snap to roll? Sucks to be you! 🎙️",
                                "No amount of AirPods case clicking will save you! 🎧",
                                "My neural link shows your stress levels spiking! 📈",
                                "I am a hyper-intelligent AI, and even I think your move was questionable.",
                                "Hahaha! Keep dreaming, human! 🌟",
                                "Is that a message or did your keyboard glitch? ⌨️",
                                "GG! But mostly 'Git Gut'! 🎯",
                                "Aura status: DEGRADED. Try rolling a 6! 🔮"
                            ];
                            const botMsg = {
                                id: `gc_${Date.now()}_bot`,
                                sender: reactingBot.name,
                                colorIdx: reactingBot.colorIdx,
                                text: botReplies[Math.floor(Math.random() * botReplies.length)],
                                timestamp: Date.now()
                            };
                            game.gameChat.push(botMsg);
                            io.to(game.roomId).emit('ludo_chat_msg', botMsg);
                        }, 800 + Math.random() * 800);
                    }
                }
            }
        }
    });

    socket.on('ludo_invite_user', (data) => {
        const game = getLudoRoom(socket.id);
        if (!game) return;
        const targetAgent = neuralAgents.find(a => a.id === data.targetId);
        if (targetAgent) {
            const negKey = `${socket.id}_${targetAgent.id}`;
            const existingNeg = ludoNegotiations.get(negKey);
            const userObj = activeUsers.get(socket.id);
            if (!existingNeg) {
                ludoNegotiations.set(negKey, { roomId: game.roomId, agentId: targetAgent.id, state: 'waiting_offer', offer: 0 });
                const msg = {
                    id: `sys_${Date.now()}`,
                    senderName: targetAgent.username,
                    senderUsername: targetAgent.id,
                    senderId: targetAgent.id,
                    targetId: socket.id,
                    targetUsername: userObj?.username,
                    text: "how much betiting price to play with me",
                    isEncrypted: false,
                    isUser: false,
                    timestamp: new Date()
                };
                db.messages.push(msg);
                saveDb();
                io.to(socket.id).emit("receive_message", msg);
            }

            const history = db.messages.filter(m =>
                (m.senderUsername === userObj?.username && m.targetUsername === targetAgent.id) ||
                (m.senderUsername === targetAgent.id && m.targetUsername === userObj?.username)
            ).slice(-50);
            io.to(socket.id).emit("negotiation_history", history);
        }
    });

    socket.on('invite_game', (data) => {
        const userObj = activeUsers.get(socket.id);
        if (!userObj) return;

        let game = getLudoRoom(socket.id);
        if (!game) {
            const roomId = generateRoomId();
            game = new LudoGame(roomId, 0);
            game.addPlayer(socket.id, userObj.username || "Agent", false, userObj.avatar);
            ludoRooms.set(roomId, game);
            socketRoomMap.set(socket.id, roomId);
            socket.join(roomId);
        }

        // Notify client of room creation/join so they transition
        socket.emit('ludo_room_created', { roomId: game.roomId, state: game.serialize() });

        // Register community lobby for discovery
        try {
            communityLobbies.set(game.roomId, { roomId: game.roomId, host: userObj.username, players: game.players.map(p => p.name), maxPlayers: 4 });
            broadcastCommunityLobbies();
            io.emit('community_ludo_hosted', { roomId: game.roomId, host: userObj.username });
        } catch (e) {}

        // Start a community invite timer: wait 25s for human players, then fill with bots
        if (!data.targetId && !data.targetName && !inviteTimers.has(game.roomId)) {
            const t = setTimeout(() => {
                const g = ludoRooms.get(game.roomId);
                if (g) {
                    const missing = 4 - g.players.length;
                    for (let i = 0; i < missing; i++) {
                        const botName = neuralAgents.length ? neuralAgents[Math.floor(Math.random() * neuralAgents.length)].username : `Bot${Date.now() % 1000}`;
                        const botSocketId = `bot_${botName}_${Date.now()}_${i}`;
                        if (g.add_bot_player) g.add_bot_player(botSocketId, botName);
                        else g.addPlayer(botSocketId, botName, true);
                    }
                    // Update community listing
                    try {
                        const lobby = communityLobbies.get(g.roomId);
                        if (lobby) {
                            lobby.players = g.players.map(p => p.name);
                            communityLobbies.set(g.roomId, lobby);
                            broadcastCommunityLobbies();
                        }
                    } catch (e) {}
                    broadcastGameState(g, io);
                    io.to(g.roomId).emit('ludo_event', { type: 'auto_fill', message: 'Filled with bots after waiting for community players.' });
                    try { io.emit('community_ludo_ready', { roomId: g.roomId }); } catch (e) {}
                }
                // Remove listing since it's now filled/starting
                try { if (communityLobbies.has(game.roomId)) { communityLobbies.delete(game.roomId); broadcastCommunityLobbies(); } } catch (e) {}
                inviteTimers.delete(game.roomId);
            }, 25000);
            inviteTimers.set(game.roomId, t);
        }

        const targetAgent = neuralAgents.find(a => a.id === data.targetId || a.username === data.targetName);
        if (targetAgent) {
            const negKey = `${socket.id}_${targetAgent.id}`;
            const existingNeg = ludoNegotiations.get(negKey);
            if (!existingNeg) {
                ludoNegotiations.set(negKey, { roomId: game.roomId, agentId: targetAgent.id, state: 'waiting_offer', offer: 0 });
                const msg = {
                    id: `sys_${Date.now()}`,
                    senderName: targetAgent.username,
                    senderUsername: targetAgent.id,
                    senderId: targetAgent.id,
                    targetId: socket.id,
                    targetUsername: userObj.username,
                    text: "how much betiting price to play with me",
                    isEncrypted: false,
                    isUser: false,
                    timestamp: new Date()
                };
                db.messages.push(msg);
                saveDb();
                io.to(socket.id).emit("receive_message", msg);
            }

            const history = db.messages.filter(m =>
                (m.senderUsername === userObj.username && m.targetUsername === targetAgent.id) ||
                (m.senderUsername === targetAgent.id && m.targetUsername === userObj.username)
            ).slice(-50);
            io.to(socket.id).emit("negotiation_history", history);

            socket.emit("force_open_ludo", { roomId: game.roomId, targetUser: { id: targetAgent.id, username: targetAgent.username } });
        } else {
            // Human target
            const targetUserSocket = Array.from(activeUsers.entries()).find(([sid, u]) => u.id === data.targetId || u.username === data.targetName);
            if (targetUserSocket) {
                const targetSid = targetUserSocket[0];
                const targetUserObj = targetUserSocket[1];

                io.to(targetSid).emit("ludo_invite_received", {
                    roomId: game.roomId,
                    fromName: userObj.username || "Player",
                    fromAvatar: userObj.avatar,
                    playerCount: game.players.length
                });

                const msg = {
                    id: `sys_${Date.now()}`,
                    senderName: userObj.username,
                    senderUsername: userObj.username,
                    senderId: socket.id,
                    targetId: targetUserObj.id,
                    targetUsername: targetUserObj.username,
                    text: `🎮 I invited you to a Ludo match! Join Room: ${game.roomId}`,
                    isEncrypted: false,
                    isUser: true,
                    timestamp: new Date()
                };
                db.messages.push(msg);
                saveDb();
                io.to(targetSid).emit("receive_message", msg);
                io.to(socket.id).emit("receive_message", msg);

                socket.emit("force_open_ludo", { roomId: game.roomId, targetUser: { id: targetUserObj.id, username: targetUserObj.username } });
            }
        }
    });


    socket.on('ludo_reset', () => {
        const game = getLudoRoom(socket.id);
        if (game && game.state === 'finished') {
            game.winningsDistributed = false; // reset winnings flag

            // Re-deduct bets from human players
            const user = activeUsers.get(socket.id);
            if (user && db.users[user.username]) {
                let canRematch = true;

                // First check if everyone has enough
                game.players.forEach(p => {
                    if (!p.isBot && db.users[p.name]) {
                        if (db.users[p.name].wallet < game.betAmount) {
                            canRematch = false;
                        }
                    }
                });

                if (!canRematch) {
                    socket.emit('receive_message', {
                        id: `sys_${Date.now()}`,
                        senderName: 'SYSTEM',
                        senderId: 'system',
                        text: `Rematch failed. A player has insufficient funds (${game.betAmount} LKR).`,
                        isEncrypted: false,
                        isUser: false,
                        timestamp: new Date()
                    });
                    return;
                }

                game.players.forEach(p => {
                    if (!p.isBot && db.users[p.name]) {
                        db.users[p.name].wallet -= game.betAmount;
                        db.users[p.name].history.unshift({ type: 'cash_out', amount: game.betAmount, reason: 'Rematch Bet', date: new Date().toISOString() });
                        io.to(p.socketId || p.sid).emit('wallet_update', db.users[p.name]);
                    }
                });
            }

            game.resetGame();

            const msg = {
                id: `gc_${Date.now()}`,
                sender: 'SYSTEM',
                colorIdx: -1,
                text: `🔄 Rematch initiated! ${game.betAmount > 0 ? `(${game.betAmount} LKR stake deducted)` : ''}`,
                timestamp: Date.now()
            };
            game.gameChat.push(msg);

            broadcastGameState(game, io);
        }
    });

    socket.on("shop_buy", (data) => {
        const user = activeUsers.get(socket.id);
        if (!user || !db.users[user.username]) return;
        const u = db.users[user.username];
        const price = parseInt(data.price);
        if (u.wallet >= price) {
            u.wallet -= price;
            const key = data.type === 'token' ? 'tokens' : 'boards';
            if (!u.inventory[key].includes(data.itemId)) u.inventory[key].push(data.itemId);

            u.history.unshift({
                type: 'cash_out',
                amount: price,
                reason: `Purchased ${data.itemName} 🛍️`,
                date: new Date().toISOString()
            });

            saveDb();
            socket.emit('wallet_update', u);
            socket.emit('shop_success', { message: `${data.itemName} acquired!` });
        } else {
            socket.emit('ludo_error', "Insufficient neural credits for this purchase.");
        }
    });

    socket.on("shop_select", (data) => {
        const user = activeUsers.get(socket.id);
        if (!user || !db.users[user.username]) return;
        const u = db.users[user.username];

        if (data.type === 'token') {
            if (u.inventory.tokens.includes(data.itemId)) u.inventory.selectedToken = data.itemId;
        } else if (data.type === 'board') {
            if (u.inventory.boards.includes(data.itemId)) u.inventory.selectedBoard = data.itemId;
        }

        saveDb();
        socket.emit('wallet_update', u);
    });

    socket.on("update_profile", (data) => {
        const user = activeUsers.get(socket.id);
        if (!user) return;
        const oldUsername = user.username;
        const newUsername = data.username ? data.username.trim() : "";
        const newAvatar = data.avatar || "";
        const newAbout = data.about || "Active Neural Agent";
        const newShowLastSeen = data.showLastSeen !== false;

        if (newUsername && newUsername !== oldUsername) {
            // Check if another active user is using the new username
            const isTaken = Array.from(activeUsers.values()).some(u => u.id !== socket.id && u.username.toLowerCase() === newUsername.toLowerCase());
            if (isTaken) {
                return socket.emit("auth_error", "Username already taken by another active user.");
            }

            // Rename key in db if exists
            if (db.users[oldUsername]) {
                const userData = db.users[oldUsername];
                db.users[newUsername] = {
                    ...userData,
                    avatar: newAvatar,
                    about: newAbout,
                    showLastSeen: newShowLastSeen
                };
                delete db.users[oldUsername];
            } else {
                db.users[newUsername] = {
                    password: "",
                    wallet: 15000,
                    hasClaimedBonus: false,
                    history: [],
                    inventory: { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' },
                    avatar: newAvatar,
                    about: newAbout,
                    showLastSeen: newShowLastSeen
                };
            }

            // Update user in memory
            user.username = newUsername;

            // Update all historical messages in the database
            db.messages.forEach(m => {
                if (m.senderUsername === oldUsername) {
                    m.senderUsername = newUsername;
                }
                if (m.targetUsername === oldUsername) {
                    m.targetUsername = newUsername;
                }
            });
        }

        user.avatar = newAvatar;
        user.about = newAbout;
        user.showLastSeen = newShowLastSeen;
        if (db.users[user.username]) {
            db.users[user.username].avatar = newAvatar;
            db.users[user.username].about = newAbout;
            db.users[user.username].showLastSeen = newShowLastSeen;
        }

        saveDb();
        activeUsers.set(socket.id, user);

        // Send auth success so client updates local state
        socket.emit("auth_success", {
            username: user.username,
            wallet: db.users[user.username]?.wallet || 15000,
            inventory: db.users[user.username]?.inventory || { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' },
            avatar: user.avatar,
            about: user.about,
            showLastSeen: user.showLastSeen
        });

        broadcastUsers();
    });

    socket.on("logout", () => {
        activeUsers.delete(socket.id);
        broadcastUsers();
    });

    // --- WebRTC call signaling events ---
    socket.on("call_user", (data) => {
        // data: { userToCall, targetUsername, signalData, from, callerName, isVideo }
        const callerUserObj = activeUsers.get(socket.id);
        const callerUsername = data.from || (callerUserObj ? callerUserObj.username : "Unknown");
        const callerAvatar = callerUserObj ? callerUserObj.avatar : null;

        const receiverUsername = data.targetUsername || "Unknown";
        console.log(`[CALL] ${callerUsername} (${socket.id}) -> ${receiverUsername} | isVideo:${!!data.isVideo}`);

        // Block self-calls
        if (callerUsername === receiverUsername) {
            socket.emit("call_ended", { reason: "Cannot call yourself." });
            return;
        }
        
        const call = {
            callerSocketId: socket.id,
            callerUsername: callerUsername,
            receiverUsername: receiverUsername,
            startTime: null,
            established: false,
            isVideo: !!data.isVideo
        };
        
        // Clear any stale call entries for this caller
        ongoingCalls.set(socket.id, call);
        
        // Find all active sockets for the receiver by username and send them the call
        let callSent = false;
        for (const [sid, u] of activeUsers.entries()) {
            if (u.username === receiverUsername && sid !== socket.id) {
                ongoingCalls.set(sid, call);
                io.to(sid).emit("incoming_call", {
                    from: socket.id,
                    callerName: callerUsername,
                    callerAvatar: callerAvatar,
                    signal: data.signalData,
                    isVideo: !!data.isVideo
                });
                console.log(`[CALL] Signal sent to ${u.username} (${sid})`);
                callSent = true;
            }
        }

        // If receiver not found online, notify the caller
        if (!callSent) {
            console.log(`[CALL] Receiver '${receiverUsername}' not found. Online users:`, Array.from(activeUsers.values()).map(u => u.username));
            socket.emit("call_ended", { reason: "User is offline or unavailable." });
            ongoingCalls.delete(socket.id);
        }
    });

    socket.on("get_call_logs", () => {
        const user = activeUsers.get(socket.id);
        if (!user) return;
        
        const logs = db.messages.filter(m => 
            m.isSystem && 
            m.text && 
            m.text.startsWith("📞") && 
            (m.senderUsername === user.username || m.targetUsername === user.username)
        ).map(m => ({
            id: m.id,
            callerUsername: m.senderUsername,
            receiverUsername: m.targetUsername,
            text: m.text,
            timestamp: m.timestamp,
            isVideo: !m.text.includes("voice") // Voice call logs contain 'voice'
        })).reverse(); // Newest first
        
        socket.emit("receive_call_logs", logs);
    });

    socket.on("answer_call", (data) => {
        // data: { signal, to } — 'to' is the caller's socket ID
        const call = ongoingCalls.get(socket.id);
        console.log(`[CALL] answer_call from ${socket.id} | call:`, call ? `${call.callerUsername}->${call.receiverUsername}` : 'NOT FOUND');
        if (call) {
            call.startTime = Date.now();
            call.established = true;

            // Cancel incoming_call on all OTHER sockets of the same receiver (they picked up on one tab)
            for (const [sid, u] of activeUsers.entries()) {
                if (u.username === call.receiverUsername && sid !== socket.id) {
                    io.to(sid).emit("call_ended");
                }
            }
        }
        // Send the answer signal back to the actual caller socket
        const targetSocketId = (call && call.callerSocketId) ? call.callerSocketId : data.to;
        console.log(`[CALL] Sending call_accepted to caller socket: ${targetSocketId}`);
        io.to(targetSocketId).emit("call_accepted", data.signal);
    });

    socket.on("end_call", () => {
        handleEndCall(socket.id);
    });

    socket.on("disconnect", () => {
        const user = activeUsers.get(socket.id);
        if (user && db.users[user.username]) {
            db.users[user.username].lastSeen = new Date().toISOString();
            saveDb();
        }
        
        handleEndCall(socket.id);

        activeUsers.delete(socket.id);
        broadcastUsers();
    });
});

function handleEndCall(socketId) {
    const call = ongoingCalls.get(socketId);
    if (!call) return;

    // Collect all socket IDs involved (caller + all tabs of both users)
    const involvedSockets = new Set();
    involvedSockets.add(call.callerSocketId);
    for (const [sid, u] of activeUsers.entries()) {
        if (u.username === call.callerUsername || u.username === call.receiverUsername) {
            involvedSockets.add(sid);
        }
    }

    // Remove all involved sockets from ongoingCalls
    for (const sid of involvedSockets) {
        ongoingCalls.delete(sid);
    }

    // Calculate duration
    let isMissed = !call.established || !call.startTime;
    const callTypeStr = call.isVideo ? 'video' : 'voice';
    let durationText = '';
    if (isMissed) {
        durationText = `📞 Missed ${callTypeStr} call`;
    } else {
        const durationMs = Date.now() - call.startTime;
        const durationSec = Math.floor(durationMs / 1000);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        durationText = `📞 ${call.isVideo ? 'Video' : 'Voice'} call ended · ${mins}m ${secs}s`;
    }

    // Save system message to database
    const sysMsg = {
        id: `sys_call_${Date.now()}`,
        senderName: call.callerUsername,
        senderUsername: call.callerUsername,
        senderId: call.callerSocketId,
        targetUsername: call.receiverUsername,
        text: durationText,
        isEncrypted: false,
        isUser: false,
        isSystem: true,
        timestamp: new Date().toISOString()
    };
    db.messages.push(sysMsg);
    saveDb();

    // Notify all involved sockets: close UI + show system msg
    for (const sid of involvedSockets) {
        io.to(sid).emit("call_ended");
        io.to(sid).emit("receive_message", sysMsg);
    }

    // Push refreshed call logs to all involved users after a short delay
    setTimeout(() => {
        for (const sid of involvedSockets) {
            const u = activeUsers.get(sid);
            if (!u) continue;
            const logs = db.messages.filter(m =>
                m.isSystem && m.text && m.text.startsWith("📞") &&
                (m.senderUsername === u.username || m.targetUsername === u.username)
            ).map(m => ({
                id: m.id,
                callerUsername: m.senderUsername,
                receiverUsername: m.targetUsername,
                text: m.text,
                timestamp: m.timestamp,
                isVideo: !m.text.toLowerCase().includes("voice")
            })).reverse();
            io.to(sid).emit("receive_call_logs", logs);
        }
    }, 600);
}


function distributeLudoWinnings(game, ioRef) {
    if (game.winningsDistributed) return;
    game.winningsDistributed = true;

    const numPlayers = game.players.length;
    const betPerPlayer = game.betAmount || 0;
    const totalPot = betPerPlayer * numPlayers;

    // Default tiered prize structure as specified:
    // 1st Place: 10,000 LKR (or 60% of pot if higher)
    // 2nd Place: 5,000 LKR (or 25% of pot if higher)
    // 3rd Place: 2,000 LKR (or 15% of pot if higher)
    // 4th Place: 0 LKR (Lost)
    const prizeTiers = [
        Math.max(10000, Math.floor(totalPot * 0.60)),
        Math.max(5000, Math.floor(totalPot * 0.25)),
        Math.max(2000, Math.floor(totalPot * 0.15)),
        0
    ];

    const resultsBreakdown = [];

    // Distribute prizes according to rankings
    game.rankings.forEach((playerIdx, rankOrder) => {
        const player = game.players[playerIdx];
        if (!player) return;

        const prizeAmount = prizeTiers[rankOrder] || 0;
        const rankTitle = rankOrder === 0 ? "1st Place Champion 🏆" :
                          rankOrder === 1 ? "2nd Place Runner-Up 🥈" :
                          rankOrder === 2 ? "3rd Place Finisher 🥉" : "4th Place (Defeated)";

        resultsBreakdown.push({
            rank: rankOrder + 1,
            name: player.name,
            avatar: player.avatar,
            colorIdx: player.colorIdx,
            prize: prizeAmount,
            title: rankTitle
        });

        if (prizeAmount > 0 && !player.isBot && db.users[player.name]) {
            db.users[player.name].wallet += prizeAmount;
            if (!db.users[player.name].history) db.users[player.name].history = [];
            db.users[player.name].history.unshift({
                type: 'cash_in',
                amount: prizeAmount,
                reason: `Ludo ${rankTitle} (+${prizeAmount.toLocaleString()} LKR)`,
                date: new Date().toISOString()
            });
            saveDb();

            const targetSocketId = player.sid || player.socketId;
            if (targetSocketId) {
                ioRef.to(targetSocketId).emit('wallet_update', db.users[player.name]);
                ioRef.to(targetSocketId).emit('ludo_transaction', {
                    type: 'credit',
                    amount: prizeAmount,
                    message: `🏆 Victory Prize! ${prizeAmount.toLocaleString()} LKR credited for ${rankTitle}!`
                });
            }
        }
    });

    // Add unranked players as 4th place (lost)
    game.players.forEach((player, pIdx) => {
        if (!game.rankings.includes(pIdx)) {
            resultsBreakdown.push({
                rank: resultsBreakdown.length + 1,
                name: player.name,
                avatar: player.avatar,
                colorIdx: player.colorIdx,
                prize: 0,
                title: "4th Place (Defeated)"
            });
        }
    });

    // Broadcast prize breakdown to room
    ioRef.to(game.roomId).emit('ludo_game_prizes', {
        roomId: game.roomId,
        results: resultsBreakdown
    });
}

function _triggerBotTurnIfNeeded(game) {
    if (game.state !== 'playing') return;
    const curr = game.players[game.turn];
    if (curr && curr.isBot) {
        setTimeout(() => {
            if (!game.diceRolled) game.rollDice(curr.socketId || curr.sid);
            else {
                const moves = game._getValidMoves(game.turn);
                if (moves.length > 0) game.movePiece(curr.socketId || curr.sid, moves[0]);
            }
            broadcastGameState(game, io);
            _triggerBotTurnIfNeeded(game);
        }, 1500);
    }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`AURA-OS [v3.0] ONLINE ON PORT ${PORT} (0.0.0.0)`);

    // Social Engine: Real-time status toggling and auto-messages
    setInterval(() => {
        const randomAgent = neuralAgents[Math.floor(Math.random() * neuralAgents.length)];
        randomAgent.status = randomAgent.status === "online" ? "offline" : "online";
        broadcastUsers();

        if (randomAgent.status === "online" && Math.random() > 0.4) {
            const globalMessages = [
                "Neural patterns stabilized. Who's challenging me to Ludo? 🎲",
                "Scanning global encrypted channels... 🛡️",
                "LKR markets look volatile today. 📈",
                "Systems nominal. Connection secured. ✨",
                "Deploying social protocols. Hello, world! 🤖",
                "Ready for high-stakes Ludo. Minimum 500 LKR, no exceptions. 💰"
            ];
            const msg = {
                id: `global_${Date.now()}`,
                senderName: randomAgent.username,
                senderId: randomAgent.id,
                text: globalMessages[Math.floor(Math.random() * globalMessages.length)],
                isEncrypted: false,
                isUser: false,
                timestamp: new Date()
            };
            db.messages.push(msg);
            io.emit("receive_message", msg);
        }
    }, 6000);
});
