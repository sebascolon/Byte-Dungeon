import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, reload, signInWithPopup } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, documentId } from "firebase/firestore";

import { io } from "socket.io-client"
import * as wasm from "byte-dungeon";

const socket = io('https://western-rider-361904.wm.r.appspot.com');
socket.on("connect", () => {
    logMessage(`Connected to socket with id: ${socket.id} `);
})
// Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGcx717SK13eLYcMiL-Dxv38S7RvG52iY",
  authDomain: "byte-dungeon-c31b5.firebaseapp.com",
  projectId: "byte-dungeon-c31b5",
  storageBucket: "byte-dungeon-c31b5.appspot.com",
  messagingSenderId: "1051992531395",
  appId: "1:1051992531395:web:59c14e2c505c08978d1d76",
  measurementId: "G-26W1GG8662"
};

// Initialize Firebase, Auth, and Firestore
const fb_app = initializeApp(firebaseConfig);
const db = getFirestore(fb_app);

let auth = getAuth();
let googleProv = new GoogleAuthProvider();

// Allocate characters to an id
// each character has a map, onclick use has(uid)?

// while dm, roll button should be to end turn for all

// Initialize PIXI graphics
const Application = PIXI.Application;
const application = new Application({
    view: document.getElementById("grid"),
    width: window.innerWidth *.75,
    height: window.innerHeight * 0.85,
    transparent: false,
    antialias: true
});
application.renderer.backgroundColor = 0x1f1e1c;
// rgb(240, 233, 213)
const hd_moji = new PIXI.TextStyle({ fontSize: 92, fill: "white" });
const style = new PIXI.TextStyle({
    fontFamily: 'Arial',
    dropShadow: true,
    dropShadowAlpha: 0.8,
    dropShadowAngle: 2.1,
    dropShadowBlur: 4,
    dropShadowColor: '#444444',
    dropShadowDistance: 8,
    fill: ['#ffffff'],
    stroke: '#FFFFFF',
    fontSize: 60,
    fontWeight: 'lighter',
    lineJoin: 'round',
    strokeThickness: 6,
});

const basicText = new PIXI.Text('Welcome to Byte Dungeon', style);
var square_size = window.innerWidth/24;
draw_lines(window.innerWidth * 0.75/square_size, window.innerHeight * 0.84/square_size, "")
basicText.x = 20;
basicText.y = 20;
application.stage.addChild(basicText);


document.getElementById("roll-button").onclick = initialSignIn;
logMessage('Icons made by <a href="https://www.freepik.com" title="Freepik"> Freepik </a> from ' + 
    '<a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>');
logMessage("Welcome to Byte Dungeon v1");

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var current_user;
var in_game_name; 
var current_session;
var access_req_list = new Array();
var ordered_requests = new Array();
var current_game;

var set_assignments = new Map();
var requests = new Map();
var token_to_user = new Map();

var game_backup;
var user_sets = null;
var current_abil_key;

var priorButton;
var token_data;
var action_type;

var current_token;
var tokens = new Map();
var temp_toks = new Map();
var options = new Map();

let button1 = document.getElementById("button1");
let button2 = document.getElementById("button2");
let button3 = document.getElementById("button3");
let button4 = document.getElementById("button4");

var token_chars = ['🧑','👩','👹','👺','👿','👻','💀','🧙','🧚','🧛','🧝','🧞','🧟','👤','🌬','🐾','🐺','🐎','🦇','🐉','🕷',
    '🗡','⚔','🛡','🏹','👊','🔱','👑','⚒','🎶','📿','⚠','🚫','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚪'];
socket.on("socketLog", (msg) => { logMessage(msg) });
var coll = document.getElementsByClassName("collapsible");
var i;
for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if (content.style.maxHeight)
        { content.style.maxHeight = null; } 
    else 
        { content.style.maxHeight = content.scrollHeight + "px"; } 
  });
}

function clickToken() {
    clearTempTokens();
    options.clear();
    console.log(tokens.get(this)[0], tokens.get(this)[1]);
    let tok = wasm.get_char(tokens.get(this)[0], tokens.get(this)[1]); // needs try catch
    console.log(tok);
    if (tok == '0' || tok == '1') { alert("Couldn't get the char value for this clickable! Please try again"); return }
    console.log(set_assignments);
    if (!set_assignments.has(tok)) { blockCard(tok); return }   // rather than has, change this to char -> double (action points)
    if (set_assignments.get(tok) < 1) { blockCard(tok); return } // Make a different card
    token_data = wasm.get_character(tok);
    current_token = tok;
    console.log(token_data);
    button1.disabled = false;
    button1.onclick = getMoves;
    loadItems();
    loadAbles();
    loadEquip();
    // get tokens' items
    // add to list of content under button 3
    // enable button 3
    // set each interior button to getItems
    renderCard();
}

function blockCard(key) {
    document.getElementById("content2").innerHTML = '';
    document.getElementById("content3").innerHTML = '';
    document.getElementById("content4").innerHTML = '';

    button1.disabled = true;
    button2.disabled = true;
    button3.disabled = true;
    button4.disabled = true;

    document.getElementById("card").innerHTML = '<h1 class="card-alt">Content Obscured</h1>' + 
        '<button id="access-button" class="collapsible">Request access to this character </button>';
    document.getElementById("access-button").onclick = accessRequest;
    options.set("access-button", key);
}

function accessRequest() {
    console.log("HERE");
    console.log(current_session, current_user, in_game_name, options.get("access-button"));
    socket.emit("requestAccess", current_session, current_user, in_game_name, options.get("access-button"));
}

socket.on("loadAccessRequests", (list) => {
    console.log(list);
    access_req_list = list;
    listRequests();
})

