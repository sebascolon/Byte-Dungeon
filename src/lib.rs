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
use std::fmt;
use std::collections::HashMap;
use std::collections::HashSet;
use std::{ io::{ self, Write }, process };

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, byte-dungeon!");
}

#[wasm_bindgen]
pub fn get_template() -> String{
    String::from("100100010000000010000010000000000100010111111010000010000000000000010000001010000000000000111111011111101010000011100111000000010000001010000010000000000000010111111011101110011110000000010000001010101000010000110111111110111010101000010000000100000000100010101101111111000100000000100110101000000000000100000000100100101111111110000100000000100001101000000000000000000000100111001000111110000100000000100100011000100000000100000000100001110000100000")
}

////////////////////////////////////////////////    STRUCTS    ////////////////////////////////////////////////////////////////

/***********************************************
 * Character - Essential character sheet info
 **********************************************/
pub struct Character    
{                                               
    name: String,                               
    playable: bool,                             // Playable = false for NPC's so that options aren't calculated for non-players
    class: String,
    stats: [i32; 6],                            // DND equivalent are attributes. These are stats like strength, intelligence
    experience: u32,
    armor_rating: i32,
    initiative: i32,
    movement_speed: i32,                        // Uses DND standard of feet, so 5ft = one unit/tile on the map
    hitpoints: i32,
    max_hitpoints: i32,
    equipment: HashMap<String, Item>,           // Hashmap to limit one item per slot (ie: "head" -> Item:helmet)
    traits: HashSet<String>,                    // Permanent qualities of a character (ie: languages, material they're made of)
    abilities: HashSet<String>,                 // Collection of keys to look up which abilities this character can use
    items: Vec<Item>,                           // Vector of items instead of another map because each player item changes
    effects: HashMap<String, Effect>            // Temporary qualities of a character (ie: poisoned, stunned)
}

/***********************************************
 * Item - Consumables and equipment data
 **********************************************/
#[derive(Clone)]
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
pub struct Ability
{
    name: String,
    range: u16,
    modifier: [i32; 3],                         // Lower bound, upper bound, stat being modified
    roll: [i32; 2],                             // Roll (20), index of stat modifier (ie 0 = strength; get caster strength mod)
    requirements: Vec<Vec<String>>,             // At least one of these vecs must be completely true to use ability
    effects: HashSet<String>                    // Effect to be applied on target upon success
}

/***********************************************
 * Effect - Temporary stat modifier (de)buff
 **********************************************/
#[derive(Clone)]
pub struct Effect
{
    name: String,                               
    duration: i32,
    modifier: [i32; 3],                         // Lower bound, upper bound, stat being modified
    one_shot: bool                              // False = effect is reapplied every turn (poison), True = effect applied once
}

/***********************************************
 * Token - Stores position and sheet for tokens
 **********************************************/
#[derive(Clone)]
pub struct Token      
{
    row: i32,
    column: i32,
    sheet: Character                            // Character sheet associated with this token
}

/***********************************************
 * Board - Stores map layout and tokens in use
 **********************************************/
pub struct Board
{
    name: String,
    width: i32,
    height: i32,
    grid: Vec<Vec<char>>,                       // Each char has ONE character associated with it
    unresolved_tokens: Vec<char>,               // Tokens on layout that don't have an associated character (ie a placeholder)
    session_tokens: Vec<Token>,                 // Tokens on this board, for turn order purposes
}

/***********************************************
 * MasterList - Stores game rules and characters
 **********************************************/
pub struct MasterList
{
    pub characters: HashMap<char, Character>,   // Map of all characters in a game
    pub abilities: HashMap<String, Ability>,    // Map of all abilites in a game
    pub effects: HashMap<String, Effect>        // Map of all effects in a game
}

/***********************************************
 * Request - Player's requested action for DM
 **********************************************/
#[derive(Default)]
pub struct Request
{
    action_type: i32,                           // What action is done (0 - move, 1 - use item, 2 - use ability)
    subtype_int: Option<i32>,                   // How the action is done (item, direction)
    subtype_key: Option<String>,                // How the action is done (ability, equipment)
    magnitude: Option<i32>,                     // How much an action is done (ie how far to move)
    target_cell: Option<(i32, i32)>             // Target coordinates, if null apply on self
}


