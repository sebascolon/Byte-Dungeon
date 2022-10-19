/*/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
 *      
 *      JavaScript Wrapper/UI for Byte Dungeon, handles user interactions and utilizes WASM module functions
 *          - By Sebastian C - August 26, 2022
 * 
 *      Implementation and Assumptions
 *          - Byte Dungeon will be built as a single page application with WASM modules, WebGL graphics, a Firestore database.
 *          - The frontend will utilize vanilla JS, using no JavaScript frameworks.
 *          - Graphical representations of grids and tokens will be drawn using WebGL (using PIXI.js graphics library).
 *          - Board data is generated, changed, and (de)serialized within the WASM module.
 *          - User authentication will be handled using Firebase authentication.
 *          - Socket.io will be used for WebSocket functionality in hosting game sessions.
 *          - Index.js will handle input events and change the contents of index.html accordingly.
 * 
 */////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, documentId } from "firebase/firestore";

import { io } from "socket.io-client"
import * as wasm from "./bd-pack/byte_dungeon"

////////////////////////////////////////////////    VARIABLES   ////////////////////////////////////////////////////////////////

var current_user;                                       // Firebase auth UID for current signed-in user
var in_game_name;                                       // Display name
var current_session;                                    // Room id of the current session
var access_req_list = new Array();                      // Array of incoming token access requests
var ordered_requests = new Array();                     // Array of incoming requests sorted by initiative
var current_game;                                       // Document ID for the current game being played

var set_assignments = new Map();                        // Char -> float (action points) map of tokens the user has access to
var requests = new Map();                               // Char -> request map of outgoing requests
var token_to_user = new Map();                          // Char -> string map of socket id's for each player

var game_backup;                                        // Deserialized game data, serves as backup and for quick lookups
var user_sets = null;                                   // Names and id's of each game set the user owns in the database
var current_abil_key;                                   // Key of the ability the user has selected

var priorButton;                                        // Saves the previous state of a button element (mostly the roll button)
var token_data;                                         // Data associated with the token the user has selected
var action_type;                                        // Type of action the user wants to perform (move, use ability/item)

var current_token;                                      // Char representation of the character the user has selected
var tokens = new Map();                                 // Copies of Token struct data for each token on the board
var temp_toks = new Map();                              // Temporary tokens for selecting a tile on the board
var options = new Map();                                // Data and functions for temporary button options

let button1 = document.getElementById("button1");       // Saving these button elements to a variable due to frequent changes
let button2 = document.getElementById("button2");  
let button3 = document.getElementById("button3");
let button4 = document.getElementById("button4");

const socket = io('http://localhost:3000/');
var square_size = window.innerWidth/24;
var token_chars =                                       // List of all char representation of tokens
    ['🧑','👩','👹','👺','👿','👻','💀','🧙','🧚','🧛','🧝','🧞','🧟','👤','🌬','🐾','🐺','🐎','🦇','🐉',
    '🕷','🗡','⚔','🛡','🏹','👊','🔱','👑','⚒','🎶','📿','⚠','🚫','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚪'];
