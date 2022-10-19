/*/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
 *      
 *      Rust implementation of functions that automate aspects of virtual tabletop gameplay for ByteDungeon
 *          - By Sebastian C - July 18, 2022
 * 
 *      Implementation and Assumptions
 *          - Game session data such as characters, tokens, and map layout are all represented as collections of structs
 *          - Calls from the JS wrapper will come in to either update the data representation or request options for a player
 *          - The map layout is represented using a 2D char array, each char identifies a separate token (character or asset)
 *          - Abilities, characters, items, and effects will be stored in a hashmap to simplify and speed up lookup
 *          - Each character must be represented using a unique character except for '1' and '0'
 *          - Diagonal movements are 2 separate movements (ie up + left, down + right)
 *          - Each player's actions are logged and sent to the DM to await approval before execution
 * 
 */////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

mod utils;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

use std::fmt;
use std::cell::RefCell;
use std::collections::HashMap;
use std::collections::HashSet;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

thread_local!(static GLOBAL_SESSION: RefCell<GameSession> = RefCell::new(Default::default()));

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    fn alert(s: &str);
}

////////////////////////////////////////////////    STRUCTS    ////////////////////////////////////////////////////////////////

/***********************************************
 * Character - Essential character sheet info
 **********************************************/
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Character    
{                                               // stats, numerical stats of a character like attributes, initiative
    name: String,                               // traits, (practically) permanent qualities of a character, race, class...
    speed: i32,
    initiative: i8,
    hitpoints: i32,
    max_hp: i32,
    stats: HashMap<String, i16>,                // DND equivalent are attributes. These are stats like strength, intelligence
    traits: HashSet<String>,                    // Permanent qualities of a character (ie: languages, material they're made of)
    items: Vec<Item>,                           // Vector of items instead of another map because each player item changes
    equipment: HashMap<String, Item>,           // Hashmap to limit one item per slot (ie: "head" -> Item:helmet)
    abilities: HashSet<String>,                 // Collection of keys to look up which abilities this character can use
    effects: HashMap<String, Effect>            // Temporary qualities of a character (ie: poisoned, stunned)
}

/***********************************************
 * Item - Consumables and equipment data
 **********************************************/
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Item               
{
    name: String,
    uses: i32,
    weight: u16,
    slots: Vec<String>,                         // Key that represents equipment slot this item takes up, like "head"
    effects: HashSet<String>,                   // Effect this item applies when consumed / used
    abilities: HashSet<String>                  // Abilities this item grants the consumer when used, only for equippables
}

/***********************************************
 * Ability - Special actions (spell/attack/etc)
 **********************************************/
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Ability
{
    name: String,
    range: i16,
    action_points: i8,                          // Action point cost to cast this ability
    casting_roll: [i32; 2],                     // Lower bound, upper bound
    stat_modifier: Option<String>,              // Identifier of the stat being affected
    requirements: Vec<Vec<String>>,             // At least one of these vecs must be completely true to use ability
    target_effects: HashSet<String>,            // Effect to be applied on target upon success
    caster_effects: HashSet<String>             // Effect to be applied on caster upon success
}

/***********************************************
 * Effect - Temporary stat modifier (de)buff
 **********************************************/
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Effect
{
    name: String,                               
    duration: i32,                              
    target_stat: String,                        // Stat being modified by this effect
    modifier: [i32; 2],                         // Lower bound, upper bound of the amount the stat will be modified by
    temporary: bool                             // False: effect is applied every turn (poison), True: effect only while active
}

/***********************************************
 * Token - Stores position and sheet for tokens
 **********************************************/
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Token      
{
    row: usize,
    column: usize,
    initiative: Option<i8>,                     // Used to sort requests by turn order
    sheet: Character                            // Character sheet associated with this token
}

/***********************************************
 * MasterList - Stores game rules and characters
 **********************************************/
#[derive(Serialize, Deserialize, Default, Debug)]
pub struct GameSession
{
    pub characters: HashMap<char, Token>,       // Map of all characters in a game
    pub sheets: HashMap<char, Character>,       // Map of all unassigned character sheets
    pub abilities: HashMap<String, Ability>,    // Map of all abilities in a game
    pub effects: HashMap<String, Effect>,       // Map of all ...
    pub items: HashMap<String, Item>,           
    pub grid: Vec<Vec<char>>,                   // 2D array representing the board
    pub requests: Vec<(char, Vec<Request>)>     // Vector of token to set of requests in order
}

