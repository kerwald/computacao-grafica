const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

console.log(ctx);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', function(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

let ctrl = 0;
let j = 0;
let m = 0;
let pontos = [];

function catmullRom(p0, p1, p2, p3, t) {

    let t2 = t * t;
    let t3 = t2 * t;

    let x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    );

    let y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );

    return { x, y };

}

canvas.addEventListener('click', function (event) {
    if( ctrl < 10 ){
        ctrl++;
    
        pontos.push( { x : event.x, y : event.y } );
    
    } else if(ctrl == 10){
        ctrl++;
        let p0 = { x : 2 * pontos[0].x - pontos[1].x, y : 2 * pontos[0].y - pontos[1].y };
        let pn = { x : 2 * pontos[pontos.length-1].x - pontos[pontos.length-2].x, y : 2 * pontos[pontos.length-1].y - pontos[pontos.length-2].y };
        pontos.unshift(p0);
        pontos.push(pn);
    } else{
        ctrl++;
    }

})

function draw() {

    if( ctrl > 10 ){

        ctx.fillStyle = "red";
        for( let i=1; i<pontos.length-1; i++ ){
            ctx.beginPath();
            ctx.arc( pontos[i].x, pontos[i].y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        let result;

        ctx.strokeStyle = "blue";
        ctx.lineWidth = 5; 
        ctx.beginPath();

        for( let i=0; i < pontos.length-3 ; i++ ){
            for( let t=0; t<=100; t++ ){
                    result = catmullRom( pontos[i], pontos[i+1], pontos[i+2], pontos[i+3], t/100 );
                    if ( t === 0) {
                        ctx.moveTo(result.x, result.y); 
                    } else {
                        ctx.lineTo(result.x, result.y); 
                    }
            }
        }
        ctx.stroke(); 

        if( j < pontos.length-3 && ctrl%2 == 0 ){
            ctx.fillStyle = "white";
            ctx.beginPath();
            result = catmullRom( pontos[j], pontos[j+1], pontos[j+2], pontos[j+3], m/100 );
            ctx.arc(result.x, result.y, 8, 0, Math.PI * 2);
            ctx.fill();
            if( m == 100 ){
                m = 0;
                j++;
            }
            m = m + 4;
        } else if( ctrl%2 == 0 ){
            j=0;
        }

    } else{
        ctx.fillStyle = "red";
        for( let i=0; i<pontos.length; i++ ){
            ctx.beginPath();
            ctx.arc( pontos[i].x, pontos[i].y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
}

function animate(){

    ctx.clearRect(0, 0, canvas.width, canvas.height );

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    draw();

    requestAnimationFrame(animate);
    
}

animate();
