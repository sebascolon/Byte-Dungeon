/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function load_game(a: number): void;
export function export_game(): number;
export function reset_session(): void;
export function get_char(a: number, b: number): number;
export function find_character(a: number, b: number): number;
export function get_character(a: number): number;
export function get_dimensions(): number;
export function board_to_string(): number;
export function add_character(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number): void;
export function add_item(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number): void;
export function add_ability(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number): void;
export function add_effect(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number): void;
export function generate_request(a: number, b: number, c: number, d: number, e: number, f: number): number;
export function get_requests(): number;
export function insert_request(a: number, b: number): void;
export function sort_requests(): void;
export function execute_request(a: number): void;
export function resize_board(a: number, b: number): void;
export function toggle_cell(a: number, b: number): number;
export function place_token(a: number, b: number, c: number, d: number): void;
export function collect_cell_options(a: number, b: number, c: number, d: number): number;
export function get_cell_distance(a: number, b: number, c: number, d: number): number;
export function give_item(a: number, b: number, c: number, d: number): void;
export function give_ability(a: number, b: number, c: number, d: number): void;
export function __wbindgen_malloc(a: number): number;
export function __wbindgen_realloc(a: number, b: number, c: number): number;