function listRequests() {
    document.getElementById("card").innerHTML = '<h1 class="card-head">Requests</h1>';
    for(var i = 0; i < access_req_list.length; i++) {
        document.getElementById("card").innerHTML = document.getElementById("card").innerHTML + 
        '<div style="border-bottom: 2.5px solid rgb(100, 100, 100)" id="access-div' + i +  '">' +
        '<p class="card-alt">' + access_req_list[i].display_name + ' is requesting access to ' + access_req_list[i].token + '</p>' +
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="access-approve' + i + '"> Approve' + '</button>' + 
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="access-decline' + i + '"> Decline' + '</button>' + 
        '</div>';
        options.set('access-approve' + i, i);
        options.set('access-decline' + i, i);
    }
    for(var i = 0; i < access_req_list.length; i++) {
        document.getElementById("access-approve" + i.toString()).onclick = grantAccess;
        document.getElementById("access-decline" + i.toString()).onclick = removeAccess;
    }

    console.log(ordered_requests);
    for(var i = 0; i < ordered_requests.length; i++) {
        let str = '';
        switch(ordered_requests[i].action_type) {
            case 0: str = `${ordered_requests[i].caster} moves to (${ordered_requests[i].target_cell[0]}, ${ordered_requests[i].target_cell[1]})`; break;
            case 1: str = `${ordered_requests[i].caster} uses ${game_backup.characters[ordered_requests[i].caster].sheet.items[ordered_requests[i].subtype_key].name}`; break;
            case 2: str = `${ordered_requests[i].caster} uses ${game_backup.abilities[ordered_requests[i].subtype_key].name}`; break;
            case 3: str =`${ordered_requests[i].caster} unequips item from ${ordered_requests[i].subtype_key}`; break;
            default:str = 'Error occured when loading request'; break;
          }
        document.getElementById("card").innerHTML = document.getElementById("card").innerHTML + 
        '<div style="border-bottom: 2.5px solid rgb(100, 100, 100)" id="req-div' + i +  '">' +
        '<p class="card-alt">' + str + '</p>' +
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="req-approve' + i + '"> Approve' + '</button>' + 
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="req-decline' + i + '"> Decline' + '</button>' + 
        '</div>';
        options.set('req-approve' + i, {index: i, request: ordered_requests[i], user: token_to_user.get(ordered_requests[i].caster), msg: str});
        options.set('req-decline' + i, i);
    }
    for(var i = 0; i < ordered_requests.length; i++) {
        if (ordered_requests[i].action_type == 2) { document.getElementById("req-approve" + i.toString()).onclick = deferToRoll; }
        else { document.getElementById("req-approve" + i.toString()).onclick = approveRequest; }
        document.getElementById("req-decline" + i.toString()).onclick = declineRequest;
    }
}

function deferToRoll() {
    for(var i = 0; i < access_req_list.length; i++) {
        document.getElementById("access-approve" + i.toString()).disabled = true;
        document.getElementById("access-decline" + i.toString()).disabled = true;
    }
    for(var i = 0; i < ordered_requests.length; i++) {
        document.getElementById("req-approve" + i.toString()).disabled = true;
        document.getElementById("req-decline" + i.toString()).disabled = true;
    }
    options.set("req-decline" + options.get(this.id).index.toString(), options.get(this.id));
    document.getElementById("req-decline" + options.get(this.id).index).disabled = false;
    document.getElementById("req-decline" + options.get(this.id).index).onclick = cancelRoll;
    socket.emit("emitRollRequest", current_session, options.get(this.id));
}

// calculate the modifier when the request is being generated
// applied {amount}

socket.on("backupGame", () => {
    game_backup = wasm.export_game();
    console.log("backing up");
});

function cancelRoll() {
    socket.emit("removeRollRequest", current_session, options.get(this.id));
    let index = options.get(this.id).index;
    options.set(this.id, index);
}

socket.on("removeRoll", () => {
    document.getElementById('roll-button').outerHTML = priorButton.oHTML;
    document.getElementById('roll-button').innerHTML = priorButton.iHTML;
    document.getElementById('roll-button').disabled = priorButton.dis;
    document.getElementById('roll-button').onclick = priorButton.click;
})

socket.on("enableRoll", (request_data) => {
    priorButton = { oHTML: document.getElementById('roll-button').outerHTML, iHTML: document.getElementById('roll-button').innerHTML,
        dis: document.getElementById('roll-button').disabled, click: document.getElementById('roll-button').onclick };
    document.getElementById('roll-button').disabled = false;
    document.getElementById('roll-button-label').innerHTML = 'Roll to attempt ' + game_backup.abilities[request_data.request.subtype_key].name;
    document.getElementById('roll-button').onclick = roll20;
    options.set('roll-button', request_data);
})

function roll20() {
    document.getElementById('roll-button').disabled = true;
    document.getElementById('roll-button-label').innerHTML = '';
    document.getElementById('roll-button').onclick = '';
    let roll = Math.floor(Math.random() * 20) + 1;
    let name = options.get(this.id).request.caster;
    socket.emit("roll20", current_session, roll, name, options.get(this.id).index);
    options.delete('roll-button');
}

socket.on("confirmSuccess", (index) => {
    document.getElementById("req-approve" + index.toString()).onclick = approveRequest;
    document.getElementById("req-approve" + index.toString()).disabled = false;
    document.getElementById("req-approve" + index.toString()).click();
})

socket.on("confirmFailure", (index) => {
    document.getElementById("req-decline" + index.toString()).click();
    document.getElementById("req-decline" + index.toString()).onclick = declineRequest;
    document.getElementById("req-decline" + index.toString()).click();
})

function approveRequest() {
    let data = options.get(this.id);
    // if request actiontype = 1? ability then do sumn else
    ordered_requests.splice(data.index, 1);
    socket.emit("approveRequest", current_session, data.request, data.user, data.msg);
    document.getElementById("req-div" + data.index.toString()).remove();
    listRequests();
}

function declineRequest() {
    ordered_requests.splice(options.get(this.id), 1);
    document.getElementById("req-div" + options.get(this.id)).remove();
    listRequests();
}

function grantAccess() {
    socket.emit("grantAccess", current_session, options.get(this.id));
    console.log("granting access");
    console.log(access_req_list[options.get(this.id)]);
    document.getElementById("access-div" + options.get(this.id).toString()).remove();
    getAccessRequests()
}

socket.on("addTokenAccess", (token) => {
    if (token === null) 
        { set_assignments = new Map(); blockCard(); return; }
    document.getElementById("role_id").innerHTML = 'Role: ' + game_backup.characters[token].sheet.name;
    set_assignments.set(token, 3.0);
    console.log(token);
})

function removeAccess() {
    socket.emit("removeAccess", current_session, options.get(this.id));
    console.log("removing access");
    document.getElementById("access-div" + options.get(this.id).toString()).remove();
    getAccessRequests();
}

function loadAbles() {
    button2.disabled = true;
    document.getElementById("content2").innerHTML = '';
    for (var i = 0; i < token_data.sheet.abilities.length; i++) {
        button2.disabled = false;
        document.getElementById("content2").innerHTML = document.getElementById("content2").innerHTML 
            + '<button id="abil-button' + i + '" class="mini-collapsible">' 
            + game_backup.abilities[token_data.sheet.abilities[i]].name + '</button>';
        options.set('abil-button' + i, token_data.sheet.abilities[i]);
    }
    for (var i = 0; i < token_data.sheet.abilities.length; i++) {
        document.getElementById("abil-button" + (i).toString()).onclick = getAbles;
    }
}

function loadItems() {
    button3.disabled = true;
    document.getElementById("content3").innerHTML = '';
    for (var i = 0; i < token_data.sheet.items.length; i++) {
        button3.disabled = false;
        document.getElementById("content3").innerHTML = document.getElementById("content3").innerHTML 
            + '<button id="item-button' + i + '" class="mini-collapsible">' + token_data.sheet.items[i].name + '</button>';
        options.set('item-button' + i, i);
    }
    for (var i = 0; i < token_data.sheet.items.length; i++) {
        document.getElementById("item-button" + (i).toString()).onclick = getItems;
    }
}

