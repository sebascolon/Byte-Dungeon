
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

let sample_session = {
    name: new String(),
    dm_id: new String(),
    set_id: new String(),
    sockets: new Map(),
    request_queue: new Array(),
    role_assignments: new Map(),
    game_cache: new Object(),
    access_requests: new Array()
}

var game_keys = new Map();

app.use(express.static('public'))
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
  });
  

io.on('connection', socket => {
    socket.on("startHosting", (room_id, uid, set, game_name) => {
        if (!game_keys.has(room_id)) { 
            game_keys.set(room_id, {
                name: game_name,
                host_id: uid,
                host_socket: socket.id,
                set_id: set,
                role_assignments: new Map(),
                sockets: new Map(),               
                request_queue: new Array(),
                game_cache: null,
                access_requests: new Array()
            });
            socket.join(room_id);
            let game_res = game_keys.get(room_id);
            game_res.sockets.set(uid, socket.id);
            game_keys.set(room_id, game_res);
            io.to(socket.id).emit("startSession", room_id),
            console.log(game_keys);
            return;
        }
        io.to(socket.id).emit("transactionFailed", (`Name: '${room_id}' already taken!`));
    });

    socket.on("confirmSession", (room_id) => {
        io.to(socket.id).emit("startSession", room_id);
    })

    socket.on("findSession", (user, name, room_id) => {
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            console.log(game_res);
            socket.join(room_id);
            socket.to(room_id).emit("socketLog", (`${name} has connected`));
            game_res.sockets.set(user, socket.id);

            console.log(game_res.role_assignments.has(user));
            let data = { 
                roomid: room_id, 
                setid: game_res.set_id, 
                roles: game_res.role_assignments.get(user), 
                game: game_res.game_cache
            };

            if (user == game_res.host_id) { 
                io.to(socket.id).emit("hostRejoin", data.roomid, data.setid, data.game); 
                game_res.host_socket = socket.id;
            }
            else 
                { io.to(socket.id).emit("joinGame", data.roomid, data.setid, data.roles, data.game); }
            game_keys.set(room_id, game_res);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    });

    socket.on("addTurn", (room_id, uid, username, requests) => {
        console.log(room_id, uid, username, requests);
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            let new_reqs = game_res.request_queue;
            new_reqs.push( {user: username, id: uid, reqs: requests} );
            game_res.request_queue = new_reqs;
            game_keys.set(game_res);
            io.to(room_id).emit("socketLog", (`'${username}' has ended turn`));
            //socket.emit("addTokenAccess", (null));
            console.log(game_res);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("startTurn", (room_id, game_data) => {
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            game_res.request_queue = new Array();
            game_res.game_cache = game_data
            console.log(game_res);
            io.to
            for (const [key, value] of game_res.role_assignments) {
                io.to(game_res.sockets.get(key)).emit("addTokenAccess", value);
            }
            io.to(room_id).emit("backupGame");
            socket.emit("grantAllAccess");
            game_keys.set(room_id, game_res);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("endTurn", (room_id) => {
        if (game_keys.has(room_id)) {
            console.log("helllloooo");
            let game_res = game_keys.get(room_id);
            socket.to(room_id).emit("addTokenAccess", (null));
            socket.emit("loadRequests", (game_res.request_queue));
            io.to(room_id).emit("syncBoards");
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("requestAccess", (room_id, uid, name, tok) => {
        console.log(room_id, uid, name, tok);
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            game_res.access_requests.push({room: room_id, display_name: name, user_id: uid, token: tok});
            game_keys.set(game_res);
            console.log(game_res);
            console.log(`'${name}' (${uid}) is requesting access to ${tok}`);
            io.to(game_res.host_socket).emit("socketLog", (`'${name}' is requesting access to ${tok}`));
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("grantAccess", (room_id, index) => {
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            let req = game_res.access_requests.splice(index, 1)[0];
            game_res.role_assignments.set(req.user_id, req.token);
            game_keys.set(room_id, game_res);
            io.to(game_res.sockets.get(req.user_id)).emit("addTokenAccess", (req.token));
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("removeAccess", (room_id, index) => {
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            let req = game_res.access_requests.splice(index, 1)[0];
            game_keys.set(room_id, game_res);
            io.to(game_res.sockets.get(req.user_id)).emit("socketLog", (`'${req.token}' access declined`));
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("getAccessRequests", (room_id) => {
        if (game_keys.has(room_id)) {
            let game_res = game_keys.get(room_id);
            io.to(game_res.host_socket).emit("loadAccessRequests", (game_res.access_requests));
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("approveRequest", (room, request, uid, msg) => {
        if (game_keys.has(room)) {
            io.to(room).emit("executeRequest", request);
            io.to(room).emit("socketLog", msg);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("removeRollRequest", (room, request_data) => {
        if (game_keys.has(room)) {
            let game_res = game_keys.get(room);
            io.to(game_res.sockets.get(request_data.user)).emit("removeRoll");
            io.to(room).emit("socketLog", ('Roll cancelled, skipping request'));
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("broadcastLog", (room, msg) => {
        if (game_keys.has(room)) {
            io.to(room).emit("socketLog", `${msg}`);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room}'`));
    })

    socket.on("emitRollRequest", (room, request_data) => {
        if (game_keys.has(room)) {
            let game_res = game_keys.get(room);
            io.to(game_res.sockets.get(request_data.user)).emit("enableRoll", (request_data));
            io.to(room).emit("socketLog", `Waiting for ${request_data.request.caster} to roll`);
            io.to(room).emit("socketLog", `To use ${request_data.request.subtype_key}, rolling 14+ is needed`);
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room}'`));
    })

    socket.on("roll20", (room, roll, name, index) => {
        if (game_keys.has(room)) {
            io.to(room).emit("socketLog", `${name} rolled a ${roll}`);
            let game_res = game_keys.get(room);
            if (roll >= 14) {
                io.to(room).emit("socketLog", `Attempt succeeded!`);
                io.to(game_res.host_socket).emit("confirmSuccess", (index));
            }
            else {
                io.to(room).emit("socketLog", `Attempt failed!`);
                io.to(game_res.host_socket).emit("confirmFailure", (index));
            }
        }
        else io.to(socket.id).emit("transactionFailed", (`Couldn't find game: '${room_id}'`));
    })

    socket.on("distributeRequest", req => {
        socket.broadcast.emit("executeRequest", req);
    });
})

if (module === require.main) {
    const PORT = parseInt(process.env.PORT) || 3000;
    server.listen(PORT, () => {
      console.log(`App listening on port ${PORT}`);
      console.log('Press Ctrl+C to quit.');
    });
  }
  // [END appengine_websockets_app]
  
  module.exports = server;