/***********************************************
 * Request - Player's requested action for DM
 **********************************************/
#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct Request
{
    caster: char,                               // Char representation of the casting token
    action_type: i32,                           // Type of action (0 - move, 1 - use item, 2 - use ability, 3 - remove equipped)
    subtype_key: Option<String>,                // How the action is done (ability, equipment)
    target_cell: Option<(usize, usize)>,        // Target coordinates, if null apply on self
    target_tokens: Option<Vec<char>>            // Target tokens of action
}


////////////////////////////////////////////////    BINDINGS    ////////////////////////////////////////////////////////////////

/******************************************************************************
 *  load_game - Loads a previously exported game to the current session
 *                                                                             
 *  PARAMS: DATA contains the serialized (JSON) game data to be loaded in
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn load_game(data: JsValue) {
    GLOBAL_SESSION.with(|session| {
        let my_game: GameSession = data.into_serde().unwrap();
        *session.borrow_mut() = my_game;
    });
}

/******************************************************************************
 *  export_game - Serializes and exports the current game session               
 *                                                                             
 *  RETURNS: Object containing the current game session in JS object notation
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn export_game() -> JsValue
{
    let mut result = None;
    GLOBAL_SESSION.with(|session| {
        result = Some(JsValue::from_serde(&copy_session(&*session.borrow())).unwrap());
    });
    return result.unwrap();
}

/******************************************************************************
 *  reset_session - Resets current game session data to default values
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn reset_session()
{
    GLOBAL_SESSION.with(|session| {
        let my_game: GameSession = Default::default();
        *session.borrow_mut() = my_game;
    });
}

/******************************************************************************
 *  get_char - Returns the char at the input row and column of the game grid
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn get_char(row: i32, col: i32) -> JsValue
{
    let mut result = ' ';
    GLOBAL_SESSION.with(|session| {
        result = session.borrow().grid[row as usize][col as usize];
    });
    return JsValue::from_serde(&result).unwrap();
}

/******************************************************************************
 *  find_character - Returns character sheet of the char at input row/column
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn find_character(row: i32, col: i32) -> JsValue
{
    let mut result = None;
    GLOBAL_SESSION.with(|session| {
        let game = &*session.borrow();
        result = Some(JsValue::from_serde(game.characters.get(&game.grid[row as usize][col as usize]).unwrap()));
    });
    return result.unwrap().unwrap();
}

/******************************************************************************
 *  get_character - Returns character sheet by char in the session's hashmap
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn get_character(key: char) -> JsValue
{
    let mut result = None;
    GLOBAL_SESSION.with(|session| {
        let game = &*session.borrow();
        result = Some(JsValue::from_serde(game.characters.get(&key).unwrap()));
    });
    return result.unwrap().unwrap();
}

/******************************************************************************
 *  get_dimensions - Returns the row/column dimensions of the current game grid
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn get_dimensions() -> JsValue {
    let mut res = [0,0];
    GLOBAL_SESSION.with(|session| {
        if session.borrow().grid.len() > 0 
            { res = [session.borrow().grid.len(), session.borrow().grid[0].len()] }
    });
    return JsValue::from_serde(&res).unwrap();
}

/******************************************************************************
 *  board_to_string - Returns the current game grid in flattened string format
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn board_to_string() -> JsValue
{
    let mut result = Vec::new();
    GLOBAL_SESSION.with(|session| {
        let game = &*session.borrow();
        for n in 0..game.grid.len() {
            for m in 0..game.grid[0].len() {
                result.push(game.grid[n][m]);
            }
        }
    });
    return JsValue::from_serde(&result).unwrap();
}

/******************************************************************************
 *  add_character - Adds character sheet with stats entered through parameters
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn add_character(tk: String, nm: String, sp: i32, iv: i8, hp: i32, mp: i32, st: i16, dx: i16, cn: i16, 
    it: i16, ws: i16, ch: i16, tr: Option<String>)
{
    let mut temp_char = Character{ 
        name: nm.to_string(), speed: sp, initiative: iv, hitpoints: hp, max_hp: mp, stats:HashMap::new(), traits:HashSet::new(),
        items: vec![], equipment: HashMap::new(), abilities: HashSet::new(), effects: HashMap::new()
    };
    if tr.is_some() { temp_char.traits.insert(tr.unwrap()); }

    temp_char.stats.insert("Strength".to_string(), st);
    temp_char.stats.insert("Dexterity".to_string(), dx);
    temp_char.stats.insert("Constitution".to_string(), cn);
    temp_char.stats.insert("Intelligence".to_string(), it);
    temp_char.stats.insert("Wisdom".to_string(), ws);
    temp_char.stats.insert("Charisma".to_string(), ch);

    let str_to_chars: Vec<char> = tk.chars().collect();
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().sheets.insert(str_to_chars[0], temp_char);
    });
}

/******************************************************************************
 *  add_item - Adds item to the current game using params as the item data
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn add_item(name: String, uses: i32, wgt: u16, slot: Option<String>, effx: Option<String>, abil: Option<String>)
{
    let mut temp_item = Item 
        { name: name.to_string(), uses: uses, weight: wgt, slots: Vec::new(), effects: HashSet::new(), abilities: HashSet::new()};
    
    if slot.is_some() { temp_item.slots.push(slot.unwrap()); }
    if effx.is_some() { temp_item.effects.insert(effx.unwrap()); }
    if abil.is_some() { temp_item.abilities.insert(abil.unwrap()); } 
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().items.insert(name.to_string(), temp_item);
    });
}

/******************************************************************************
 *  add_ability - Adds ability to the current game using params as ability data
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn add_ability(nm: String, ran: i16, ap: i8, low: i32, high: i32, stat: Option<String>, 
    req: Option<String>, tar: Option<String>, cas: Option<String>)
{
    let mut temp_abi = Ability { name: nm.to_string(), range: ran, action_points: ap, casting_roll: [low, high], 
        stat_modifier: None, requirements: Vec::new(), target_effects: HashSet::new(), caster_effects: HashSet::new() };
    if req.is_some() { temp_abi.requirements.push(vec![req.unwrap()]); }
    if tar.is_some() { temp_abi.target_effects.insert(tar.unwrap()); }
    if cas.is_some() { temp_abi.caster_effects.insert(cas.unwrap()); } 
    if stat.is_some() { temp_abi.stat_modifier = stat; } 
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().abilities.insert(nm.to_string(), temp_abi);
    });
}

/******************************************************************************
 *  add_effect - Adds effect to the current game using params as effect data
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn add_effect(nm: String, dur: i32, target: String, low: i32, high: i32, temp: bool ) {
    let temp_eff = Effect { name: nm.clone(), duration: dur, target_stat: target, modifier: [low, high], temporary: temp};
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().effects.insert(nm.clone(), temp_eff);
    });
}

/******************************************************************************
 *  generate_request - Returns a serialized request using params as its data                    
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn generate_request(a_type: i32, key: &str, tok: char, end_row: i32, end_col: i32) -> JsValue
{
    let mut result = JsValue::default();
    GLOBAL_SESSION.with(|session| {
        result = JsValue::from_serde(&session.borrow_mut().make_request(a_type, key, tok, end_row, end_col)).unwrap();
    });
    return result;
}

/******************************************************************************
 *  get_requests - Returns a serialized vector of requests logged in the game
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn get_requests() -> JsValue {
    let mut result: Vec<Request> = Vec::new();
    GLOBAL_SESSION.with(|session| {
        let game = &*session.borrow();
        for n in 0..game.requests.len() {
            for m in 0..game.requests[n].1.len() {
                result.push(game.requests[n].1[m].clone());
            }
        }
    });
    return JsValue::from_serde(&result).unwrap();
}

/******************************************************************************
 *  insert_request - Logs request and the token of the character casting it
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn insert_request(token: char, request: JsValue) {
    GLOBAL_SESSION.with(|session| {
        let reqs: Vec<Request> = request.into_serde().unwrap();
        session.borrow_mut().requests.push((token, reqs));
    });
}

/******************************************************************************
 *  sort_requests - Sorts logged requests by the initiative of the req's caster
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn sort_requests() {
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().sort_requests();
    });
}

/******************************************************************************
 *  execute_request - Executes the request entered as the parameter
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn execute_request(request: JsValue) {
    GLOBAL_SESSION.with(|session| {
        let req: Request = request.into_serde().unwrap();
        session.borrow_mut().execute_request(req.caster, &req);
    });
}

/******************************************************************************
 *  resize_board - Changes the row/column dimensions of the current game grid
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn resize_board(rows: i32, cols: i32) 
{
    GLOBAL_SESSION.with(|session| { 
        let mut my_game = copy_session(&*session.borrow());
        if rows == 0 ||  cols == 0 {
            my_game.grid = vec![Vec::new()];
            *session.borrow_mut() = my_game;
            return;
        }

        if rows as usize > my_game.grid.len() {
            while my_game.grid.len() < rows as usize {
                my_game.grid.push(vec!['0']);
            }
        }
        else {
            while my_game.grid.len() > rows as usize {
                my_game.grid.pop();
            }
        }

        for i in 0..my_game.grid.len() {
            while my_game.grid[i].len() < cols as usize{
                my_game.grid[i].push('0');
            }
            while my_game.grid[i].len() > cols as usize{
                my_game.grid[i].pop();
            }
        }
        *session.borrow_mut() = my_game;
        return;
    });
}

/******************************************************************************
 *  toggle_cell - Alternates the content of the cell at the input row/column
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn toggle_cell(row: i32, col: i32) -> JsValue
{
    let mut result: Option<char> = None;
    GLOBAL_SESSION.with(|session| {
        let mut my_game: GameSession = copy_session(&*session.borrow());
        if my_game.grid[row as usize][col as usize] == '0' { 
            my_game.grid[row as usize][col as usize] = '1';
            result = Some('1');
        }
        else { 
            if my_game.grid[row as usize][col as usize] != '1' {
                let token = my_game.characters.remove(&my_game.grid[row as usize][col as usize]).unwrap();
                my_game.sheets.insert(my_game.grid[row as usize][col as usize], token.sheet);
            }
            my_game.grid[row as usize][col as usize] = '0';
            result = Some('0');
        }
        *session.borrow_mut() = my_game;
    });
    return JsValue::from_serde(&result).unwrap();
}

/******************************************************************************
 *  place_token - Places a char representation of a token at the input row/col
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn place_token(token: String, row: i32, col: i32)
{
    let str_to_chars: Vec<char> = token.chars().collect();
    GLOBAL_SESSION.with(|session| {
        let sheet = session.borrow_mut().sheets.remove(&str_to_chars[0]).unwrap();
        let token = Token { row: row as usize, column: col as usize, initiative: Some(sheet.initiative), sheet: sheet.clone() };
        session.borrow_mut().grid[row as usize][col as usize] = str_to_chars[0];
        session.borrow_mut().characters.insert(str_to_chars[0], token);
    });
}

/******************************************************************************
 *  collect_cell_options - Returns a vector of available neighboring cells
 * 
 *  PARAMS: ROW and COLUMN are the source, TARGET = true adds cells with tokens
 *  RETURN: Serialized vector of int tuples representing the row/col of free cel
 * 
 ******************************************************************************/