////////////////////////////////////////////////    STRUCT IMPL's    //////////////////////////////////////////////////////////

// Clones (creates deep copy) of a character
impl Clone for Character
{
    fn clone(&self) -> Character
    {
        return Character {
            name: self.name.clone(),
            playable: self.playable,
            class: self.class.clone(),
            stats: self.stats,
            experience: self.experience,
            armor_rating: self.armor_rating,
            initiative: self.initiative,
            movement_speed: self.movement_speed,
            hitpoints: self.hitpoints,
            max_hitpoints: self.max_hitpoints,
            equipment: self.equipment.clone(),
            traits: self.traits.clone(),
            abilities: self.abilities.clone(),
            items: self.items.clone(),
            effects: self.effects.clone()
        };
    }
}

// Prints char representation of board to STD output
impl fmt::Display for Board
{
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result
    {
        write!(f, "{}\n", self.name);
        for n in self.grid.as_slice() {
            for c in n.iter() {
                write!(f, "{}", c);
            }
            write!(f, "\n");
        }
        Ok(())
    }
}

////////////////////////////////////////////////    PLAYER CALCULATION FN'S    ////////////////////////////////////////////////

/******************************************************************************
 *  give_turns - Goes through turn order and calls get_request for each player
 * 
 *  PARAMS: SET passes masterlist to get_requests, BOARD contains turn order
 *  RETURN: a vector that has the requests for each player
 * 
 ******************************************************************************/
fn give_turns(set: &MasterList, board: &Board) -> Vec<Vec<Request>>
{
    let mut requests = Vec::new();
    assert_eq!(board.unresolved_tokens.len() as i32, 0);

    for token in &board.session_tokens 
        { requests.push(get_requests(set, &mut board.grid.clone(), &token)) };
    return requests;
}

/******************************************************************************
 *  get_requests - Calculates options, displays them to the players
 * 
 *  PARAMS: SET to lookup abilities/effects, GRID for calculating movements
 *      and TOKEN is the token of the player currently being given options
 *  RETURN: List of the player's action requests
 * 
 ******************************************************************************/
fn get_requests(set: &MasterList, grid: &mut Vec<Vec<char>>, token: &Token) -> Vec<Request>
{
    if ! token.sheet.playable { return Vec::new() };    // This is an NPC, don't give options and defer to DM
    
    let mut actions = 3.0;                              // actions: Action points, how many actions a player can do in a turn
    let mut requests = Vec::new();
    let mut temp_token = token.clone();                     // A clone of the original token is used to allow for calculating
    //                                                      //    multiple requests without affecting the live board
    grid[token.row as usize][token.column as usize] = '0';  //    Emptying the cell where this token starts allows backtracking
    let options = ["(1) Movement ", "(2) Equipment ", "(3) Abilities ", "(4) Items"];

    while actions >= 1.0 {
        let mut given_options = ["", "", "", ""];                                   // Options to be printed to console
        let movement_options = get_movement_option(&grid, &temp_token, actions);

        if movement_options.is_some() { given_options[0] = options[0] };
        if (temp_token.sheet.equipment.len() as i32) > 0 { given_options[1] = options[1] };
        if (temp_token.sheet.abilities.len() as i32) > 0 { given_options[2] = options[2] };
        if ( temp_token.sheet.items.len() as i32 )   > 0 { given_options[3] = options[3] };     

        if given_options.len() as i32 > 0 { 
            print!("{} ({}, {}) ({} actions left) can check ", token.sheet.name, 
                temp_token.row, temp_token.column, actions as i32);
            for n in given_options { print!("{}", n) };
        };
        println!("\n{name} can (5) Pass turn, (6) Try something else", name = token.sheet.name);
        
        let input = get_input()-1;      // Get user's choice, subtract by 1 to get index; this allows for 0 to mean to cancel
        if input > 6 { continue };
        if given_options[input as usize].is_empty() { continue };

        let mut request: (f32, Option<Request>) = (0.0, None);  // Generate request based on user input
        match input {
            0 => { request = gen_move_request(input, movement_options.unwrap(), &mut temp_token) },
            1 | 3 => { request = gen_item_request(input, &mut temp_token) },
            2 => { request = gen_ability_request(set, input, &mut temp_token, [grid.len() as i32, grid[0].len() as i32] ) },
            _ => {  }
        }
        if request.1.is_some() { requests.push(request.1.unwrap()); actions -= request.0 };   // Push request, decrement APs
    }
    return requests;
}

