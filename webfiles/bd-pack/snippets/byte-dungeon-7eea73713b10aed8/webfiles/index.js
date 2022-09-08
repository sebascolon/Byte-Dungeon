import * as wasm from "byte-dungeon";
import { draw_lines } from "./startup_gfx";

const Application = PIXI.Application;
const Graphics = PIXI.Graphics;

const app = new Application({
    width: window.innerWidth *.75,
    height: window.innerHeight * 0.75,
    transparent: false,
    antialias: true
});

//app.renderer.backgroundColor = 0xFFC0CB;
app.renderer.backgroundColor = 0x1f1e1c;
app.renderer.view.style.position = 'absolute';
document.body.appendChild(app.view);

const style = new PIXI.TextStyle({
    fontFamily: 'Arial',
    dropShadow: true,
    dropShadowAlpha: 0.8,
    dropShadowAngle: 2.1,
    dropShadowBlur: 4,
    dropShadowColor: '0xf26b8a',
    dropShadowDistance: 10,
    fill: ['#ffffff'],
    stroke: '#FFFFFF',
    fontSize: 60,
    fontWeight: 'lighter',
    lineJoin: 'round',
    strokeThickness: 6,
});

let current_game = wasm.load_game_manual();

export function render(rows, columns, tile_map)
{
    draw_lines(app, rows, columns, tile_map);
}