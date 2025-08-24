const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

console.log(ctx);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', function( ) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

let ctrl = 0;
let pontos = [];
let pontosIntermediarios = []

let indiceA = 0;
let indiceB = 0;

canvas.addEventListener( 'click', function (event) {
    if ( ctrl < 4 ) {
        if( ctrl < 3 ){
            pontos.push( { x : event.x, y : event.y } );
        }
        pontosIntermediarios.push( { x : event.x, y : event.y } );
        ctrl++;
    } else {
        ctrl++;
    }

} )


/*
==========================================================
Draw

Responsável por desenha os pontos, as curvas e o movimento da bola branca na tela
==========================================================
*/
function Draw() {

    if( ctrl > 3  ){

        ctx.fillStyle = "red";
        for( let i = 0; i < pontosIntermediarios.length; i++ ) {
            ctx.beginPath();
            ctx.arc( pontosIntermediarios[i].x, pontosIntermediarios[i].y, 1, 0, Math.PI * 2 );
            ctx.fill();
        }

        indiceA = Math.floor(Math.random() * pontos.length);

        
        indiceB = pontosIntermediarios.length - 1;
        pontoIntermediarioX = ( pontosIntermediarios[indiceA].x + pontosIntermediarios[indiceB].x ) / 2;
        pontoIntermediarioY = ( pontosIntermediarios[indiceA].y + pontosIntermediarios[indiceB].y ) / 2;
        pontosIntermediarios.push( { x : pontoIntermediarioX, y : pontoIntermediarioY } );


    } else{
        ctx.fillStyle = "red";
        for( let i = 0; i < pontosIntermediarios.length; i++ ) {
            ctx.beginPath();
            ctx.arc( pontosIntermediarios[i].x, pontosIntermediarios[i].y, 10, 0, Math.PI * 2 );
            ctx.fill();
        }
    }
    ctx.stroke(); 


}

/*
==========================================================
Animate

Mantém a animação em loop, limpando a tela e redesenhando os elementos com o uso do requestAnimationFrame.
==========================================================
*/
function Animate(){

    ctx.clearRect(0, 0, canvas.width, canvas.height );

    ctx.fillStyle = "black";
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
  
    Draw();

    requestAnimationFrame( Animate );
    
}

Animate();
