import * as wasm from "byte-dungeon";

//wasm.greet();

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
app.renderer.resize(window.innerWidth-5, window.innerHeight-5);
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
  input_text.text = ` ${e.code}`;
  load_template();
}

var rows = 20;
for (let i = (window.innerWidth/rows); i < window.innerWidth; i+=(window.innerWidth/rows))
{
  let myGraph = new PIXI.Graphics();

  myGraph.position.set(0, 0);

  myGraph.lineStyle(1, 0xAAAAAA)
  .moveTo(i, 0)
  .lineTo(i, 1000);

  app.stage.addChild(myGraph);

  let myGraph2 = new PIXI.Graphics();

  myGraph2.position.set(0, 0);

  myGraph2.lineStyle(1, 0xFFFFFF)
  .moveTo(0, i)
  .lineTo(window.innerWidth, i);

  app.stage.addChild(myGraph2);
}

function load_template()
{
  input_text.text = ` ${e.code}`;

}