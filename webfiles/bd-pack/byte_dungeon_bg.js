import * as wasm from './byte_dungeon_bg.wasm';

const heap = new Array(32).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 36) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8Memory0;
function getUint8Memory0() {
    if (cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length);
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len);

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3);
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedInt32Memory0;
function getInt32Memory0() {
    if (cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}
/**
*/
export function greet() {
    wasm.greet();
}

/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function get_char(row, col) {
    const ret = wasm.get_char(row, col);
    return takeObject(ret);
}

/**
* @param {any} request
*/
export function execute_request(request) {
    wasm.execute_request(addHeapObject(request));
}

/**
* @param {string} token
* @param {any} request
*/
export function insert_request(token, request) {
    wasm.insert_request(token.codePointAt(0), addHeapObject(request));
}

/**
*/
export function sort_requests() {
    wasm.sort_requests();
}

/**
* @returns {any}
*/
export function get_requests() {
    const ret = wasm.get_requests();
    return takeObject(ret);
}

/**
* @returns {any}
*/
export function board_to_string() {
    const ret = wasm.board_to_string();
    return takeObject(ret);
}

/**
* @param {number} a_type
* @param {string} key
* @param {string} tok
* @param {number} end_row
* @param {number} end_col
* @returns {any}
*/
export function generate_request(a_type, key, tok, end_row, end_col) {
    const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_request(a_type, ptr0, len0, tok.codePointAt(0), end_row, end_col);
    return takeObject(ret);
}

/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function find_character(row, col) {
    const ret = wasm.find_character(row, col);
    return takeObject(ret);
}

/**
* @param {number} rows
* @param {number} cols
*/
export function resize_board(rows, cols) {
    wasm.resize_board(rows, cols);
}

/**
* @param {string} key
* @returns {any}
*/
export function get_character(key) {
    const ret = wasm.get_character(key.codePointAt(0));
    return takeObject(ret);
}

/**
* @param {number} row
* @param {number} column
* @param {number} range
* @param {boolean} target
* @returns {any}
*/
export function collect_cell_options(row, column, range, target) {
    const ret = wasm.collect_cell_options(row, column, range, target);
    return takeObject(ret);
}

/**
* @param {any} data
*/
export function load_game(data) {
    wasm.load_game(addHeapObject(data));
}

/**
* @param {number} row
* @param {number} col
* @returns {any}
*/
export function toggle_cell(row, col) {
    const ret = wasm.toggle_cell(row, col);
    return takeObject(ret);
}

/**
*/
export function reset_session() {
    wasm.reset_session();
}

/**
*/
export function output_grid() {
    wasm.output_grid();
}

/**
* @returns {any}
*/
export function get_dimensions() {
    const ret = wasm.get_dimensions();
    return takeObject(ret);
}

/**
*/
export function generate_tutorial() {
    wasm.generate_tutorial();
}

/**
* @returns {any}
*/
export function export_game() {
    const ret = wasm.export_game();
    return takeObject(ret);
}

function isLikeNone(x) {
    return x === undefined || x === null;
}
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
export function add_character(tk, nm, sp, iv, hp, mp, st, dx, cn, it, ws, ch, tr) {
    const ptr0 = passStringToWasm0(tk, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(nm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(tr) ? 0 : passStringToWasm0(tr, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    wasm.add_character(ptr0, len0, ptr1, len1, sp, iv, hp, mp, st, dx, cn, it, ws, ch, ptr2, len2);
}

/**
* @param {string} token
* @param {string} item_key
*/
export function give_item(token, item_key) {
    const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(item_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.give_item(ptr0, len0, ptr1, len1);
}

/**
* @param {string} token
* @param {number} row
* @param {number} col
*/
export function place_token(token, row, col) {
    const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.place_token(ptr0, len0, row, col);
}

/**
* @param {string} token
* @param {string} abil_key
*/
export function give_ability(token, abil_key) {
    const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(abil_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.give_ability(ptr0, len0, ptr1, len1);
}

/**
* @param {string} nm
* @param {number} us
* @param {number} wgt
* @param {string | undefined} slot
* @param {string | undefined} effx
* @param {string | undefined} abil
*/
export function add_item(nm, us, wgt, slot, effx, abil) {
    const ptr0 = passStringToWasm0(nm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(slot) ? 0 : passStringToWasm0(slot, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(effx) ? 0 : passStringToWasm0(effx, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(abil) ? 0 : passStringToWasm0(abil, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    wasm.add_item(ptr0, len0, us, wgt, ptr1, len1, ptr2, len2, ptr3, len3);
}

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
export function add_ability(nm, ran, ap, low, high, stat, req, tar, cas) {
    const ptr0 = passStringToWasm0(nm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(stat) ? 0 : passStringToWasm0(stat, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(req) ? 0 : passStringToWasm0(req, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(tar) ? 0 : passStringToWasm0(tar, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    var ptr4 = isLikeNone(cas) ? 0 : passStringToWasm0(cas, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len4 = WASM_VECTOR_LEN;
    wasm.add_ability(ptr0, len0, ran, ap, low, high, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
}

/**
* @param {string} nm
* @param {number} dur
* @param {string} target
* @param {number} low
* @param {number} high
* @param {boolean} temp
*/
export function add_effect(nm, dur, target, low, high, temp) {
    const ptr0 = passStringToWasm0(nm, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.add_effect(ptr0, len0, dur, ptr1, len1, low, high, temp);
}

/**
* @param {number} src_row
* @param {number} src_col
* @param {number} end_row
* @param {number} end_col
* @returns {number}
*/
export function get_cell_distance(src_row, src_col, end_row, end_col) {
    const ret = wasm.get_cell_distance(src_row, src_col, end_row, end_col);
    return ret;
}

export function __wbg_log_13a8b9bdc9ade567(arg0, arg1) {
    console.log(getStringFromWasm0(arg0, arg1));
};

export function __wbg_alert_37f6babd16c52b7e(arg0, arg1) {
    alert(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_object_drop_ref(arg0) {
    takeObject(arg0);
};

export function __wbindgen_json_parse(arg0, arg1) {
    const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
};

export function __wbindgen_json_serialize(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = JSON.stringify(obj === undefined ? null : obj);
    const ptr0 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len0;
    getInt32Memory0()[arg0 / 4 + 0] = ptr0;
};

cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);