#[wasm_bindgen]
pub fn collect_cell_options(row: i32, column: i32, range: i32, target: bool) -> JsValue
{
    let mut result = None;
    GLOBAL_SESSION.with(|session| {
        let game = &*session.borrow();
        result =Some(JsValue::from_serde(&get_action_range(&game.grid, row as usize, column as usize, range, target)).unwrap());
    });
    return result.unwrap();
}

/******************************************************************************
 *  get_cell_distance - Gets cell distance between the input coordinates
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn get_cell_distance(src_row: i32, src_col: i32, end_row: i32, end_col: i32) -> i32
{
    let result = (end_row - src_row).abs();
    return result + (end_col - src_col).abs();
}

/******************************************************************************
 *  give_item - Adds an item to a token's character sheet
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn give_item(token: String, item_key: String) {
    let str_to_chars: Vec<char> = token.chars().collect();
    GLOBAL_SESSION.with(|session| {
        let new_item = session.borrow().items.get(&item_key).unwrap().clone();
        session.borrow_mut().sheets.get_mut(&str_to_chars[0]).unwrap().items.push(new_item);
    });
}

/******************************************************************************
 *  give_ability - Adds an ability to a token's character sheet
 *---------------------------------------------------------------------------*/
#[wasm_bindgen]
pub fn give_ability(token: String, abil_key: String) {
    let str_to_chars: Vec<char> = token.chars().collect();
    GLOBAL_SESSION.with(|session| {
        session.borrow_mut().sheets.get_mut(&str_to_chars[0]).unwrap().abilities.insert(abil_key);
    });
}