function loadEquip() {
    button4.disabled = true;
    document.getElementById("content4").innerHTML = '';
    var equips = new Map(Object.entries(token_data.sheet.equipment))
    var counter = 0;
    for (const [key, value] of equips) {
        button4.disabled = false;
        document.getElementById("content4").innerHTML = document.getElementById("content4").innerHTML 
            + '<button id="game-button' + counter + '" class="mini-collapsible">' + value.name + '</button>';
        options.set('game-button' + counter, key);
        counter++;
    }
    while(counter != 0) {
        counter--;
        document.getElementById("game-button" + (counter).toString()).onclick = getEquip;
    }
}

function renderCard() {
    document.getElementById("card").innerHTML = '<h1 class="card-head" style="font-style: italic">' + token_data.sheet.name + '</h1>' +
        '<h2 class="card-alt"> HP: ' + token_data.sheet.hitpoints + ' / ' + token_data.sheet.max_hp + '</h2>' + 
        '<h2 class="card-head"> Speed: ' + token_data.sheet.speed + '</h2>' + 
        '<h2 class="card-alt"> Initiative: ' + token_data.sheet.initiative + '</h2>';
    let stats = new Map(Object.entries(token_data.sheet.stats));
    let style = 'class="card-alt"';
    for (let [key, value] of stats) {
        if (style == 'class="card-alt"') {style = 'class="card-head"'; }
        else { style = 'class="card-alt"'; }
        document.getElementById("card").innerHTML = document.getElementById("card").innerHTML +
            `<h2 ${style}> ${key}: ${value} </h2>`;
    }
}

function clickOption() { 
    // make function for each type of request
    // wasm.gen_request(token, ) -> returns (ap cost, request)
    let new_row = temp_toks.get(this)[0];
    let new_col = temp_toks.get(this)[1];

    console.log(action_type, "", wasm.get_char(token_data.row, token_data.column), 
    temp_toks.get(this)[0], temp_toks.get(this)[1]);

    let ap_cost = (wasm.get_cell_distance(token_data.row, token_data.column, new_row, new_col) / token_data.sheet.speed) * 3.0;

    let req = wasm.generate_request(action_type, "", current_token, new_row, new_col);
    if (!requests.has(current_token)) {
        requests.set(current_token, new Array());
    }

    console.log(requests);
    console.log(requests.get(current_token));
    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);

    set_assignments.set(wasm.get_char(new_row, new_col), set_assignments.get(wasm.get_char(new_row, new_col))-ap_cost);
    console.log(set_assignments.get(wasm.get_char(new_row, new_col)));
    if (set_assignments.get(wasm.get_char(new_row, new_col)) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
    }
    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    clearTempTokens();
    token_data = wasm.find_character(new_row, new_col);
    current_token = wasm.get_char(new_row, new_col);
    console.log(token_data);
    let dim = wasm.get_dimensions();
    draw_lines(dim[1], dim[0], wasm.board_to_string());
    logMessage("move " + token_data.sheet.name + " to point " + new_row + ", " +  new_col);
    loadItems();
    loadAbles();
    loadEquip();
}

function clearTempTokens() {
    for (const key of temp_toks.keys()) {
        application.stage.removeChild(key);
    }
    temp_toks.clear();
}

function create_clickable(char, x, y, row, col, func, map)
{
    var label = new PIXI.Text(char, hd_moji);
    label.updateText();
    var label = new PIXI.Sprite(label.texture);
    label.anchor.set(0.5);
    label.width = square_size;
    label.height = square_size * .8;
    label.x = x;
    label.y = y;
    label.interactive = true;
    label.buttonMode = true;
    label.on('pointerdown', func);
    map.set(label, [Math.round(row), Math.round(col)]);
    application.stage.addChild(label);
}

function highlight_cells(cells, func)
{
    clearTempTokens();
    for (let cell = 0; cell < cells.length; cell++) {
        create_clickable(
            "🚩", 
            cells[cell][1] * square_size + square_size/2,
            cells[cell][0] * square_size + square_size/2,
            cells[cell][0], 
            cells[cell][1],
            func,
            temp_toks
        );
    }
}

function draw_editable_grid(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j < (square_size*columns); j+= square_size)
        for (let i = 0; i < (square_size*rows); i+=square_size) {
            let char = '0';
            if (!end_of_tiles) 
                { char = tile_map[tile]; }
            createTogglable(char, i + square_size/2, j + square_size/2, j/square_size, i/square_size);
            if (tile >= tile_map.length) { end_of_tiles = true; } 
            tile++;
        }
}

function createTogglable(char, x, y, row, col) {
    if (char == '0') {
        const box = new PIXI.Graphics()
        .lineStyle(1, 0xBBBBBB, 1);
        box.drawRect(x, y, square_size, square_size);
        var sprite = new PIXI.Sprite(application.renderer.generateTexture(box));
    }
    else if (char == '1') {
        const box = new PIXI.Graphics()
        .lineStyle(1, 0xBBBBBB, 1);
        box.beginFill(0xAAAAAA);
        box.drawRect(x, y, square_size, square_size);
        sprite = new PIXI.Sprite(application.renderer.generateTexture(box));
    } 
    else {
        var label = new PIXI.Text(char, hd_moji);
        label.updateText();
        sprite = new PIXI.Sprite(label.texture);
        sprite.width = square_size;
        sprite.height = square_size * .8;
    }
    
    sprite.anchor.set(0.5);
    sprite.x = x;
    sprite.y = y;
    
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.on('pointerdown', toggleTile);
    temp_toks.set(sprite, {x_coord: x, y_coord: y, grid_row: Math.round(row), grid_col: Math.round(col)});
    application.stage.addChild(sprite);
}

function toggleTile() {
    let tok = temp_toks.get(this);
    createTogglable(wasm.toggle_cell(tok.grid_row, tok.grid_col), tok.x_coord, tok.y_coord, tok.grid_row, tok.grid_col);
    reloadNewCharacters();
    application.stage.removeChild(this);
}

function draw_grid(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j < (square_size*columns); j+= square_size)
        for (let i = 0; i < (square_size*rows); i+=square_size) {
            const box = new PIXI.Graphics()
            .lineStyle(1, 0xBBBBBB, 1);
            if (tile_map[tile] == '1') {
                box.beginFill(0xAAAAAA);
            }
            box.drawRect(i, j, square_size, square_size);
            var sprite = new PIXI.Sprite(application.renderer.generateTexture(box));
            sprite.anchor.set(0.5);
            sprite.x = i + square_size/2;
            sprite.y = j + square_size/2;
            application.stage.addChild(sprite);

            if (tile >= tile_map.length) { end_of_tiles = true; } 
            if (tile_map[tile] != '0' && tile_map[tile] != '1' && !end_of_tiles) {
                var label = new PIXI.Text(tile_map[tile], hd_moji);
                label.updateText();
                var label = new PIXI.Sprite(label.texture);
                label.anchor.set(0.5);
                label.width = square_size;
                label.height = square_size * .8;
                label.x = i + square_size/2;
                label.y = j + square_size/2;
                application.stage.addChild(label);
            }
            tile++;
        }
}