const tutorial =                                        // JSON Stringyfied tutorial game data
    `{"characters":{"🐉":{"row":2,"column":18,"initiative":2,"sheet":{"name":"Dragon Boss","speed":2,` + 
    `"initiative":2,"hitpoints":14,"max_hp":14,"stats":{"Intelligence":-1,"Wisdom":0,"Strength":4,"Constitution":3,` +
    `"Dexterity":-3,"Charisma":-4},"traits":[],"items":[],"equipment":{},"abilities":["Slash"],"effects":{}}},` + 
    `"🧝":{"row":0,"column":0,"initiative":4,"sheet":{"name":"Warrior","speed":5,"initiative":4,"hitpoints":20,"max_hp":20, ` +
    `"stats":{"Wisdom":-2,"Strength":3,"Intelligence":0,"Constitution":1,"Charisma":-1,"Dexterity":5},"traits":[],` +
    `"items":[{"name":"Short sword","uses":-1,"weight":2,"slots":["main_hand"],"effects":[],"abilities":["Slash"]}],` +
    `"equipment":{},"abilities":[],"effects":{}}},"💀":{"row":6,"column":2,"initiative":0,"sheet":{"name":"Skeleton",` +
    `"speed":4,"initiative":0,"hitpoints":10,"max_hp":10,"stats":{"Constitution":-2,"Strength":2,"Charisma":0,"Wisdom":-4,` +
    `"Intelligence":-2,"Dexterity":5},"traits":[],"items":[{"name":"Short sword","uses":-1,"weight":2,"slots":["main_hand"],` +
    `"effects":[],"abilities":["Slash"]}],"equipment":{},"abilities":[],"effects":{}}}},"sheets":{},` +
    `"abilities":{"Slash":{"name":"Slash","range":1,"action_points":2,"casting_roll":[1,20],"stat_modifier":null,` +
    `"requirements":[],"target_effects":["Slash damage"],"caster_effects":[]}},"effects":{"Slash":{"name":"Slash",` +
    `"duration":0,"target_stat":"health","modifier":[-10,-1],"temporary":false},"Slash damage":{"name":"Slash damage",` +
    `"duration":0,"target_stat":"health","modifier":[-10,-1],"temporary":false}},"items":{"Short sword":{"name":"Short sword",`+ 
    `"uses":-1,"weight":2,"slots":["main_hand"],"effects":[],"abilities":["Slash"]}},"grid":[["🧝","0","0","1","0","0","0","1",`+
    `"0","0","0","0","0","0","0","0","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","1","0","0","0","1",`+
    `"0","1","1","1","1","1","1","1","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0","1",`+
    `"0","0","0","0","0","0","0","1","0","0","🐉","0","0","0","0","0","0","0","0","0","0","0"],["1","1","1","1","1","1","0",`+ 
    `"1","1","1","1","1","1","1","0","1","0","0","0","0","0","1","1","1","1","0","0","1","1","1"],["0","0","0","0","0","0","0",`+
    `"1","0","0","0","0","0","0","0","1","0","0","0","0","0","1","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0","0",`+
    `"1","0","1","1","1","1","1","1","1","1","1","0","1","1","1","0","0","1","1","1","1","1","0"],["0","0","💀","0","0","0",`+ 
    `"0","1","0","0","0","0","0","0","0","1","0","1","0","1","0","0","0","0","1","0","0","0","0","0"],["1","1","0","1","1","1",`+
    `"1","1","1","1","1","0","1","1","1","1","0","1","0","1","0","0","0","0","1","0","0","0","0","0"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","0","1","0","1","0","1","1","0","1","1","1","1","1","1","1","1"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","0","1","0","1","0","1","0","0","0","0","0","0","0","0","0","0"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","0","0","0","1","0","1","1","1","1","1","1","1","1","1","1","0"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","0","0","1","1","0","1","0","0","0","0","0","0","0","0","0","0"],["0","0","0","0","0","0",`+
    `"0","0","0","0","0","0","1","0","1","1","1","0","0","1","0","0","0","1","1","1","1","1","1","0"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","1","0","0","0","1","1","0","0","0","1","0","0","0","0","0","0"],["0","0","0","1","0","0",`+
    `"0","0","0","0","0","0","1","0","0","0","1","1","1","0","0","0","0","1","0","0","0","0","0","0"]],"requests":[]}`;

////////////////////////////////////////////////    INITIALIZATION   ///////////////////////////////////////////////////////////

const firebaseConfig = {                                            // Firebase configuration
  apiKey: "AIzaSyAGcx717SK13eLYcMiL-Dxv38S7RvG52iY",                // For Firebase JS SDK v7.20.0+ measurementId is optional
  authDomain: "byte-dungeon-c31b5.firebaseapp.com",
  projectId: "byte-dungeon-c31b5",
  storageBucket: "byte-dungeon-c31b5.appspot.com",
  messagingSenderId: "1051992531395",
  appId: "1:1051992531395:web:59c14e2c505c08978d1d76",
  measurementId: "G-26W1GG8662"
};

const fb_app = initializeApp(firebaseConfig);                       // Initialize Firebase, Auth, and Firestore                  
const db = getFirestore(fb_app);
let auth = getAuth();
let googleProv = new GoogleAuthProvider();

const Application = PIXI.Application;                               // Initialize PIXI graphics, colors, and styles
const application = new Application({
    view: document.getElementById("grid"),
    width: window.innerWidth *.75,
    height: window.innerHeight * 0.85,
    transparent: false,
    antialias: true
});

// Initializing content of canvas with gridlines and welcome title text
application.renderer.backgroundColor = 0x1f1e1c;
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
drawClickableGrid(window.innerWidth * 0.75/square_size, window.innerHeight * 0.84/square_size, "")
basicText.x = 20;
basicText.y = 20;
application.stage.addChild(basicText);

// Initializing content of log div, inserting messages
document.getElementById("roll-button").onclick = initialSignIn;
logMessage('Icons made by <a href="https://www.freepik.com" title="Freepik"> Freepik </a> from ' + 
    '<a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>');
logMessage("Welcome to Byte Dungeon v1");

// Collapsible buttons template courtesy of W3 Schools
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
// "Send message" button's onSubmit for messaging players in the same room
document.chat.onsubmit = function(e) {
    e = e || window.event;
    e.preventDefault();
    socket.emit("broadcastLog", current_session, `${in_game_name} says: ${document.forms["chat"]["msg"].value}`);
    document.forms["chat"]["msg"].value = '';
    e.returnValue = false;
};

////////////////////////////////////////////////    ON-LOGIN FUNCTIONS    //////////////////////////////////////////////////////

/******************************************************************************
 * initialSignIn - onClick event for login button, Google auth using popup
 *****************************************************************************/