////////////////////////////////////////////////    STRUCT IMPL's    //////////////////////////////////////////////////////////

impl GameSession
{
    /******************************************************************************
     *  move_token - Removes token from grid and places it in its new cell
     *---------------------------------------------------------------------------*/
    pub fn move_token(&mut self, token: char, new_row: usize, new_col: usize)
    {
        if self.grid[new_row][new_col] != '0' { return;}
        let mut temp_token = self.characters.get_mut(&token).unwrap();
        self.grid[new_row][new_col] = token;
        self.grid[temp_token.row][temp_token.column] = '0';
        temp_token.row = new_row;
        temp_token.column = new_col;
    }

    /******************************************************************************
     *  use_item - Uses item specified by index, adds to equipment if equippable
     *---------------------------------------------------------------------------*/
    pub fn use_item(&mut self, token: char, item_index: usize)
    {
        let temp_token = self.characters.get_mut(&token).unwrap();
        for slot in &temp_token.sheet.items[item_index].slots
            { temp_token.sheet.equipment.insert(slot.to_string(), temp_token.sheet.items[item_index].clone()); } 
        for ability in &temp_token.sheet.items[item_index].abilities 
            { temp_token.sheet.abilities.insert(ability.to_string()); }
        for effect in temp_token.sheet.items[item_index].effects.clone() {
            temp_token.sheet.effects.insert(effect.to_string(), self.effects.get(&effect).unwrap().clone());
            apply_effect(&mut temp_token.sheet, &effect);
        }
        temp_token.sheet.items[item_index].uses -= 1;
        if temp_token.sheet.items[item_index].uses <= 0 
            { temp_token.sheet.items.remove(item_index); }
    }