function draw_lines(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j < (square_size*columns); j+= square_size)
        for (let i = 0; i < (square_size*rows); i+=square_size) {
            const box = new PIXI.Graphics()
            .lineStyle(1, 0xBBBBBB, 1);
            if (tile_map[tile] == '1') {
                box.beginFill(0xAAAAAA);
            }
            box.drawRect(i, j, square_size, square_size);
            var sprite = new PIXI.Sprite(application.renderer.generateTexture(box));
            sprite.anchor.set(0.5);
            sprite.x = i + square_size/2;
            sprite.y = j + square_size/2;
            application.stage.addChild(sprite);

            if (tile >= tile_map.length) { end_of_tiles = true; } 
            if (tile_map[tile] != '0' && tile_map[tile] != '1' && !end_of_tiles) {
                create_clickable(
                    tile_map[tile], 
                    i + square_size/2,
                    j + square_size/2,
                    (j/square_size), 
                    (i/square_size),
                    clickToken,
                    tokens
                );
            }
            tile++;
        }
}

////////////////////////////////////////////////////////////////////////////////////

function conciseTimestamp() {
    let res = new Date().toString();
    return res.substring(16, 31);
}

function logMessage(msg) {
    document.getElementById("console").innerHTML = '<p class="log"> [' +
        conciseTimestamp() + '] ' + msg + '</p>' + document.getElementById("console").innerHTML;
}

const getData = () => {
    const docRef = doc(db, 'user_to_set', current_user);
    getDoc(docRef).then((response) => {
        if (response.exists()) {
            user_sets = new Map(Object.entries(response.data().sets));
            if (user_sets != null) {
                document.getElementById("content3").innerHTML = ''
                document.getElementById("content4").innerHTML = '';
                options.clear();
                button3.disabled = false;
                button4.disabled = false;
                var counter = 0;
                console.log(user_sets);
                for (const [key, value] of user_sets) {
                    document.getElementById("content3").innerHTML = document.getElementById("content3").innerHTML 
                        + '<button id="set-button' + counter + '" class="mini-collapsible">' + key + '</button>';
                    document.getElementById("content4").innerHTML = document.getElementById("content4").innerHTML 
                        + '<button id="game-button' + counter + '" class="mini-collapsible">' + key + '</button>';
                    options.set('set-button' + counter, value);
                    options.set('game-button' + counter, value);
                    counter++;
                }
                while(counter != 0) {
                    counter--;
                    document.getElementById("set-button" + (counter).toString()).onclick = startEditing;
                    document.getElementById("game-button" + (counter).toString()).onclick = startGame;
                }
                logMessage('Loaded ' + user_sets.size + ' games');
            }
        }
        else { generateTutorial(); }
    })
};
 
function saveAndExit() {
    console.log(wasm.export_game());
    let baked_game = JSON.stringify(wasm.export_game());
    console.log(baked_game);
    let docRef = doc(db, 'game_sets', current_game);
    setDoc(docRef, { "data": baked_game }, {merge: true})
            .then(() => {
                window.location.reload();
            });
}

function startEditing() {
    console.log(options);
    console.log(this.id);
    console.log(options.get(this.id));
    current_game = options.get(this.id);
    const docRef = doc(db, 'game_sets', options.get(this.id));
    getDoc(docRef).then((response) => { 
        //if (!response.exists()) { return;}
        //console.log(response.data());
        //console.log(response.data().data);
        game_backup = JSON.parse(response.data().data);
        wasm.load_game(game_backup);
        let dim = wasm.get_dimensions();
        draw_grid(dim[1], dim[0], wasm.board_to_string());
        
        document.getElementById("roll-button").disabled = false;
        document.getElementById("roll-button-label").innerHTML = 'Save and exit';
        document.getElementById("roll-button").onclick = saveAndExit;
        document.getElementById("content4").innerHTML = '';
        button3.click();
        
        button1.onclick = resizeBoard;
        button2.onclick = placeWalls;
        button3.onclick = '';
        button4.onclick = '';

        button1.innerHTML = "Resize board";
        button2.innerHTML = "Place walls";
        button3.innerHTML = "Add game piece";
        button4.innerHTML = "Place tokens";

        button1.disabled = false;
        button2.disabled = false;
        button3.disabled = false;
        button4.disabled = true;

        document.getElementById("content3").innerHTML = 
        '<button id="add-effect" class="mini-collapsible">Add effect</button>' + 
        '<button id="add-ability" class="mini-collapsible">Add ability</button>' + 
        '<button id="add-item" class="mini-collapsible">Add item</button>' + 
        '<button id="add-character" class="mini-collapsible">Add character</button>';

        document.getElementById("add-effect").onclick = addEffect;
        document.getElementById("add-ability").onclick = addAbility;
        document.getElementById("add-item").onclick = addItem;
        document.getElementById("add-character").onclick = addCharacter;
    });
}

const addEffect = () => {
    document.getElementById("card").style.height = '70%';
    document.getElementById("card").innerHTML = '<h1 class="card-head">New effect</h1>' + 
        `<form name="effectForm" style="margin: 5px; font-family:Helvetica;">
        Name: <input type="text" name="name" style="margin-top: 8px" required> <br>
        Duration: <input type="number" name="duration" style="margin-top: 8px" required> <br>
        Affected Stat: <input type="text" name="stat" style="margin-top: 8px" required> <br>
        Min effect amount: <input type="number" name="min" style="margin-top: 8px" required> <br>
        Max effect amount: <input type="number" name="max" style="margin-top: 8px" required> <br>
        <label for="temp"> Temporary? </label> 
        <input type="checkbox" name="temp" style="margin-top: 8px"> <br>
        <input id="a" type="submit" value="Submit" style="margin-top: 5px; padding: 2px">
        </form>`;
        document.effectForm.onsubmit = function(e) {
            e = e || window.event;
            e.preventDefault();
            alert(document.forms["effectForm"]["name"].value);
            wasm.add_effect(
                document.forms["effectForm"]["name"].value, 
                document.forms["effectForm"]["duration"].value, 
                document.forms["effectForm"]["stat"].value,
                document.forms["effectForm"]["min"].value,
                document.forms["effectForm"]["max"].value,
                document.forms["effectForm"]["temp"].checked
            );
            document.getElementById("card").style.height = '0%';
            document.getElementById("card").innerHTML = '';
            console.log(wasm.export_game());
            e.returnValue = false;
        };
}

