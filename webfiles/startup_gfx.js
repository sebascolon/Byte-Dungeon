// single threaded one way looping but compiled
// control flow loops can freeze up events under
//      this is why set_timeout/ promises async functions/ await 
// making my own modules and libs

export function draw_lines(app, rows, columns, tile_map) // 
{
    var square_size = (window.innerWidth/32);
    app.renderer.resize((square_size*rows)-2, (square_size*columns)-2);

    let tile = 0;
    for (let j = 0; j < (square_size*columns)-2; j+= square_size)
        for (let i = 0; i < (square_size*rows)-2; i+=square_size)
        {
            const box = new PIXI.Graphics()
            .lineStyle(1, 0xBBBBBB, 1)

            var is_wall = false;
            if (tile_map.charAt(tile) == '1')
            {
                box.beginFill(0xAAAAAA);
                box.drawRect(i, j, square_size, square_size);
                box.endFill();
                is_wall = true;
            }
            else
                box.drawRect(i, j, square_size, square_size);                   // Ask david type issue
            var sprite = new PIXI.Sprite(app.renderer.generateTexture(box));
            sprite.x = i;
            sprite.y = j;
            sprite.interactive = true;
            sprite.buttonMode = true;
            sprite.on('pointerdown', onClick);
            app.stage.addChild(sprite);
            tile++;
        }
    
    function onClick() {
        console.log(sprite.x);
        console.log(sprite.y);
    }
}