/******************************************************************************
 *  gen_move_request - Shows move options, generates a request to move a token
 * 
 *  PARAMS: ACTION determines request action type, MOVEMENTS are the possible
 *      movement options for this token, and token is the TOKEN that will move
 *  RETURN: Action point cost, and None/Some Request if successful
 * 
 ******************************************************************************/
fn gen_move_request(action: i32, movements: [i32; 4], token: &mut Token) -> (f32, Option<Request>)
{
    let mut result = (0.0, None);
    let mut request = Request { action_type: action, ..Default::default() };
    
    if movements[0] > 0 { println!("(1) Move up (max: {} times)", movements[0]); };
    if movements[1] > 0 { println!("(2) Move down (max: {} times)", movements[1]); };
    if movements[2] > 0 { println!("(3) Move left (max: {} times)", movements[2]); };
    if movements[3] > 0 { println!("(4) Move right (max: {} times)", movements[3]); };

    let direction = get_input()-1;
    if direction < 0 || direction > 3 { return result };
    request.subtype_int = Some(direction);

    println!("How many times? Move up to {} times", movements[direction as usize]);
    let magnitude = get_input();
    if magnitude < 0 || magnitude > movements[request.subtype_int.unwrap() as usize] { return result };
    request.magnitude = Some(magnitude);

    match request.subtype_int.unwrap() {    // Here the temporary token is moved so future movement options from the next
        0 => { token.row -= magnitude},     //    position can be calculated and requested
        1 => { token.row += magnitude},
        2 => { token.column -= magnitude},
        3 => { token.column += magnitude},
        _ => {},
    }
    result.0 = 3.0 *(magnitude as f32/(token.sheet.movement_speed/5) as f32); 
    result.1 = Some(request);
    return result;
}

/****************************************************************************** !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *  gen_ability_request - Shows abilities that can be used, generates request   !! NOTE: CURRENTLY BUGGED and in NEED of TLC !!
 *                                                                              !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *  PARAMS: ACTION determines request action type, DIMENSIONS are the dimension 
 *      of the grid (filters target cells), and TOKEN is the casting token, SET
 *      is used to look up the ability requirements
 *  RETURN: Action point cost, and None/Some Request if successful
 * 
 ******************************************************************************/ 
fn gen_ability_request(set: &MasterList, action: i32, token: &mut Token, dimensions: [i32; 2])-> (f32, Option<Request>)
{
    let mut result = (0.0, None);
    let mut request = Request { action_type: action, ..Default::default() };
    
    let mut key_vec = vec![];                                                            // key_vec tracks token's ability keys
    let index = 0;
    println!("Which ability should be used?");
    for key in &token.sheet.abilities {
        key_vec.push(key);
        println!("({}) {}", index+1, set.abilities.get(key).unwrap().name);
    }

    let index = get_input()-1;
    if index < 0 || index >= key_vec.len() as i32 {return result};
    let mut options = get_ability_option(token, set.abilities.get(key_vec[index as usize]).unwrap().range/5);

    let mut n = 0;                                                                        
    while n < options.len() as i32 {                                                      
        if options[n as usize].0 < 0 || (options[n as usize].0 >= dimensions[0] as i32)   // The following loop filters out
            { options.remove(n as usize); continue;}                                      // invalid target cells
        if options[n as usize].1 < 0 || (options[n as usize].1 >= dimensions[1] as i32)
            { options.remove(n as usize); continue;}
        n+=1;
    }

    if options.len() > 0 {                                                                // Something's up around here
        println!("Use ability on which cell?");                                           // Cell chosen by player is off 1
        for n in 0..options.len() { println!("({}) {:?}", n, options[n]); }
        let target = get_input();
        if target < 0 || target >= options.len() as i32 {return result};
        request.target_cell = Some(options[target as usize]);
    }
    result.0 = 2.0;
    request.subtype_key = Some(key_vec[index as usize].to_string());
    result.1 = Some(request);
    return result;
}