const addAbility = () => {
    document.getElementById("card").style.height = '70%';
    let effects = new Map(Object.entries(wasm.export_game().effects));
    let effect_options = '<option value="">None</option>';
    for (let key of effects.keys()) {
        effect_options += `<option value="${key}">${key}</option>`;
    }
    document.getElementById("card").innerHTML = '<h1 class="card-head">New ability</h1>' + 
        `<form id="abil-form" name="abilityForm" style="margin: 5px; font-family:Helvetica;">
        <input id="a" type="submit" value="Submit" style="margin-top: 5px; padding: 2px"> <br>
        Name: <input type="text" name="name" style="margin-top: 8px" required> <br>
        Range: <input type="number" name="range" style="margin-top: 8px" required> <br>
        Action Points: <input type="select" min="1" max="5" name="ap" style="margin-top: 8px" required> <br>
        Casting roll min: <input type="number" name="min" style="margin-top: 8px" required> <br>
        Casting roll max: <input type="number" name="max" style="margin-top: 8px" required> <br>
        Stat modifier: <input type="text" name="mod" style="margin-top: 8px"> <br>
        Requirement: <input type="text" name="require" style="margin-top: 8px"> <br>
        <label for="target">Target effect:</label> <select id="target" name="target" form="abil-form">${effect_options}</select>
        <br><label for="caster">Caster effect:</label> <select id="caster" name="caster" form="abil-form">${effect_options}</select></form>`;
    document.abilityForm.onsubmit = function(e) {
        e = e || window.event;
        e.preventDefault();
        let targ = document.forms["abilityForm"]["target"].value;
        let cast = document.forms["abilityForm"]["caster"].value;
        let reqs = document.forms["abilityForm"]["require"].value;
        let mod = document.forms["abilityForm"]["mod"].value;     // may be null

        if (targ == "") { targ = null; }
        if (cast == "") { cast = null; }
        if (reqs == "") { reqs = null; }
        if (mod == "") { mod = null; }
        wasm.add_ability(
            document.forms["abilityForm"]["name"].value,    // 
            document.forms["abilityForm"]["range"].value,// 
            document.forms["abilityForm"]["ap"].value,
            document.forms["abilityForm"]["min"].value,
            document.forms["abilityForm"]["max"].value,
            mod,
            reqs, // may be null
            targ,  // may be NONE
            cast   // may be NONE
        );
        console.log(wasm.export_game());
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    };
}

const addItem = () => {
    document.getElementById("card").style.height = '70%';
    let effects = new Map(Object.entries(wasm.export_game().effects));
    let effect_options = '<option value="">None</option>';
    for (let key of effects.keys()) {
        effect_options += `<option value="${key}">${key}</option>`;
    }
    let abilities = new Map(Object.entries(wasm.export_game().abilities));
    let ability_options = '<option value="">None</option>';
    for (let key of abilities.keys()) {
        ability_options += `<option value="${key}">${key}</option>`;
    }
    document.getElementById("card").innerHTML = '<h1 class="card-head">New item</h1>' + 
        `<form id="item-form" name="itemForm" style="margin: 5px; font-family:Helvetica;">
        <input id="a" type="submit" value="Submit" style="margin-top: 5px; padding: 2px"> <br>
        Name: <input type="text" name="name" style="margin-top: 8px" required> <br>
        Uses: <input type="number" name="uses" style="margin-top: 8px" required> <br>
        Weight: <input type="select" min="0" name="weight" style="margin-top: 8px" required> <br>
        Equipment slot: <input type="text" name="slot" style="margin-top: 8px"> <br>
        <label for="effect">Effect:</label> <select id="effect" name="effect" form="item-form">${effect_options}</select><br>
        <label for="ability">Ability:</label> <select id="ability" name="ability" form="item-form">${ability_options}</select>
        </form>`;
    document.itemForm.onsubmit = function(e) {
        e = e || window.event;
        e.preventDefault();
        let slot = document.forms["itemForm"]["slot"].value;
        let effx = document.forms["itemForm"]["effect"].value;
        let abil = document.forms["itemForm"]["ability"].value;

        if (slot == "") { slot = null; }
        if (effx == "") { effx = null; }
        if (abil == "") { abil = null; }
        wasm.add_item(
            document.forms["itemForm"]["name"].value,    // 
            document.forms["itemForm"]["uses"].value,// 
            document.forms["itemForm"]["weight"].value,
            slot,
            effx, // may be null
            abil  // may be NONE
        );
        console.log(wasm.export_game());
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    };
}

const addCharacter = () => {
    document.getElementById("card").style.height = '70%';
    let token_options = '';
    for(const tok of token_chars) {
        token_options += `<option value="${tok}">${tok}</option>`
    }
    let items = new Map(Object.entries(wasm.export_game().items));
    let item_options = '<option value="">None</option>';
    for (let key of items.keys()) {
        item_options += `<option value="${key}">${key}</option>`;
    }
    let abilities = new Map(Object.entries(wasm.export_game().abilities));
    let ability_options = '<option value="">None</option>';
    for (let key of abilities.keys()) {
        ability_options += `<option value="${key}">${key}</option>`;
    }
    document.getElementById("card").innerHTML = '<h1 class="card-head">New item</h1>' + 
        `<form id="character-form" name="characterForm" style="margin: 5px; font-family:Helvetica;">
        <input id="a" type="submit" value="Submit" style="margin-top: 5px; padding: 2px"> <br>
        <label for="effect">Token:</label> 
        <select id="token" name="token" style="margin-top: 8px"form="character-form" require>${token_options}</select>
        Name: <input type="text" name="name" style="margin-top: 8px" required> <br>
        Speed: <input type="number" name="speed" min="0" style="margin-top: 8px" required> <br>
        Initiative: <input type="number" name="init" min="0" style="margin-top: 8px" required> <br>
        Hitpoints: <input type="number" name="hp" min="0" style="margin-top: 8px" required> <br>
        Max hitpoints: <input type="number" name="max" min="0" style="margin-top: 8px" required> <br>
        Strength: <input type="number" name="str" min="-5" max="5" style="margin-top: 8px" required> <br>
        Dexterity: <input type="number" name="dex" min="-5" max="5" style="margin-top: 8px" required> <br>
        Constitution: <input type="number" name="con" min="-5" max="5" style="margin-top: 8px" required> <br>
        Intelligence: <input type="number" name="int" min="-5" max="5" style="margin-top: 8px" required> <br>
        Wisdom: <input type="number" name="wis" min="-5" max="5" style="margin-top: 8px" required> <br>
        Charisma: <input type="number" name="cha" min="-5" max="5" style="margin-top: 8px" required> <br>
        Trait: <input type="text" name="trait" style="margin-top: 8px"> <br>
        <p style="font-family:Helvetica; margin-top: 8px; font-style: italic;">-- Hold ctrl/command to select multiple --</p>
        <label for="effect">Items:</label> 
        <select id="items" name="items" style="margin-top: 8px"form="character-form" multiple>${item_options}</select>
        <label for="effect">Ability:</label> 
        <select id="abils" name="abils" style="margin-top: 8px" form="character-form" multiple>${ability_options}</select>
        </form>`;
    
    document.characterForm.onsubmit = function(e) {
        e = e || window.event;
        e.preventDefault();
        console.log(document.forms["characterForm"]["abils"]);
        console.log(document.forms["characterForm"]["abils"].options);
        
        let trait = null;
        if (document.forms["characterForm"]["trait"].value != "") {
            trait = document.forms["characterForm"]["trait"].value;
        }
        wasm.add_character(
            document.forms["characterForm"]["token"].value,
            document.forms["characterForm"]["name"].value,    
            document.forms["characterForm"]["speed"].value, 
            document.forms["characterForm"]["init"].value,
            document.forms["characterForm"]["hp"].value,
            document.forms["characterForm"]["max"].value,
            document.forms["characterForm"]["str"].value,
            document.forms["characterForm"]["dex"].value,
            document.forms["characterForm"]["con"].value,
            document.forms["characterForm"]["int"].value,
            document.forms["characterForm"]["wis"].value,
            document.forms["characterForm"]["cha"].value,
            trait
        );
        for (var option of document.forms["characterForm"]["items"].options){
            if (option.selected) {
                if (option.value != "") {
                    wasm.give_item(document.forms["characterForm"]["token"].value, option.value);
                }
            }
        }
        for (var option of document.forms["characterForm"]["abils"].options){
            if (option.selected) {
                if (option.value != "") {
                    wasm.give_ability(document.forms["characterForm"]["token"].value, option.value);
                }
            }
        }
        reloadNewCharacters();
        console.log(wasm.export_game());
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    }; 
}

