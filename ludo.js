/**
 * NEURAL LUDO - Advanced Real-Time Game Engine
 * Full rules: 2-4 players, roll 6 to start, capture, safe zones, exact finish
 */

const BOARD_SIZE = 52;
const HOME_PATH_LENGTH = 6; // positions 52-57 (relative)
const FINISH_POS = 57;

// Safe positions on global board (star tiles + starting tiles)
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

// Each player's starting global position offset
const PLAYER_START_OFFSETS = [0, 13, 26, 39];

const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
const PLAYER_COLOR_HEX = ['#ef4444', '#22c55e', '#eab308', '#3b82f6'];

class LudoGame {
  constructor(roomId, betAmount = 0) {
    this.roomId = roomId;
    this.betAmount = betAmount;
    this.players = []; // { socketId, name, colorIdx, isBot, avatar }
    this.state = 'waiting'; // waiting | playing | finished
    this.pieces = []; // [playerIdx][pieceIdx] = position (-1=base, 0-51=board, 52-57=home, 57=done)
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
        // 3 consecutive 6s: cancel turn
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

    // Auto-check if there are any valid moves
    const moves = this._getValidMoves(playerIdx);
    if (moves.length === 0) {
      // No valid moves, auto-skip
      this.diceRolled = false;
      this._nextTurn();
      return { dice: this.dice, noMoves: true, state: this.serialize() };
    }
    
    // Auto-move if only 1 valid choice
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

    // Validate move
    if (!this._canMove(playerIdx, pieceIdx)) {
      return { error: 'Invalid move' };
    }

    let captured = null;

    if (piece === -1) {
      // Move from base
      if (this.dice !== 6 && this.dice !== 1) return { error: 'Need 6 or 1 to exit base' };
      this.pieces[playerIdx][pieceIdx] = 0; // Enter at position 0 (relative)
    } else {
      const newPos = piece + this.dice;
      if (newPos > FINISH_POS) return { error: 'Exceeds finish – exact number needed' };

      if (newPos === FINISH_POS) {
        this.pieces[playerIdx][pieceIdx] = FINISH_POS;
        // Check win
        if (this.pieces[playerIdx].every(p => p === FINISH_POS) && !this.rankings.includes(playerIdx)) {
          this.rankings.push(playerIdx);

          if (this.rankings.length >= this.players.length - 1) {
            // Last player automatically finishes last
            const lastPlayer = this.players.findIndex((p, i) => !this.rankings.includes(i));
            if (lastPlayer !== -1) this.rankings.push(lastPlayer);
            this.state = 'finished';
          }
          return { state: this.serialize(), won: true, rank: this.rankings.length };
        }
      } else if (newPos >= 52) {
        // Home path - safe
        this.pieces[playerIdx][pieceIdx] = newPos;
      } else {
        // On board – check capture
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

    // Extra turn on 6 (unless finished)
    if (this.dice === 6 && this.state !== 'finished' && !this.rankings.includes(playerIdx)) {
      // player gets another roll
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
          // Capture: send back to base
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

module.exports = { LudoGame, PLAYER_COLOR_HEX, PLAYER_COLORS };