/******************************************************************************     !! could be shortened
 *  gen_item_request - Generates request to use/equip item, or remove equipment
 * 
 *  PARAMS: ACTION is request action type and TOKEN is the token using an item
 *  RETURN: Action point cost, and None/Some Request if successful
 * 
 ******************************************************************************/    
fn gen_item_request(action: i32, token: &mut Token) -> (f32, Option<Request>)
{
    let mut result = (0.0, None);
    let mut request = Request { action_type: action, ..Default::default() };
    match action {
        1 => {                                                              // 1 to remove equipment
            println!("Which item should be removed?");
            let index = 0;
            let mut key_vec = vec![];

            for key in token.sheet.equipment.clone() {
                key_vec.push(key.0);
                println!("({}) {}", index+1, key.1.name)
            }
            let index = get_input()-1;
            if index < 0 || index >= key_vec.len() as i32 {return result};
            remove_item(token, key_vec[index as usize].to_string());
            
            result.0 = 2.0;
            request.subtype_key = Some(key_vec[index as usize].to_string());
            result.1 = Some(request)
        },
        3 => {                                                              // 2 to equip/consume item
            println!("Which item should be used?");
            for n in 0..token.sheet.items.len() 
                { println!("({}) {}", n+1, token.sheet.items[n as usize].name); }
            let item_index = get_input()-1;

            apply_item(token, item_index as usize);
            result.0 = 2.0;
            request.subtype_int = Some(item_index);
            result.1 = Some(request);
        },
        _ => { return result }
    }
    return result;
}

/******************************************************************************
 *  approve_and_execute - Sends requests for approval, executes when approved
 *  
 *  PARAMS: SET for ability lookup, BOARD for moving tokens, and REQUESTS list
 *---------------------------------------------------------------------------*/    
fn approve_and_execute(set: &mut MasterList, board: &mut Board, requests: &Vec<Vec<Request>>)
{
    for token_index in 0..board.session_tokens.len() {                                  // Loop through turn order
        for request in &requests[token_index] {                                         // find cooresponding list of requests
            if request_to_string(set, &board.session_tokens[token_index], &request) {   // log request, get approvel
                let key = request.subtype_key.clone();                                  // clone option before cloning content
                match request.action_type {                                              
                    0 => { move_token(&mut board.grid, request.subtype_int.unwrap(), 
                               request.magnitude.unwrap(), &mut board.session_tokens[token_index]); },
                    1 => { remove_item(&mut board.session_tokens[token_index], key.unwrap().clone())},
                    2 => { use_ability(set, &mut board.grid, request.target_cell.unwrap(), &key.unwrap().clone()) },
                    3 => { apply_item(&mut board.session_tokens[token_index], request.subtype_int.unwrap() as usize) },
                    _ => {  }
                }
            }
        }
    }
}

/******************************************************************************
 *  get_ability_option - Calculate possible target cells based on ability range
 * 
 *  PARAMS: TOKEN is the casting character position, and RANGE is ability range
 *  RETURN: vector of row:column coordinates representing all possible targets
 * 
 ******************************************************************************/
fn get_ability_option(token: &Token, range: u16) -> Vec<(i32, i32)>
{
    let mut result = Vec::new();
    for n in 0..range as i32                                        // Straight movements
    {
        result.push((token.row - (n + 1), token.column)); 
        result.push((token.row + (n + 1), token.column)); 
        result.push((token.row, token.column - (n + 1))); 
        result.push((token.row, token.column + (n + 1)));
    }
    for n in 1..range as i32                                        // Diagonal movements
    {
        result.push((token.row - (n - 1), token.column - (n - 1))); 
        result.push((token.row - (n - 1), token.column - (n + 1)));
        result.push((token.row - (n + 1), token.column - (n - 1)));
        result.push((token.row - (n + 1), token.column - (n + 1)));
    }
    return result;
}

