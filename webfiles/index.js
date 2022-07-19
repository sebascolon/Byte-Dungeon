import * as wasm from "byte-dungeon";
import { draw_lines } from "./startup_gfx";

// wasm.greet();

const Application = PIXI.Application;
const Graphics = PIXI.Graphics;

const app = new Application({
    width: 500,
    height: 500,
    transparent: false,
    antialias: true
});

//app.renderer.backgroundColor = 0xFFC0CB;
app.renderer.backgroundColor = 0x1f1e1c;
app.renderer.resize(window.innerWidth-2, window.innerHeight-2);
app.renderer.view.style.position = 'absolute';

const rectang = new Graphics();
rectang.beginFill(0xFFD8E7)
.drawRect(0, 0, window.innerWidth, 130)
.endFill();

app.stage.addChild(rectang);
document.body.appendChild(app.view);

document.addEventListener('keydown', logKey);

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

const console_style = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fill: ['#FFFFFF'],
    stroke: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'lighter',
    lineJoin: 'round',
    strokeThickness: 1,
});

const basicText = new PIXI.Text('Welcome to Byte Dungeon', style);
basicText.x = 20;
basicText.y = 20;

app.stage.addChild(basicText);

const input_text = new PIXI.Text('Press any button to begin', console_style);
input_text.y = 155;
input_text.x = 22;
app.stage.addChild(input_text);
        setInterval(() => {
          if(input_text.text == 'Press any button to begin') {
            input_text.text = 'Press any button to begin|'
          }else if (input_text.text == 'Press any button to begin|'){
            input_text.text = 'Press any button to begin';
          }
        }, 550);

function logKey(e) {
  //let width = prompt("Please enter grid width");
  //let height = prompt("Please enter grid height");

  app.stage.removeChild(rectang);
  app.stage.removeChild(basicText);
  app.stage.removeChild(input_text);
  draw_lines(app, 30, 15, wasm.get_template());
  document.removeEventListener('keydown', logKey);
  const texture = PIXI.Texture.from('assets/knight.png');
  texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const player = new PIXI.Sprite(texture);
  player.scale.set(3);
  player.anchor.set(0.5); 
  player.interactive = true;
  player.buttonMode = true;
  player
    .on('pointerdown', onDragStart)
    .on('pointerup', onDragEnd)
    .on('pointerupoutside', onDragEnd)
    .on('pointermove', onDragMove);
  app.stage.addChild(player);
}

function onDragStart(event) {
  // store a reference to the data
  // the reason for this is because of multitouch
  // we want to track the movement of this particular touch
  this.data = event.data;
  this.alpha = 0.5;
  this.dragging = true;
}

function onDragEnd() {
  this.alpha = 1;
  this.dragging = false;
  // set the interaction data to null
  this.data = null;
}

function onDragMove() {
  if (this.dragging) {
      const newPosition = this.data.getLocalPosition(this.parent);
      this.x = newPosition.x;
      this.y = newPosition.y;
  }
}