    /******************************************************************************
     *  use_ability - Uses ability on target cells, if none it applies on self
     *---------------------------------------------------------------------------*/
    pub fn use_ability(&mut self, token: char, ability: &str, targets: Option<Vec<char>>)
    {
        let temp_token = self.characters.get_mut(&token).unwrap();
        let ability = self.abilities.get(ability).unwrap();
        for effect in &ability.caster_effects {
            temp_token.sheet.effects.insert(effect.to_string(), self.effects.get(effect).unwrap().clone());
            apply_effect(&mut temp_token.sheet, &effect);
        }
        let target_key_list = targets;
        if target_key_list.is_some() {
            let target_key_list = target_key_list.unwrap();
            for n in 0..target_key_list.len() {
                let target_tok = self.characters.get_mut(&target_key_list[n]).unwrap();
                for effect in &ability.target_effects {
                    target_tok.sheet.effects.insert(effect.to_string(), self.effects.get(effect).unwrap().clone());
                    apply_effect(&mut target_tok.sheet, &effect);
                }
            }
        }
    }

    /******************************************************************************
     *  remove_equipment - Removes equipment from the indicated slot
     *---------------------------------------------------------------------------*/
    pub fn remove_equipment(&mut self, token: char, slot: &str)
    {
        let temp_token = self.characters.get_mut(&token).unwrap();
        let equipment = temp_token.sheet.equipment.remove(slot).unwrap();
        
        for slot in &equipment.slots 
            { temp_token.sheet.equipment.remove(slot); }
        for ability in &equipment.abilities
            { temp_token.sheet.abilities.remove(ability); }
        for effect in &equipment.effects {
            let mut reverse = self.effects.get(effect).unwrap().clone();
            reverse.modifier[0] = reverse.modifier[0] * -1;
            temp_token.sheet.effects.insert("removing_temp_item".to_string(), reverse);
            apply_effect(&mut temp_token.sheet, "removing_temp_item"); 
        }
        temp_token.sheet.items.push(equipment.clone());
    }