/******************************************************************************
 *  get_movement_option - Calculate possible paths based on movement speed
 * 
 *  PARAMS: GRID is the layout of the map, the TOKEN moving, and ACTION is the 
 *      amount of action points left which limit range of movement.
 *  RETURN: Possible movements going up, down, left, and right
 * 
 ******************************************************************************/
fn get_movement_option(grid: &Vec<Vec<char>>, token: &Token, action: f32) -> Option<[i32; 4]>
{
    let mut some = false;
    let mut result = [0, 0, 0, 0];
    let ratio = action as f32/ 3.0;
    for result_index in 0..4 {
        let mut possible_path = 1;
        let mut new_col = token.column as usize;
        let mut new_row = token.row as usize;

        while possible_path as f32 <= (token.sheet.movement_speed / 5 ) as f32 * ratio {
            let mut edge_not_reached = false;
            match result_index {
                0 => { // Up
                    edge_not_reached = token.row - possible_path >= 0;
                    new_row = (token.row - possible_path) as usize;
                },
                1 => { // Down
                    edge_not_reached = token.row + possible_path < grid[0].len() as i32;
                    new_row = (token.row + possible_path) as usize;
                },
                2 => { // left
                    edge_not_reached = token.column - possible_path >= 0;
                    new_col = (token.column - possible_path) as usize;
                },
                3 => { // right
                    edge_not_reached = token.column + possible_path < grid[0].len() as i32;
                    new_col = (token.column + possible_path) as usize;
                },
                _ => {panic!("How did this happen? Somehow the result index isn't 0 to 4") }
            }
            if ! ( edge_not_reached && (grid[new_row][new_col] == '0')) 
                { break };
            result[result_index] = possible_path;
            possible_path+=1;
            some = true;
        }
    }
    if some { return Some(result) };
    return None;
}

////////////////////////////////////////////////    MUTATE TOKEN FN'S    //////////////////////////////////////////////////////

/******************************************************************************
 *  remove_item - Removes equipment in the slot specified by the key
 *  
 *  PARAMS: TOKEN is a mutable token, and KEY is the String key for its map
 *---------------------------------------------------------------------------*/ 
fn remove_item(token: &mut Token, key: String)
{
    let item: &Item = token.sheet.equipment.get(&key).unwrap();     // Remove any abiltiy given by the equipment
    for key in &item.abilities {
        if token.sheet.abilities.contains(key) {
            token.sheet.abilities.remove(key);
        }
    }
    for key in &item.effects {                                      // Remove any effects given by the equipment
        if token.sheet.effects.contains_key(key) {
            token.sheet.effects.remove(key);
        }
    }
    token.sheet.items.push(token.sheet.equipment.remove(&key).unwrap())
}

/******************************************************************************
 *  apply_item - Apply item at the index of the character's item list
 *  
 *  PARAMS: TOKEN is a mutable token, and INDEX is the index of the item used
 *---------------------------------------------------------------------------*/ 
fn apply_item(token: &mut Token, index: usize)
{
    let item = token.sheet.items.remove(index);                     // remove item from the list
    for key in &item.abilities {
        token.sheet.abilities.insert(key.clone());
    }                                                               // still needs to add effects !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    if item.slots.len() > 0 {                                       // loop the next line through slots entries
        token.sheet.equipment.insert(item.slots[0].clone(), item);
    }
}

/******************************************************************************
 *  use_ability - Use ability on the occupant of the target cell
 *  
 *  PARAMS: SET to lookup ABILITY key, GRID to find TARGET cell occupant
 *---------------------------------------------------------------------------*/ 
fn use_ability(set: &mut MasterList, grid: &mut Vec<Vec<char>>, target: (i32, i32), ability: &String)
{
    if set.characters.get(&grid[target.0 as usize][target.1 as usize]).is_none()    // If the cell is unoccupied, return
        { return };
    
    let target = set.characters.get_mut(&grid[target.0 as usize][target.1 as usize]).unwrap();
    let effect = set.effects.get(ability).unwrap().clone();
    target.effects.insert(ability.to_string(), effect);                             // apply ability effect and instantly proc
    apply_effect(target, ability);
}