function initialSignIn() {
    signInWithPopup(auth, googleProv)
        .then((response) => {
        document.getElementById("user_id").innerHTML = 'User: ' + response.user.displayName;
        logMessage('Welcome ' + response.user.displayName);
        current_user = response.user.uid;
        in_game_name = response.user.displayName;
        getData();
        uponSigningIn();
    })
}

/******************************************************************************
 * uponSigningIn - signInWithPopup success enables main menu buttons
 *****************************************************************************/
function uponSigningIn() {
    document.getElementById("roll-button").onclick = signOut;
    document.getElementById("roll-button-label").innerHTML = 'Sign Out';
    button1.disabled = false;
    button2.disabled = false;
    button1.onclick = initCreation;
    button2.onclick = joinGame;
}

/******************************************************************************
 * signOut - signOut button's onclick, clears vars gathered by getData, reloads
 *****************************************************************************/
function signOut() {
    user_sets = null;
    current_user = null;
    current_session = null;
    window.location.reload();
}

/******************************************************************************
 * conciseTimestamp - Date() shortened to 24 hr: HH:MM:SS + local timezone 
 *****************************************************************************/
function conciseTimestamp() {
    let res = new Date().toString();
    return res.substring(16, 31);
}

/******************************************************************************
 * logMessage - Adds concise timestamp + msg string to message log
 *****************************************************************************/
function logMessage(msg) {
    document.getElementById("console").innerHTML = '<p class="log"> [' +
        conciseTimestamp() + '] ' + msg + '</p>' + document.getElementById("console").innerHTML;
}

/******************************************************************************
 * getData - Retrieves user's gamee sets from db, lists under host and edit
 *****************************************************************************/
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

/******************************************************************************
 * initCreation - Create-game-button's onclick, adds game to set list in db
 *****************************************************************************/
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

/******************************************************************************
 * drawClickableGrid - Draws grid with clickable tokens using tilemap as string
 *****************************************************************************/