const reloadNewCharacters = () => {
    document.getElementById("content4").innerHTML = '';
    document.getElementById("button4").disabled = true;
    let characters = new Map(Object.entries(wasm.export_game().sheets));
    let index = 0;
    for (const key of characters.keys()) {
        document.getElementById("button4").disabled = false;
        document.getElementById("content4").innerHTML = document.getElementById("content4").innerHTML + 
            `<button id="tok-button${index}" class="mini-collapsible">${key}</button>`;
        options.set('tok-button' + index, key);
        index++;
    }
    while(index != 0) {
        index--;
        document.getElementById("tok-button" + (index).toString()).onclick = getOpenSpaces;
    }
}

function getOpenSpaces() {
    current_token = options.get(this.id);
    let dim = wasm.get_dimensions();
    let columns = dim[0];
    let rows = dim[1];
    draw_grid(dim[1], dim[0], wasm.board_to_string());
    let tile_map = wasm.board_to_string();
    temp_toks.clear();
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j < (square_size*columns); j+= square_size)
        for (let i = 0; i < (square_size*rows); i+=square_size) {
            if (!end_of_tiles){
                if (tile_map[tile] != '0') {
                    tile++;
                    continue;
                }
            }
            create_clickable('🚩', i + square_size/2, j + square_size/2, j/square_size, i/square_size, placeToken, temp_toks);
            if (tile >= tile_map.length) { end_of_tiles = true; } 
            tile++;
        }
}

function placeToken() {
    wasm.place_token(current_token, temp_toks.get(this)[0], temp_toks.get(this)[1]);
    reloadNewCharacters();
    let dim = wasm.get_dimensions();
    draw_grid(dim[1], dim[0], wasm.board_to_string());
}

function placeWalls() {
    let dim = wasm.get_dimensions();
    draw_editable_grid(dim[1], dim[0], wasm.board_to_string());
}

function resizeBoard() {
    let row_prompt = parseInt(prompt("Enter the new number of rows for the grid"));
    let col_prompt = parseInt(prompt("Enter the new number of columns for the grid"));
    if (row_prompt == NaN || col_prompt == NaN ||row_prompt == null || col_prompt === null) {
        alert("Please only enter integer values!");
        return;
    }
    wasm.resize_board(row_prompt, col_prompt);
    draw_grid(col_prompt, row_prompt, wasm.board_to_string());
    console.log(wasm.export_game());
}

const tutorial = `{"characters":{"🐉":{"row":2,"column":18,"initiative":2,"sheet":{"name":"Dragon Boss","speed":2,"initiative":2,"hitpoints":14,"max_hp":14,"stats":{"Intelligence":-1,"Wisdom":0,"Strength":4,"Constitution":3,"Dexterity":-3,"Charisma":-4},"traits":[],"items":[],"equipment":{},"abilities":["Slash"],"effects":{}}},"🧝":{"row":0,"column":0,"initiative":4,"sheet":{"name":"Warrior","speed":5,"initiative":4,"hitpoints":20,"max_hp":20,"stats":{"Wisdom":-2,"Strength":3,"Intelligence":0,"Constitution":1,"Charisma":-1,"Dexterity":5},"traits":[],"items":[{"name":"Short sword","uses":-1,"weight":2,"slots":["main_hand"],"effects":[],"abilities":["Slash"]}],"equipment":{},"abilities":[],"effects":{}}},"💀":{"row":6,"column":2,"initiative":0,"sheet":{"name":"Skeleton","speed":4,"initiative":0,"hitpoints":10,"max_hp":10,"stats":{"Constitution":-2,"Strength":2,"Charisma":0,"Wisdom":-4,"Intelligence":-2,"Dexterity":5},"traits":[],"items":[{"name":"Short sword","uses":-1,"weight":2,"slots":["main_hand"],"effects":[],"abilities":["Slash"]}],"equipment":{},"abilities":[],"effects":{}}}},"sheets":{},"abilities":{"Slash":{"name":"Slash","range":1,"action_points":2,"casting_roll":[1,20],"stat_modifier":null,"requirements":[],"target_effects":["Slash damage"],"caster_effects":[]}},"effects":{"Slash":{"name":"Slash","duration":0,"target_stat":"health","modifier":[-10,-1],"temporary":false},"Slash damage":{"name":"Slash damage","duration":0,"target_stat":"health","modifier":[-10,-1],"temporary":false}},"items":{"Short sword":{"name":"Short sword","uses":-1,"weight":2,"slots":["main_hand"],"effects":[],"abilities":["Slash"]}},"grid":[["🧝","0","0","1","0","0","0","1","0","0","0","0","0","0","0","0","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","1","0","0","0","1","0","1","1","1","1","1","1","1","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","1","0","0","0","0","0","0","0","1","0","0","🐉","0","0","0","0","0","0","0","0","0","0","0"],["1","1","1","1","1","1","0","1","1","1","1","1","1","1","0","1","0","0","0","0","0","1","1","1","1","0","0","1","1","1"],["0","0","0","0","0","0","0","1","0","0","0","0","0","0","0","1","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","1","0","1","1","1","1","1","1","1","1","1","0","1","1","1","0","0","1","1","1","1","1","0"],["0","0","💀","0","0","0","0","1","0","0","0","0","0","0","0","1","0","1","0","1","0","0","0","0","1","0","0","0","0","0"],["1","1","0","1","1","1","1","1","1","1","1","0","1","1","1","1","0","1","0","1","0","0","0","0","1","0","0","0","0","0"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","0","1","0","1","0","1","1","0","1","1","1","1","1","1","1","1"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","0","1","0","1","0","1","0","0","0","0","0","0","0","0","0","0"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","0","0","0","1","0","1","1","1","1","1","1","1","1","1","1","0"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","0","0","1","1","0","1","0","0","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","0","0","0","0","0","1","0","1","1","1","0","0","1","0","0","0","1","1","1","1","1","1","0"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","1","0","0","0","1","1","0","0","0","1","0","0","0","0","0","0"],["0","0","0","1","0","0","0","0","0","0","0","0","1","0","0","0","1","1","1","0","0","0","0","1","0","0","0","0","0","0"]],"requests":[]}`;