    /******************************************************************************
     *  make_request - Makes a request using the data entered as parameters
     *---------------------------------------------------------------------------*/
    pub fn make_request(&mut self, a_type: i32, key: &str, tok: char, end_row: i32, end_col: i32) -> Request
    {
        let mut result: Request = Default::default();
        result.caster = tok;
        result.action_type = a_type;
        if !key.is_empty() { result.subtype_key = Some(key.to_string()); }
        
        match a_type {
            0 => { result.target_cell = Some((end_row as usize, end_col as usize)); },
            1 => {
                result.action_type = 2;
                if self.abilities.get(key).unwrap().range > 0 {
                    if self.characters.contains_key(&self.grid[end_row as usize][end_col as usize])
                        { result.target_tokens = Some(vec![self.grid[end_row as usize][end_col as usize]]) }
                }
            }
            2 => { result.action_type = 1; },
            _ => { return result; }
        }
        self.execute_request(tok, &result);
        return result;
    }

    /******************************************************************************
     *  sort_requests - nlogn sort of requests, sorts by initiative of the caster
     *---------------------------------------------------------------------------*/
    pub fn sort_requests(&mut self) 
    {
        let mut req_w_initiat = Vec::new();
        while !self.requests.is_empty() {
            let temp_req = self.requests.pop().unwrap();
            if self.characters.get(&temp_req.0).unwrap().initiative.is_some() {
                req_w_initiat.push((self.characters.get(&temp_req.0).unwrap().initiative.unwrap(), temp_req));
                continue;
            }
            req_w_initiat.push((i8::MIN, temp_req))
        }
        req_w_initiat.sort_by(|a, b| a.0.cmp(&b.0));
        self.requests = Vec::new();
        while !req_w_initiat.is_empty() {
            self.requests.push(req_w_initiat.pop().unwrap().1);
        }
    }
    
    /******************************************************************************
     *  execute_request - Executes the input request on the current game
     *---------------------------------------------------------------------------*/
    pub fn execute_request(&mut self, token: char, req: &Request)
    {
        if self.characters.get(&token).is_none() { return };
        match req.action_type {
            0 => { self.move_token(token, req.target_cell.unwrap().0, req.target_cell.unwrap().1); },
            1 => { self.use_item(token, req.subtype_key.clone().unwrap().parse::<i32>().unwrap() as usize); },
            2 => { self.use_ability(token, &req.subtype_key.clone().unwrap(), req.target_tokens.clone()); },
            3 => { self.remove_equipment(token, &req.subtype_key.clone().unwrap()); },
            _ => {}
        }
    }
    
    /******************************************************************************
     *  place_tokens - Syncs board by going through token list, places them on grid
     *---------------------------------------------------------------------------*/
    pub fn place_tokens(&mut self)
    {
        for entry in &self.characters { 
            self.grid[entry.1.row][entry.1.column] = *entry.0; 
        }
    }

    /******************************************************************************
     *  board_from_str - Generates grid based on the input (flattened char array)
     *---------------------------------------------------------------------------*/
    pub fn board_from_str(&mut self, input: String, width: i32)
    {
        let mut grid = Vec::new();
        let mut row: Vec<char> = Vec::new();
        let mut column = 0;

        for c in input.chars() {
            if column == width {
                grid.push(row);
                row = Vec::new();
                column = 0;
            }
            row.push(c);
            column += 1;
        }
        self.grid = grid;
    }
}

/******************************************************************************
 *  GameSession::Display - Prints char representation of board to STD output                  
 *---------------------------------------------------------------------------*/
impl fmt::Display for GameSession 
{
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        for n in self.grid.as_slice() {
            for c in n.iter() {
                write!(f, "{}", c);
            }
            write!(f, "\n");
        }
        Ok(())
    }
}

/******************************************************************************
 *  copy_session - Deep copy of a game session struct
 *---------------------------------------------------------------------------*/
fn copy_session(arg: &GameSession) -> GameSession
{
    let mut result = GameSession {
        sheets: arg.sheets.clone(),
        characters: arg.characters.clone(),
        abilities: HashMap::new(),
        requests: Vec::new(),
        effects: arg.effects.clone(),
        items: arg.items.clone(),
        grid: arg.grid.clone(),
    };
    for (key, value) in &arg.abilities {
        result.abilities.insert(key.clone(), value.clone());
    }
    return result;
}