/****************************************************************************** !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *  apply_effect - Apply effect on the stat of a character                      !!        NOTE: CURRENTLY UNFINISHED         !!
 *                                                                              !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *  PARAMS: TOKEN is the target token, and KEY is the String ID for the effect
 *---------------------------------------------------------------------------*/ 
fn apply_effect(target: &mut Character, key: &String)
{
    let mut effect = target.effects.get_mut(key).unwrap();
    println!("{}: {} hp", target.name, target.hitpoints);   // for debugging
    target.hitpoints -= effect.modifier[1];
    effect.duration -= 1;
    println!("{}: {} hp", target.name, target.hitpoints);
    if effect.duration == 0 { target.effects.remove(key); };
}

/******************************************************************************
 *  move_token - Move token to the specified cell, one direction at a time
 *  
 *  PARAMS: GRID to reposition roken, DIRECTION and DISTANCE as i32, and TOKEN
 *---------------------------------------------------------------------------*/ 
fn move_token(grid: &mut Vec<Vec<char>>, direction: i32, distance: i32, token: &mut Token)
{
    let mut new_row = token.row as usize;
    let mut new_col = token.column as usize;

    match direction {
        0 => { new_row = (token.row - distance) as usize; }
        1 => { new_row = (token.row + distance) as usize; }
        2 => { new_col = (token.column - distance) as usize; }
        3 => { new_col = (token.column + distance) as usize; }
        _ => {panic!()}
    }

    grid[new_row][new_col] = grid[(token.row) as usize][(token.column) as usize];
    grid[(token.row) as usize][(token.column) as usize] = '0';

    token.row = new_row as i32;
    token.column = new_col as i32;
}

////////////////////////////////////////////////    WRAPPER FN'S    ///////////////////////////////////////////////////////////

/******************************************************************************
 *  request_to_string - logs request as screen and asks for DM approval
 * 
 *  PARAMS: SET to lookup game entities, the current TOKEN, and current REQuest
 *  RETURN: TRUE allows for execution, FALSE skips this request
 * 
 ******************************************************************************/
fn request_to_string(set: &MasterList, tok: &Token, req: &Request) -> bool
{
    let options = ["use", "move", "remove"];
    let mut prompt = ["".to_string(), "".to_string(), "".to_string()];
    let mut action = 0;
    match req.action_type {
        0 => {
            action = 1;
            match req.subtype_int.unwrap() {
                0 => { prompt[0] = "up".to_string() },
                1 => { prompt[0] = "down".to_string() },
                2 => { prompt[0] = "left".to_string() },
                3 => { prompt[0] = "right".to_string() },
                _ => {}
            }
            prompt[1] = req.magnitude.unwrap().to_string();
        },
        1 => {
            action = 2;
            let name: Option<String> = req.subtype_key.clone();
            let item: &Item = tok.sheet.equipment.get(&name.unwrap()).unwrap();
            prompt[0] = item.name.clone();
        },
        2 => {
            let name: Option<String> = req.subtype_key.clone();
            prompt[0] = set.abilities.get(&name.unwrap()).unwrap().name.clone();
            if req.target_cell.is_some(){
                prompt[1] = "on cell ".to_string() + &req.target_cell.unwrap().0.to_string() 
                    + ", " + &req.target_cell.unwrap().0.to_string();
            }
        },
        3 => {
            prompt[0] = tok.sheet.items[req.subtype_int.unwrap() as usize].name.to_string();
            if req.target_cell.is_some(){
                prompt[1] = "on cell".to_string() + &req.target_cell.unwrap().0.to_string() 
                    + ", " + &req.target_cell.unwrap().0.to_string();
            }
        },
        _ => {}
    }
    println!("{} wants to {} {} {} {}", tok.sheet.name, options[action], prompt[0], prompt[1], prompt[2]);
    println!("Approve? 1 - Yes or 2 - No");
    return get_input() == 1;
}

/******************************************************************************
 *  board_from_str - loads board tokens and layout from a string representation
 * 
 *  PARAMS: BOARD is the board being loaded, MAP gives the character associated
 *      with the char token, and INPUT is the Str representation of the board
 *  RETURN: TRUE allows for execution, FALSE skips this request
 * 
 ******************************************************************************/