const generateTutorial = () => {
    wasm.reset_session();
    wasm.load_game(JSON.parse(tutorial));
    let baked_game = JSON.stringify(wasm.export_game());
    addDoc(collection(db, 'game_sets'), { "data": baked_game }).then((response)=> {
        setDoc(doc(db, 'user_to_set', current_user), { sets: { "Tutorial": response.id } }, { merge: true })
            .then(() => {
                getData();
                logMessage("Added tutorial map to your games");
            });
        wasm.reset_session();
    })
}

function initialSignIn() {
    signInWithPopup(auth, googleProv)
        .then((response) => {
        document.getElementById("user_id").innerHTML = 'User: ' + response.user.displayName;
        logMessage('Welcome ' + response.user.displayName);
        current_user = response.user.uid;
        in_game_name = response.user.displayName;
        getData();
        console.log(user_sets);
        uponSigningIn();
    })
}

function getMoves() {
    action_type = 0;
    let distance = (set_assignments.get(current_token) / 3.0) * token_data.sheet.speed;
    highlight_cells(wasm.collect_cell_options(token_data.row, token_data.column, distance, false), clickOption);
}

function getAbles() {
    action_type = 1;
    current_abil_key = options.get(this.id);
    let abil_range = game_backup.abilities[current_abil_key].range;
    if (abil_range > 0) {
        highlight_cells(wasm.collect_cell_options(token_data.row, token_data.column, abil_range, true), clickTarget);
    }
}

function clickTarget() {
    let new_row = temp_toks.get(this)[0];
    let new_col = temp_toks.get(this)[1];
    let char = wasm.get_char(token_data.row, token_data.column);
    console.log(action_type, current_abil_key, wasm.get_char(token_data.row, token_data.column), new_row, new_col);

    let req = wasm.generate_request(action_type, current_abil_key, char, new_row, new_col);
    if (!requests.has(current_token)) {
        requests.set(current_token, new Array());
    }
    
    console.log(requests);
    console.log(requests.get(current_token));
    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);

    set_assignments.set(char, set_assignments.get(current_token)-2);
    if (set_assignments.get(current_token) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
    }

    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    token_data = wasm.find_character(token_data.row, token_data.column);
    console.log(token_data);
    clearTempTokens();
    loadItems();
    loadAbles();
    loadEquip();
}

socket.on("executeRequest", (req) => {
    console.log(req);
    wasm.execute_request(req);
    clearTempTokens();
    let dim = wasm.get_dimensions();
    draw_lines(dim[1], dim[0], wasm.board_to_string());
    clearTempTokens();

    if (token_data === undefined) return;
    if (!set_assignments.has(req.caster)) return;
    if (set_assignments.get(req.caster) <= 0) return;

    options.clear();
    token_data = wasm.get_character(req.caster); // bugged idk
    renderCard();
    loadItems();
    loadAbles();
    loadEquip();
});

function getItems() {
    action_type = 2;
    console.log(action_type, options.get(this.id).toString(), wasm.get_char(token_data.row, token_data.column), 0, 0);
    
    let req = wasm.generate_request(action_type, options.get(this.id).toString(), wasm.get_char(token_data.row, token_data.column), 0, 0);
    if (!requests.has(req.caster)) {
        requests.set(req.caster, new Array());
    }
    
    console.log(requests);
    console.log(requests.get(current_token));
    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);

    set_assignments.set(req.caster, set_assignments.get(current_token)-1);
    if (set_assignments.get(current_token) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
    }
    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    token_data = wasm.find_character(token_data.row, token_data.column);
    console.log(token_data);
    clearTempTokens();
    loadItems();
    loadAbles();
    loadEquip();
}

socket.on("updateBackup", () => {
    game_backup = wasm.export_game();
})

function getAccessRequests() { 
    console.log("geetting requests");
    console.log(current_session);
    socket.emit("getAccessRequests", current_session); 
}

function getEquip() {
    action_type = 3;
    console.log(action_type, options.get(this.id).toString(), wasm.get_char(token_data.row, token_data.column), 0, 0);
    
    let req = wasm.generate_request(action_type, options.get(this.id).toString(), wasm.get_char(token_data.row, token_data.column), 0, 0);
    if (!requests.has(req.caster)) {
        requests.set(req.caster, new Array());
    }
    
    console.log(requests);
    console.log(requests.get(req.caster));
    let new_arr = requests.get(req.caster);
    new_arr.push(req);
    requests.set(req.caster, new_arr);

    set_assignments.set(req.caster, set_assignments.get(req.caster)-2);
    if (set_assignments.get(req.caster) <= 0) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(req.caster));
        requests.clear();
    }
    
    token_data = wasm.find_character(token_data.row, token_data.column);
    console.log(token_data);
    clearTempTokens();
    loadItems();
    loadAbles();
    loadEquip();
}

document.chat.onsubmit = function(e) {
    e = e || window.event;
    e.preventDefault();
    socket.emit("broadcastLog", current_session, `${in_game_name} says: ${document.forms["chat"]["msg"].value}`);
    document.forms["chat"]["msg"].value = '';
    e.returnValue = false;
};

socket.on("transactionFailed", (str) => { alert(str) });