/******************************************************************************
 *  get_action_range - Recursive pathfinding, generates where a token can move
 *---------------------------------------------------------------------------*/
fn get_action_range(grid: &Vec<Vec<char>>, src_row: usize, src_col: usize, range: i32, target: bool) -> HashSet<(i32, i32)> 
{                   
    let mut result = HashSet::new();
    if range <= 0 { return result; }
    for n in 0..4 {
        let mut path = 0 as usize;
        let mut new_row = src_row;
        let mut new_col = src_col;

        while path < range as usize {
            match n {
                0 => { if (new_row as i32 - 1) < 0 { break } new_row -= 1; },   // up
                1 => { if new_row + 1 >= grid.len() { break } new_row += 1; }, // down
                2 => { if (new_col as i32 - 1) < 0 { break } new_col -= 1; },   // left
                3 => { if new_col + 1 >= grid[0].len() { break } new_col += 1; }, // right
                _ => { break }
            }
            if target { if grid[new_row][new_col] == '1' { break } }
            else      { if grid[new_row][new_col] != '0' { break } }
            
            path += 1;
            result.insert( (new_row as i32, new_col as i32) );
            
            if !target { 
                result.extend(&get_action_range(grid, new_row, new_col, (range as usize - path) as i32, target)); 
                result.remove(&(src_row as i32, src_col as i32));
            }
        }
    }
    if target { result.extend(&get_line_of_sight(grid, src_row, src_col, range)) }
    return result;
}

/******************************************************************************
 *  get_line_of_sight - Iterative approach, only gathers spaces in LOS
 *---------------------------------------------------------------------------*/
fn get_line_of_sight(grid: &Vec<Vec<char>>, src_row: usize, src_col: usize, range: i32) -> HashSet<(i32, i32)> 
{
    let mut result = HashSet::new();
    for n in 0..4 {
        let mut path = 0 as usize;
        let mut new_row = src_row;
        let mut new_col = src_col;

        while path < range as usize {
            match n {
                0=>{if (new_row as i32 - 1 ) < 0 || new_col + 1 >= grid[0].len() { break }
                    if grid[new_row - 1][new_col] == '1' && grid[new_row][new_col + 1] == '1' { break }
                    new_row -= 1;
                    new_col += 1;
                },
                1=>{if (new_row as i32 - 1) < 0 || (new_col as i32 - 1) < 0 { break }
                    if grid[new_row - 1][new_col] == '1' && grid[new_row][new_col - 1] == '1' { break }
                    new_row -= 1;
                    new_col -= 1;
                },
                2=>{if new_row + 1 >= grid.len() || new_col + 1 >= grid[0].len() { break }
                    if grid[new_row + 1][new_col] == '1' && grid[new_row][new_col + 1] == '1' { break }
                    new_row += 1;
                    new_col += 1;
                },
                3=>{if new_row + 1 >= grid.len() || (new_col as i32 - 1) < 0 { break }
                    if grid[new_row + 1][new_col] == '1' && grid[new_row][new_col - 1] == '1' { break }
                    new_row += 1;
                    new_col -= 1;
                },
                _ => { break }
            }
            if grid[new_row][new_col] == '1' { break } 
            path += 2;
            result.insert( (new_row as i32, new_col as i32) );
        }
    }
    return result;
}

/******************************************************************************
 *  apply_effect - Apply effect on the stat of a character 
 *---------------------------------------------------------------------------*/
fn apply_effect(target: &mut Character, key: &str)
{
    // make to lowercase before checking in hash, or match
    let mut effect = target.effects.get_mut(key).unwrap();
    let lower_key: &str = &effect.target_stat.to_lowercase();
    match lower_key {
        "health" => target.hitpoints += effect.modifier[0],
        "speed" => target.speed += effect.modifier[0],
        "initiative" => target.initiative += effect.modifier[0] as i8,
        _ => { target.stats.insert(lower_key.to_string(), target.stats.get(lower_key).unwrap() + effect.modifier[0] as i16); }
    }
    effect.duration -= 1;
    if effect.duration == 0 { target.effects.remove(key); };
}