function drawClickableGrid(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j/(square_size*columns) <= .999; j+= square_size)
        for (let i = 0; i / (square_size*rows) <= .999; i+=square_size) {
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
                createClickable(
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

/******************************************************************************
 * drawStaticGrid - Draws grid without clickable tokens using tilemap as string
 *****************************************************************************/
function drawStaticGrid(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j/(square_size*columns) <= .999; j+= square_size)
        for (let i = 0; i / (square_size*rows) <= .999; i+=square_size) {
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

/******************************************************************************
 * drawEditableGrid - Draws grids with togglable tiles, only for editing
 *****************************************************************************/
function drawEditableGrid(rows, columns, tile_map)
{
    application.stage.removeChildren();
    application.renderer.resize((square_size*rows), (square_size*columns));
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j/(square_size*columns) <= .999; j+= square_size)
        for (let i = 0; i / (square_size*rows) <= .999; i+=square_size) {
            let char = '0';
            if (!end_of_tiles) 
                { char = tile_map[tile]; }
            createTogglable(char, i + square_size/2, j + square_size/2, j/square_size, i/square_size);
            if (tile >= tile_map.length) { end_of_tiles = true; } 
            tile++;
        }
}

/******************************************************************************
 * createClickable - Creates a PIXI button as a tile with a character or wall
 *****************************************************************************/
function createClickable(char, x, y, row, col, func, map)
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

/******************************************************************************
 * highlight_cells - Draws a flag to coordinates in cells array, onclick = func
 *****************************************************************************/
function highlight_cells(cells, func)
{
    clearTempTokens();
    for (let cell = 0; cell < cells.length; cell++) {
        createClickable(
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

/******************************************************************************
 * createTogglable - Creates a PIXI button toggling to an empty or walled tile
 *****************************************************************************/
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

/******************************************************************************
 * toggleTile - Toggles tile to empty or walled state and logs change to WASM
 *****************************************************************************/
function toggleTile() {
    let tok = temp_toks.get(this);
    createTogglable(wasm.toggle_cell(tok.grid_row, tok.grid_col), tok.x_coord, tok.y_coord, tok.grid_row, tok.grid_col);
    reloadNewCharacters();
    application.stage.removeChild(this);
}

/******************************************************************************
 * clickToken - Gets token data for the token being clicked if user has access
 *****************************************************************************/
function clickToken() {
    clearTempTokens();
    options.clear();
    let tok = wasm.get_char(tokens.get(this)[0], tokens.get(this)[1]);
    if (tok == '0' || tok == '1') 
        { alert("Couldn't get the char value for this clickable! Please try again"); return }
    
    if (!set_assignments.has(tok)) 
        { blockCard(tok); return }
    if (set_assignments.get(tok) < 1) 
        { blockCard(tok); return } 
    token_data = wasm.get_character(tok);
    current_token = tok;

    button1.disabled = false;
    button1.onclick = getMoves;
    loadItems();
    loadAbles();
    loadEquip();
    renderCard();
}

/******************************************************************************
 * clickDestination - Temp token's onclick, moves token the cell being clicked
 *****************************************************************************/
function clickDestination() { 
    let new_row = temp_toks.get(this)[0];
    let new_col = temp_toks.get(this)[1];

    let ap_cost = (wasm.get_cell_distance(token_data.row, token_data.column, new_row, new_col) / token_data.sheet.speed) * 3.0;

    let req = wasm.generate_request(action_type, "", current_token, new_row, new_col);
    if (!requests.has(current_token)) {
        requests.set(current_token, new Array());
    }

    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);

    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    clearTempTokens();

    set_assignments.set(wasm.get_char(new_row, new_col), set_assignments.get(wasm.get_char(new_row, new_col))-ap_cost);
    token_data = wasm.find_character(new_row, new_col);
    current_token = wasm.get_char(new_row, new_col);
    let dim = wasm.get_dimensions();
    drawClickableGrid(dim[1], dim[0], wasm.board_to_string());

    if (set_assignments.get(wasm.get_char(new_row, new_col)) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
        return;
    }
    
    logMessage("Move " + token_data.sheet.name + " to point " + new_row + ", " +  new_col);
    loadItems();
    loadAbles();
    loadEquip();
}

/******************************************************************************
 * clickTarget - Temp token clicked will be the target of the user's ability
 *****************************************************************************/
function clickTarget() {
    let new_row = temp_toks.get(this)[0];
    let new_col = temp_toks.get(this)[1];
    let char = wasm.get_char(token_data.row, token_data.column);
    let req = wasm.generate_request(action_type, current_abil_key, char, new_row, new_col);
    if (!requests.has(current_token)) { requests.set(current_token, new Array()); }
    
    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);
    set_assignments.set(char, set_assignments.get(current_token)-2);
    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    clearTempTokens();

    if (set_assignments.get(current_token) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
        return;
    }

    token_data = wasm.find_character(token_data.row, token_data.column);
    loadItems();
    loadAbles();
    loadEquip();
}

/******************************************************************************
 * clearTempTokens - Removes temp tokens from board
 *****************************************************************************/
function clearTempTokens() {
    for (const key of temp_toks.keys()) {
        application.stage.removeChild(key);
    }
    temp_toks.clear();
}


////////////////////////////////////////////////    EDIT-GAME FUNCTIONS    /////////////////////////////////////////////////////

/******************************************************************************
 * startEditing - Start editing button's onclick, loads game set from db
 *****************************************************************************/
function startEditing() {
    current_game = options.get(this.id);
    const docRef = doc(db, 'game_sets', options.get(this.id));
    getDoc(docRef).then((response) => { 
        game_backup = JSON.parse(response.data().data);
        wasm.load_game(game_backup);
        let dim = wasm.get_dimensions();
        drawStaticGrid(dim[1], dim[0], wasm.board_to_string());
        
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

/******************************************************************************
 * addEffect - Loads in form for adding an effect to a game
 *****************************************************************************/
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
            e.returnValue = false;
        };
}

/******************************************************************************
 * addAbility - Loads in form for adding an ability to a game
 *****************************************************************************/
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
        <select id="target" name="target" form="abil-form">${effect_options}</select><br>
        <select id="caster" name="caster" form="abil-form">${effect_options}</select>
        <label for="target">Target effect:</label>
        <label for="caster">Caster effect:</label></form>`;
    document.abilityForm.onsubmit = function(e) {
        e = e || window.event;
        e.preventDefault();
        let targ = document.forms["abilityForm"]["target"].value;
        let cast = document.forms["abilityForm"]["caster"].value;
        let reqs = document.forms["abilityForm"]["require"].value;
        let mod = document.forms["abilityForm"]["mod"].value;     

        if (targ == "") { targ = null; }
        if (cast == "") { cast = null; }
        if (reqs == "") { reqs = null; }
        if (mod == "") { mod = null; }
        wasm.add_ability(
            document.forms["abilityForm"]["name"].value, 
            document.forms["abilityForm"]["range"].value,
            document.forms["abilityForm"]["ap"].value,
            document.forms["abilityForm"]["min"].value,
            document.forms["abilityForm"]["max"].value,
            mod,
            reqs, 
            targ,  
            cast   
        );
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    };
}

/******************************************************************************
 * addItem - Loads in form for adding an item to a game
 *****************************************************************************/
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
            document.forms["itemForm"]["name"].value,
            document.forms["itemForm"]["uses"].value,
            document.forms["itemForm"]["weight"].value,
            slot,
            effx, 
            abil
        );
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    };
}

/******************************************************************************
 * addItem - Loads in form for adding a character to a game
 *****************************************************************************/
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
        document.getElementById("card").style.height = '0%';
        document.getElementById("card").innerHTML = '';
        e.returnValue = false;
    }; 
}

/******************************************************************************
 * reloadNewCharacters - Adds unrepresented tokens to list under "place token"
 *****************************************************************************/
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

/******************************************************************************
 * getOpenSpaces - Flags empty cells after clicking "place token"
 *****************************************************************************/
function getOpenSpaces() {
    current_token = options.get(this.id);
    let dim = wasm.get_dimensions();
    let columns = dim[0];
    let rows = dim[1];
    drawStaticGrid(dim[1], dim[0], wasm.board_to_string());
    let tile_map = wasm.board_to_string();
    temp_toks.clear();
    let tile = 0;
    let end_of_tiles = false;
    for (let j = 0; j/(square_size*columns) <= .999; j+= square_size)
        for (let i = 0; i / (square_size*rows) <= .999; i+=square_size) {
            if (!end_of_tiles){
                if (tile_map[tile] != '0') {
                    tile++;
                    continue;
                }
            }
            createClickable('🚩', i + square_size/2, j + square_size/2, j/square_size, i/square_size, placeToken, temp_toks);
            if (tile >= tile_map.length) { end_of_tiles = true; } 
            tile++;
        }
}

/******************************************************************************
 * placeToken - Places char token representation on grid and logs it in WASM
 *****************************************************************************/
function placeToken() {
    wasm.place_token(current_token, temp_toks.get(this)[0], temp_toks.get(this)[1]);
    reloadNewCharacters();
    let dim = wasm.get_dimensions();
    drawStaticGrid(dim[1], dim[0], wasm.board_to_string());
}

/******************************************************************************
 * placeWalls - "Place wall" button's onclick, draws editable version of grids
 *****************************************************************************/
function placeWalls() {
    let dim = wasm.get_dimensions();
    drawEditableGrid(dim[1], dim[0], wasm.board_to_string());
}

/******************************************************************************
 * resizeBoard - Resize board button's onclick, resizes grid and board in WASM
 *****************************************************************************/
function resizeBoard() {
    let row_prompt = parseInt(prompt("Enter the new number of rows for the grid"));
    let col_prompt = parseInt(prompt("Enter the new number of columns for the grid"));
    if (row_prompt == NaN || col_prompt == NaN ||row_prompt == null || col_prompt === null) {
        alert("Please only enter integer values!");
        return;
    }
    wasm.resize_board(row_prompt, col_prompt);
    drawStaticGrid(col_prompt, row_prompt, wasm.board_to_string());
}

/******************************************************************************
 * generateTutorial - Loads game from tutorial var into WASM and uploads to DB
 *****************************************************************************/
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

/******************************************************************************
 * saveAndExit - Saves the current game being edited to DB and reloads page
 *****************************************************************************/
function saveAndExit() {
    let baked_game = JSON.stringify(wasm.export_game());
    let docRef = doc(db, 'game_sets', current_game);
    setDoc(docRef, { "data": baked_game }, {merge: true})
            .then(() => {
                window.location.reload();
            });
}


////////////////////////////////////////////////    IN-GAME FUNCTIONS    ///////////////////////////////////////////////////////

/******************************************************************************
 * loadGameView - Changes page elements to the in-game state on loading session
 *****************************************************************************/
function loadGameView() {
    application.stage.removeChild(basicText);
    let dim = wasm.get_dimensions();
    drawClickableGrid(dim[1], dim[0], wasm.board_to_string());
    
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

/******************************************************************************
 * startGame - "Host game" button's onClick, prompts user for new session ID
 *****************************************************************************/
function startGame() {
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

/******************************************************************************
 * joinGame - "Join game" button's onClick, prompts and looks for game by ID
 *****************************************************************************/
function joinGame() {
    let room = prompt("Enter session id");
    if (room === null) { return; }
    current_session = room;
    socket.emit("findSession", current_user, in_game_name, room);
}

/******************************************************************************
 * loadAbles - Lists abilities for the currently selected character
 *****************************************************************************/
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

/******************************************************************************
 * loadItems - Lists items for the currently selected character
 *****************************************************************************/
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

/******************************************************************************
 * loadEquip - Lists equipment for the currently selected character
 *****************************************************************************/
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

/******************************************************************************
 * getMoves - Movements button's onClick, highlights where the character can go
 *****************************************************************************/
function getMoves() {
    action_type = 0;
    let distance = (set_assignments.get(current_token) / 3.0) * token_data.sheet.speed;
    highlight_cells(wasm.collect_cell_options(token_data.row, token_data.column, distance, false), clickDestination);
}

/******************************************************************************
 * getAbles - Abilities button's onClick, highlights target cells for abilities
 *****************************************************************************/
function getAbles() {
    action_type = 1;
    current_abil_key = options.get(this.id);
    let abil_range = game_backup.abilities[current_abil_key].range;
    if (abil_range > 0) {
        highlight_cells(wasm.collect_cell_options(token_data.row, token_data.column, abil_range, true), clickTarget);
    }
}

/******************************************************************************
 * getItems - Generates request to use the selected item 
 *****************************************************************************/
function getItems() {
    action_type = 2;
    let req = wasm.generate_request(action_type, options.get(this.id).toString(), current_token, 0, 0);
    if (!requests.has(req.caster)) { requests.set(req.caster, new Array()) }
    
    let new_arr = requests.get(current_token);
    new_arr.push(req);
    requests.set(current_token, new_arr);
    set_assignments.set(req.caster, set_assignments.get(current_token)-1);

    logMessage(`You have ${parseInt(set_assignments.get(current_token))} actions left`);
    clearTempTokens();

    if (set_assignments.get(current_token) < 1) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(current_token));
        requests.delete(current_token);
        blockCard();
        return;
    }

    token_data = wasm.find_character(token_data.row, token_data.column);
    loadItems();
    loadAbles();
    loadEquip();
}

/******************************************************************************
 * getEquip - Generates request to remove the selected equipment
 *****************************************************************************/
function getEquip() {
    action_type = 3;
    let req = wasm.generate_request(action_type, options.get(this.id).toString(), 
        wasm.get_char(token_data.row, token_data.column), 0, 0);
    if (!requests.has(req.caster)) { requests.set(req.caster, new Array()); }
    
    let new_arr = requests.get(req.caster);
    new_arr.push(req);
    requests.set(req.caster, new_arr);
    set_assignments.set(req.caster, set_assignments.get(req.caster)-2);
    if (set_assignments.get(req.caster) <= 0) {
        socket.emit("addTurn", current_session, current_user, in_game_name, requests.get(req.caster));
        requests.clear();
    }
    
    token_data = wasm.find_character(token_data.row, token_data.column);
    clearTempTokens();
    loadItems();
    loadAbles();
    loadEquip();
}


////////////////////////////////////////////////    IN-SESSION FUNCTIONS    ////////////////////////////////////////////////////

/******************************************************************************
 * startTurn - "Start turn" button's onclick, starts turn for connected users
 *****************************************************************************/
function startTurn() {
    socket.emit("startTurn", current_session, JSON.stringify(wasm.export_game()));
    document.getElementById("roll-button").disabled = false;
    document.getElementById("roll-button-label").innerHTML = "End turn";
    document.getElementById("roll-button").onclick = endTurn;
}

/******************************************************************************
 * endTurn - "End turn" button's onclick, ends turn for connected users
 *****************************************************************************/
function endTurn() {
    socket.emit("endTurn", current_session);
    document.getElementById("roll-button").disabled = false;
    document.getElementById("roll-button-label").innerHTML = "Start next turn";
    document.getElementById("roll-button").onclick = startTurn;
}

/******************************************************************************
 * renderCard - Loads the character sheet of the selected token to card div
 *****************************************************************************/
function renderCard() {
    document.getElementById("card").innerHTML ='<h1 class="card-head" style="font-style:italic">'+token_data.sheet.name+'</h1>'+
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

/******************************************************************************
 * blockCard - Obscures card div when the user doesn't have access to a token
 *****************************************************************************/
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
    document.getElementById("access-button").onclick = emitAccessRequest;
    options.set("access-button", key);
}

/******************************************************************************
 * emitAccessRequest - "Request access" button's onclick, emits access request
 *****************************************************************************/
function emitAccessRequest() {
    socket.emit("requestAccess", current_session, current_user, in_game_name, options.get("access-button"));
}

/******************************************************************************
 * getAccessRequests - Loads in access requests to pending requests list
 *****************************************************************************/
function getAccessRequests() { 
    socket.emit("getAccessRequests", current_session);
}

/******************************************************************************
 * listRequests - "Dungeon Master" button's onclick, lists pending requests
 *****************************************************************************/
function listRequests() {
    document.getElementById("card").innerHTML = '<h1 class="card-head">Requests</h1>';
    for(var i = 0; i < access_req_list.length; i++) {
        document.getElementById("card").innerHTML = document.getElementById("card").innerHTML + 
        '<div style="border-bottom: 2.5px solid rgb(100, 100, 100)" id="access-div' + i +  '">' +
        '<p class="card-alt">' + access_req_list[i].display_name +' is requesting access to '+ access_req_list[i].token +'</p>'+
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

    for(var i = 0; i < ordered_requests.length; i++) {
        let str = '';
        let req = ordered_requests[i];
        switch(req.action_type) {
            case 0: str = `${req.caster} moves to (${req.target_cell[0]}, ${req.target_cell[1]})`; break;
            case 1: str = `${req.caster} uses ${game_backup.characters[req.caster].sheet.items[req.subtype_key].name}`; break
            case 2: str = `${req.caster} uses ${game_backup.abilities[req.subtype_key].name}`; break;
            case 3: str = `${req.caster} unequips item from ${req.subtype_key}`; break;
            default:str = 'Error occured when loading request, likely could not find action type'; break;
        }
        document.getElementById("card").innerHTML = document.getElementById("card").innerHTML + 
        '<div style="border-bottom: 2.5px solid rgb(100, 100, 100)" id="req-div' + i +  '">' +
        '<p class="card-alt">' + str + '</p>' +
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="req-approve' + i + '"> Approve' + '</button>' + 
        '<button style="margin-left:2.5px;margin-bottom:2.5px;" id="req-decline' + i + '"> Decline' + '</button>' + 
        '</div>';
        options.set('req-approve' + i, {
            index: i, 
            request: ordered_requests[i], 
            user: token_to_user.get(ordered_requests[i].caster), 
            msg: str
        });
        options.set('req-decline' + i, i);
    }
    for(var i = 0; i < ordered_requests.length; i++) {
        if (ordered_requests[i].action_type == 2) {document.getElementById("req-approve" + i.toString()).onclick = deferToRoll}
        else { document.getElementById("req-approve" + i.toString()).onclick = approveRequest; }
        document.getElementById("req-decline" + i.toString()).onclick = declineRequest;
    }
}

/******************************************************************************
 * approveRequest - Approves request and sends confirmation to the sender
 *****************************************************************************/
function approveRequest() {
    let data = options.get(this.id);
    ordered_requests.splice(data.index, 1);
    socket.emit("approveRequest", current_session, data.request, data.user, data.msg);
    document.getElementById("req-div" + data.index.toString()).remove();
    listRequests();
}

/******************************************************************************
 * declineRequest - Declines request, updates list of requests
 *****************************************************************************/
function declineRequest() {
    ordered_requests.splice(options.get(this.id), 1);
    document.getElementById("req-div" + options.get(this.id)).remove();
    listRequests();
}

/******************************************************************************
 * grantAccess - Grants access to the character requested by the user
 *****************************************************************************/
function grantAccess() {
    socket.emit("grantAccess", current_session, options.get(this.id));
    document.getElementById("access-div" + options.get(this.id).toString()).remove();
    getAccessRequests()
}

/******************************************************************************
 * removeAccess - Removes access to the characters belonging to the user
 *****************************************************************************/
function removeAccess() {
    socket.emit("removeAccess", current_session, options.get(this.id));
    document.getElementById("access-div" + options.get(this.id).toString()).remove();
    getAccessRequests();
}

/******************************************************************************
 * deferToRoll - Pauses approving/denying requests until the user has rolled
 *****************************************************************************/
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

/******************************************************************************
 * cancelRoll - Resumes approving/denying requests, cancels user's roll
 *****************************************************************************/
function cancelRoll() {
    socket.emit("removeRollRequest", current_session, options.get(this.id));
    let index = options.get(this.id).index;
    options.set(this.id, index);
}

/******************************************************************************
 * roll20 - Randomized D20 roll to cast an ability
 *****************************************************************************/
function roll20() {
    document.getElementById('roll-button').disabled = true;
    document.getElementById('roll-button-label').innerHTML = '';
    document.getElementById('roll-button').onclick = '';
    let roll = Math.floor(Math.random() * 20) + 1;
    let name = options.get(this.id).request.caster;
    socket.emit("roll20", current_session, roll, name, options.get(this.id).index);
    options.delete('roll-button');
    document.getElementById('roll-button').outerHTML = priorButton.oHTML;
    document.getElementById('roll-button').innerHTML = priorButton.iHTML;
    document.getElementById('roll-button').disabled = priorButton.dis;
    document.getElementById('roll-button').onclick = priorButton.click;
}


////////////////////////////////////////////////    WEBSOCKET FUNCTIONS    /////////////////////////////////////////////////////

/******************************************************************************
 * Socket-connect - On connection log socket id
 *****************************************************************************/
socket.on("connect", () => {
    logMessage(`Connected to socket with id: ${socket.id} `);
})

/******************************************************************************
 * Socket-startSession - Load game view for host once the session starts
 *****************************************************************************/
socket.on("startSession", (room) => {
    current_session = room;
    document.getElementById("msg").disabled = false;
    document.getElementById("sub").disabled = false;
    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    for (const key in game_backup.characters) {
        set_assignments.set(`${key}`, 3.0);
    }

    application.stage.removeChild(basicText);
    let dim = wasm.get_dimensions();
    drawClickableGrid(dim[1], dim[0], wasm.board_to_string());
    
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

/******************************************************************************
 * Socket-joinGame - Retrieve DB set key from room, load game view on success
 *****************************************************************************/
socket.on("joinGame", (room, key, assignments, game) => {
    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    if (game == null) {
        const docRef = doc(db, 'game_sets', key);
        getDoc(docRef).then((response) => { 
            if (!response.exists()) { return; }
            if (assignments === null) set_assignments = new Map();
            else { for (let i = 0; i <assignments.length; i++) { set_assignments.set(assignments[i], 3.0); } }

            game_backup = JSON.parse(response.data().data);
            current_session = room;
            wasm.load_game(game_backup);
            loadGameView();
            return;
        });
    }
    else {
        if (assignments === null) { set_assignments = new Map(); }
        else { for (let i = 0; i <assignments.length; i++) { set_assignments.set(assignments[i], 3.0); } }
        wasm.load_game(JSON.parse(game));
        game_backup = wasm.export_game();
        loadGameView();
    }
});

/******************************************************************************
 * Socket-hostRejoin - Loads view of the in progress game as the host
 *****************************************************************************/
socket.on("hostRejoin", (room, key, game) => {
    document.getElementById("session_id").innerHTML = `Session: ${room}`;
    if (game == null) {
        const docRef = doc(db, 'game_sets', key);
        getDoc(docRef).then((response) => { 
            if (!response.exists()) { return; }
            game_backup = JSON.parse(response.data().data);
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
});

/******************************************************************************
 * Socket-loadRequests - Lists pending requests stored in the session
 *****************************************************************************/
socket.on("loadRequests", (requests) => {
    token_to_user = new Map();
    for(var i = 0; i < requests.length; i++) {
        token_to_user.set(requests[i].reqs[0].caster, requests[i].id);
        wasm.insert_request(requests[i].reqs[0].caster, requests[i].reqs);
    }
    wasm.sort_requests();
    ordered_requests = wasm.get_requests();
    listRequests();
});

/******************************************************************************
 * Socket-executeRequest - Execute the current request for this user
 *****************************************************************************/
socket.on("executeRequest", (req) => {
    wasm.execute_request(req);
    clearTempTokens();
    let dim = wasm.get_dimensions();
    drawClickableGrid(dim[1], dim[0], wasm.board_to_string());
    clearTempTokens();

    if (token_data === undefined) return;
    if (!set_assignments.has(req.caster)) return;
    if (set_assignments.get(req.caster) <= 0) return;

    token_data = wasm.get_character(req.caster); // bugged idk
    console.log("AAAHHHHHHHHH");
});

/******************************************************************************
 * Socket-enableRoll - Enable rolling for this user
 *****************************************************************************/
socket.on("enableRoll", (request_data) => {
    priorButton = { 
        oHTML: document.getElementById('roll-button').outerHTML, 
        iHTML: document.getElementById('roll-button').innerHTML,
        dis: document.getElementById('roll-button').disabled, 
        click: document.getElementById('roll-button').onclick 
    };
    document.getElementById('roll-button').disabled = false;
    document.getElementById('roll-button-label').innerHTML = 'Roll to attempt ' + 
        game_backup.abilities[request_data.request.subtype_key].name;
    document.getElementById('roll-button').onclick = roll20;
    options.set('roll-button', request_data);
});

/******************************************************************************
 * Socket-removeRoll - Disable rolling for this user
 *****************************************************************************/
socket.on("removeRoll", () => {
    document.getElementById('roll-button').outerHTML = priorButton.oHTML;
    document.getElementById('roll-button').innerHTML = priorButton.iHTML;
    document.getElementById('roll-button').disabled = priorButton.dis;
    document.getElementById('roll-button').onclick = priorButton.click;
});

/******************************************************************************
 * Socket-confirmSuccess - Approves request through host when user roll passes
 *****************************************************************************/
socket.on("confirmSuccess", (index) => {
    document.getElementById("req-approve" + index.toString()).onclick = approveRequest;
    document.getElementById("req-approve" + index.toString()).disabled = false;
    document.getElementById("req-approve" + index.toString()).click();
});

/******************************************************************************
 * Socket-confirmFailure - Declines request through host when user roll fails
 *****************************************************************************/
socket.on("confirmFailure", (index) => {
    document.getElementById("req-decline" + index.toString()).click();
    document.getElementById("req-decline" + index.toString()).onclick = declineRequest;
    document.getElementById("req-decline" + index.toString()).click();
});

/******************************************************************************
 * Socket-addTokenAccess - Gives the current user access to a token
 *****************************************************************************/
socket.on("addTokenAccess", (token) => {
    if (token === null) 
        { set_assignments = new Map(); blockCard(); return; }
    document.getElementById("role_id").innerHTML = 'Role: ' + game_backup.characters[token].sheet.name;
    set_assignments.set(token, 3.0);
});

/******************************************************************************
 * Socket-loadAccessRequests - Retrieves pending requests from game session
 *****************************************************************************/
socket.on("loadAccessRequests", (list) => {
    access_req_list = list;
    listRequests();
})

/******************************************************************************
 * Socket-grantAllAccess - Gives access to all tokens on the board
 *****************************************************************************/
socket.on("grantAllAccess", () => {
    for (const key in wasm.export_game().characters) {
        set_assignments.set(`${key}`, 3.0);
    }
});

/******************************************************************************
 * Socket-syncBoards - Syncing board the game backup at the start of the turn
 *****************************************************************************/
socket.on("syncBoards", () => {
    wasm.load_game(game_backup);    
    let dim = wasm.get_dimensions();
    drawClickableGrid(dim[1], dim[0], wasm.board_to_string());
});

/******************************************************************************
 * Socket-socketLog - Inserts msg as string message to the log
 *****************************************************************************/
socket.on("socketLog", (msg) => { logMessage(msg) });

/******************************************************************************
 * Socket-backupGame - Exports game and saves it to the game_backup var
 *****************************************************************************/
socket.on("backupGame", () => { game_backup = wasm.export_game() });

/******************************************************************************
 * Socket-transactionFailed - Alert if something failed serverside
 *****************************************************************************/
socket.on("transactionFailed", (str) => { alert(str) });