pub fn board_from_str(board: &mut Board, map: &HashMap<char, Character>, input: String)
{
    let mut result = Vec::new();
    let mut row: Vec<char> = Vec::new();

    let mut column = 0;
    for c in input.chars() {
        if column == board.width {
            result.push(row);
            row = Vec::new();
            column = 0;
        }

        row.push(c);
        column += 1;

        if c == '1' || c == '0' { continue; };
        if map.contains_key(&c) {
            let clone_token = map.get(&c).unwrap().clone();
            board.session_tokens.push(Token {column: column-1, row: result.len() as i32, sheet: clone_token} );
        }
        else { board.unresolved_tokens.push(c); }
    }
    board.grid = result;
}

////////////////////////////////////////////////    TESTING FN'S    ///////////////////////////////////////////////////////////

// get int from STDIN for terminal testing
fn get_input() -> i32
{
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
 
    return input.trim().parse::<i32>().unwrap_or_else(|_| {
        eprintln!("- You must enter an integer");
        drop(input);
        process::exit(1);
    });
}

// Board layout as a string example
const BOARD_TEMPLATE: &str = {
    "a00100010000000010000010000000000100010111111010000010000000000000010000001010000000000000111111011111101010000011100111000000010000001010000010000000000000010111111011101110011110000x00010000001010101000010000110111111110111010101000010000000100000000100010101101111111000100000000100110101000000000000100000000100100101111111110000100000000100001101000000000000000000000100111001000111110000100000000100100011000100000000100000000100001110000100000"
};

// Demo for testing from terminal
pub fn demo()
{
    let mut my_game = MasterList { characters: HashMap::new(), abilities: HashMap::new(), effects: HashMap::new() };

    let mut demo_board = Board {
        name: String::from("board1"),
        width: 30, height: 15,
        grid: Vec::new(),
        unresolved_tokens: Vec::new(),
        session_tokens: Vec::new()
    };

    let damage = Effect {
        duration: 1,
        name: "slash_damage".to_string(),
        modifier: [1, 10, 1],
        one_shot: true
    };

    let slash = Ability {
        name: "Slash".to_string(),
        modifier: [-8, -1, 1],
        roll: [20, 1],
        range: 5,
        requirements: Vec::new(),
        effects: HashSet::from(["slash_damage".to_string()])
    };

    my_game.abilities.insert("slash".to_string(), slash);
    my_game.effects.insert("slash_damage".to_string(), damage);

    let sword = Item {
        name: "Short sword".to_string(),
        uses : -1,
        slots: vec!["main_hand".to_string()],
        weight: 5,
        abilities: HashSet::from(["slash".to_string()]),
        effects: HashSet::new()
    };

    let hero = Character {
        name: "Rogue".to_string(),
        playable: true,
        class: "rogue".to_string(),
        abilities: HashSet::new(),
        armor_rating: 12,
        hitpoints: 20,
        max_hitpoints: 20,
        stats: [8, 14, 8, 10, 10, 10],
        effects: HashMap::new(),
        equipment: HashMap::new(),
        experience: 0,
        initiative: 0,
        items: vec![sword],
        movement_speed: 30,
        traits: HashSet::new()
    };

    let foe = Character {
        name: "skeleton".to_string(),
        playable: false,
        class: "warrior".to_string(),
        abilities: HashSet::new(),
        armor_rating: 12,
        hitpoints: 10,
        max_hitpoints: 10,
        stats: [8, 14, 8, 10, 10, 10],
        effects: HashMap::new(),
        equipment: HashMap::new(),
        experience: 0,
        initiative: 0,
        items: Vec::new(),
        movement_speed: 30,
        traits: HashSet::new()
    };

    let mut map: HashMap<char, Character> = HashMap::new();
    map.insert('a', hero);
    map.insert('x', foe);

    board_from_str(&mut demo_board, & map, BOARD_TEMPLATE.to_string());
    loop { 
        println!("{}", demo_board);
        let requests = &give_turns(&my_game, &demo_board);
        approve_and_execute(&mut my_game, &mut demo_board, &requests );
    }
}