socket.on("startSession", (room) => {
    console.log(game_backup);
    current_session = room;
    
    document.getElementById("msg").disabled = false;
    document.getElementById("sub").disabled = false;

    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    for (const key in game_backup.characters) {
        set_assignments.set(`${key}`, 3.0);
    }

    console.log(set_assignments);
    application.stage.removeChild(basicText);
    let dim = wasm.get_dimensions();
    draw_lines(dim[1], dim[0], wasm.board_to_string());
    
    document.getElementById("role_id").innerHTML = 'Role: <button id="dm-button">Dungeon Master</button>';
    document.getElementById("dm-button").disabled = false;
    document.getElementById("dm-button").onclick = getAccessRequests;
    document.getElementById("card").style.height = "70%";
    document.getElementById("roll-button").disabled = false;
    document.getElementById("roll-button-label").innerHTML = "End turn";
    document.getElementById("roll-button").onclick = endTurn;
    
    button1.onclick = getMoves;
    button2.onclick = null;
    button3.onclick = null;
    button4.onclick = null;

    button1.innerHTML = "Movements";
    button2.innerHTML = "Abilities";
    button3.innerHTML = "Items";
    button4.innerHTML = "Equipment";

    button1.disabled = true;
    button2.disabled = true;
    button3.disabled = true;
    button4.disabled = true;
    
    document.getElementById("content3").innerHTML = "";
    document.getElementById("content4").innerHTML = "";

    logMessage("Click the dungeon master button on the right to manage pending requests");
    logMessage("You have " + 3 + " actions left");
});

socket.on("loadRequests", (requests) => {
    console.log(requests);
    token_to_user = new Map();
    for(var i = 0; i < requests.length; i++) {
        token_to_user.set(requests[i].reqs[0].caster, requests[i].id);
        wasm.insert_request(requests[i].reqs[0].caster, requests[i].reqs);
    }
    wasm.sort_requests();
    ordered_requests = wasm.get_requests();
    listRequests();
})

function endTurn() {
    socket.emit("endTurn", current_session);
    document.getElementById("roll-button").disabled = false;
    document.getElementById("roll-button-label").innerHTML = "Start next turn";
    document.getElementById("roll-button").onclick = startTurn;
}

function startTurn() {
    console.log("hello");
    socket.emit("startTurn", current_session, JSON.stringify(wasm.export_game()));
    document.getElementById("roll-button").disabled = false;
    document.getElementById("roll-button-label").innerHTML = "End turn";
    document.getElementById("roll-button").onclick = endTurn;
}

socket.on("grantAllAccess", () => {
    for (const key in wasm.export_game().characters) {
        set_assignments.set(`${key}`, 3.0);
    }
})

function startGame() {
    console.log(options);
    console.log(this.id);
    const docRef = doc(db, 'game_sets', options.get(this.id));
    getDoc(docRef).then((response) => { 
        if (!response.exists()) { return;}
        game_backup = JSON.parse(response.data().data);
        wasm.load_game(game_backup);
        let room = prompt("Enter a room name");
        if (room === null) return
        socket.emit("startHosting", room, current_user, options.get(this.id), this.innerHTML);
    });
}

function signOut() {
    user_sets = null;
    current_user = null;
    current_session = null;
    window.location.reload();
}

function initCreation() {
    var set_name = prompt("Enter a name for the new game");
    if (set_name === null) { return; }
    if (user_sets != null) { 
        if (user_sets.has(set_name)) {
            alert(set_name + ' already taken!'); 
            return;
        }
    }

    wasm.reset_session();
    let baked_game = JSON.stringify(wasm.export_game());
    addDoc(collection(db, 'game_sets'), { "data": baked_game }).then((response)=> {
        setDoc(doc(db, 'user_to_set', current_user), { sets: { [`${set_name}`]: response.id } }, { merge: true })
            .then(() => {
                logMessage('Added new game: ' + `${set_name}`);
                getData();
            });
    })
}

socket.on("syncBoards", () => {
    wasm.load_game(game_backup);    
    let dim = wasm.get_dimensions();
    draw_lines(dim[1], dim[0], wasm.board_to_string());
})

function transitionPage() {
    application.stage.removeChild(basicText);
    let dim = wasm.get_dimensions();
    draw_lines(dim[1], dim[0], wasm.board_to_string());
    
    document.getElementById("card").style.height = "70%";
    document.getElementById("roll-button").disabled = true;
    document.getElementById("roll-button").onclick = '';
    document.getElementById("roll-button-label").innerHTML = "";
    
    button1.onclick = getMoves;
    button2.onclick = null;
    button3.onclick = null;
    button4.onclick = null;

    button1.innerHTML = "Movements";
    button2.innerHTML = "Abilities";
    button3.innerHTML = "Items";
    button4.innerHTML = "Equipment";

    button1.disabled = true;
    button2.disabled = true;
    button3.disabled = true;
    button4.disabled = true;
    
    document.getElementById("content3").innerHTML = "";
    document.getElementById("content4").innerHTML = "";

    logMessage("You have " + 3 + " actions left");

    document.getElementById("msg").disabled = false;
    document.getElementById("sub").disabled = false;
}

socket.on("joinGame", (room, key, assignments, game) => {
    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    if (game == null) {
        const docRef = doc(db, 'game_sets', key);
        getDoc(docRef).then((response) => { 
            if (!response.exists()) { return; }
            if (assignments === null) set_assignments = new Map();
            else { 
                for (let i = 0; i <assignments.length; i++) {
                    set_assignments.set(assignments[i], 3.0);
                }
            }

            game_backup = JSON.parse(response.data().data);
            current_session = room;
            console.log(game_backup);
            wasm.load_game(game_backup);

            transitionPage();
            return;
        });
    }
    else {
        console.log(assignments);
        if (assignments === null) set_assignments = new Map();
        else { 
            for (let i = 0; i <assignments.length; i++) {
                set_assignments.set(assignments[i], 3.0);
            }
        }
        wasm.load_game(JSON.parse(game));
        game_backup = wasm.export_game();
        transitionPage();
    }
})

socket.on("hostRejoin", (room, key, game) => {
    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    console.log(room);
    if (game == null) {
        const docRef = doc(db, 'game_sets', key);
        getDoc(docRef).then((response) => { 
            if (!response.exists()) { return; }
            game_backup = JSON.parse(response.data().data);
            console.log(game_backup);
            wasm.load_game(game_backup);
            socket.emit("confirmSession", room);
            return;
        });
    }
    else {
        wasm.load_game(JSON.parse(game));
        game_backup = wasm.export_game();
        socket.emit("confirmSession", room);
    }
})

function joinGame() {
    let room = prompt("Enter session id");
    if (room === null) {return}
    current_session = room;
    socket.emit("findSession", current_user, in_game_name, room);
}

// Signed in, no session
function uponSigningIn() {
    document.getElementById("roll-button").onclick = signOut;
    document.getElementById("roll-button-label").innerHTML = 'Sign Out';
    button1.disabled = false;
    button2.disabled = false;
    button1.onclick = initCreation;
    button2.onclick = joinGame;
}

// Signed in, with a session
