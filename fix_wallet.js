const fs = require('fs');
let content = fs.readFileSync('h:\\chatbot\\server\\index.js', 'utf8');

content = content.replace(
`            if (!db.users) db.users = {};
            if (!db.users[username]) {
                db.users[username] = { wallet: 15000, history: [{ type: 'cash_in', amount: 15000, reason: 'First Login Bonus', date: new Date().toISOString() }] };
                saveDb();
            }`,
`            if (!db.users) db.users = {};
            if (!db.users[username]) db.users[username] = {};
            
            let gotBonus = false;
            if (db.users[username].wallet === undefined) {
                db.users[username].wallet = 15000;
                if (!db.users[username].history) db.users[username].history = [];
                db.users[username].history.push({ type: 'cash_in', amount: 15000, reason: 'First Login Bonus', date: new Date().toISOString() });
                saveDb();
                gotBonus = true;
                 
            }`
);

// We should also pass gotBonus to auth_success
content = content.replace(
`            socket.emit("auth_success", { username, wallet: db.users[username].wallet });`,
`            socket.emit("auth_success", { username, wallet: db.users[username].wallet, gotBonus });`
);

fs.writeFileSync('h:\\chatbot\\server\\index.js', content);
