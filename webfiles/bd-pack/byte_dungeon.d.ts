/* tslint:disable */
/* eslint-disable */
/**
*/
export function greet(): void;
/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function get_char(row: number, col: number): any;
/**
* @param {any} request
*/
export function execute_request(request: any): void;
/**
* @param {string} token
* @param {any} request
*/
export function insert_request(token: string, request: any): void;
/**
*/
export function sort_requests(): void;
/**
* @returns {any}
*/
export function get_requests(): any;
/**
* @returns {any}
*/
export function board_to_string(): any;
/**
* @param {number} a_type
* @param {string} key
* @param {string} tok
* @param {number} end_row
* @param {number} end_col
* @returns {any}
*/
export function generate_request(a_type: number, key: string, tok: string, end_row: number, end_col: number): any;
/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function find_character(row: number, col: number): any;
/**
* @param {number} rows
* @param {number} cols
*/
export function resize_board(rows: number, cols: number): void;
/**
* @param {string} key
* @returns {any}
*/
export function get_character(key: string): any;
/**
* @param {number} row
* @param {number} column
* @param {number} range
* @param {boolean} target
* @returns {any}
*/
export function collect_cell_options(row: number, column: number, range: number, target: boolean): any;
/**
* @param {any} data
*/
export function load_game(data: any): void;
/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function toggle_cell(row: number, col: number): any;
/**
*/
export function reset_session(): void;
/**
*/
export function output_grid(): void;
/**
* @returns {any}
*/
export function get_dimensions(): any;
/**
*/
export function generate_tutorial(): void;
/**
* @returns {any}
*/
export function export_game(): any;
/**
* @param {string} tk
* @param {string} nm
* @param {number} sp
* @param {number} iv
* @param {number} hp
* @param {number} mp
* @param {number} st
* @param {number} dx
* @param {number} cn
* @param {number} it
* @param {number} ws
* @param {number} ch
* @param {string | undefined} tr
*/
export function add_character(tk: string, nm: string, sp: number, iv: number, hp: number, mp: number, st: number, dx: number, cn: number, it: number, ws: number, ch: number, tr?: string): void;
/**
* @param {string} token
* @param {string} item_key
*/
export function give_item(token: string, item_key: string): void;
/**
* @param {string} token
* @param {number} row
* @param {number} col
*/
export function place_token(token: string, row: number, col: number): void;
/**
* @param {string} token
* @param {string} abil_key
*/
export function give_ability(token: string, abil_key: string): void;
/**
* @param {string} nm
* @param {number} us
* @param {number} wgt
* @param {string | undefined} slot
* @param {string | undefined} effx
* @param {string | undefined} abil
*/
export function add_item(nm: string, us: number, wgt: number, slot?: string, effx?: string, abil?: string): void;
/**
* @param {string} nm
* @param {number} ran
* @param {number} ap
* @param {number} low
* @param {number} high
* @param {string | undefined} stat
* @param {string | undefined} req
* @param {string | undefined} tar
* @param {string | undefined} cas
*/
export function add_ability(nm: string, ran: number, ap: number, low: number, high: number, stat?: string, req?: string, tar?: string, cas?: string): void;
/**
* @param {string} nm
* @param {number} dur
* @param {string} target
* @param {number} low
* @param {number} high
* @param {boolean} temp
*/
export function add_effect(nm: string, dur: number, target: string, low: number, high: number, temp: boolean): void;
/**
* @param {number} src_row
* @param {number} src_col
* @param {number} end_row
* @param {number} end_col
* @returns {number}
*/
export function get_cell_distance(src_row: number, src_col: number, end_row: number, end_col: number): number;
