'use client';
import React, { useRef, useEffect, useState } from 'react';

const GameEngine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Estados para a Interface de Usuário (UI)
  const [view, setView] = useState<'game' | 'canvas'>('game');
  const [gameState, setGameState] = useState({ 
    hasStarted: false,
    gameOver: false, 
    isPaused: false,
    score: 0, 
    pixels: 0,
    highScore: 0
  });
  
  // Refs para armazenar os áudios e imagens
  const jumpSoundRef = useRef<HTMLAudioElement | null>(null);
  const coinSoundRef = useRef<HTMLAudioElement | null>(null);
  const deathSoundRef = useRef<HTMLAudioElement | null>(null);
  const pauseSoundRef = useRef<HTMLAudioElement | null>(null);
  
  // [MUDANÇA] Ref para armazenar a imagem da azeitona
  const oliveImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Inicializa os áudios no Client-Side
    jumpSoundRef.current = new Audio('/sounds/pop.wav');
    coinSoundRef.current = new Audio('/sounds/coin.wav');
    deathSoundRef.current = new Audio('/sounds/death.wav');
    pauseSoundRef.current = new Audio('/sounds/pause.wav');

    // [MUDANÇA] Inicializa e carrega a imagem da azeitona
    const oliveImg = new Image();
    oliveImg.src = '/images/olive.png'; // Caminho para sua imagem na pasta public
    oliveImageRef.current = oliveImg;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // [MUDANÇA OPTATIVA] Garante que a pixel art não fique borrada ao ser desenhada
    ctx.imageSmoothingEnabled = false; 
    
    let animationFrameId: number;

    const player = {
      x: 50, y: 150, width: 20, height: 20,
      velocity: 0, gravity: 0.4, jumpStrength: -7
    };

    let obstacles = [
      { x: 400, y: 200, width: 120, height: 40, color: '#3b82f6', isBrand: true }, 
      { x: 600, y: 150, width: 15, height: 15, color: '#f59e0b', isBrand: false },
    ];

    let particles: any[] = [];
    let hasStarted = false;
    let isGameOver = false;
    let isPaused = false;
    let score = 0;
    let collectedPixels = 0;
    let shakeFrames = 0;
    let gameSpeed = 3;
    
    let currentHighScore = parseInt(localStorage.getItem('pixelArenaHighScore') || '0');
    setGameState(prev => ({ ...prev, highScore: currentHighScore }));

    const playSound = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.warn("Áudio bloqueado", err));
      }
    };

    const triggerGameOver = () => {
      isGameOver = true;
      shakeFrames = 15;
      playSound(deathSoundRef);
      
      if (Math.floor(score) > currentHighScore) {
        currentHighScore = Math.floor(score);
        localStorage.setItem('pixelArenaHighScore', currentHighScore.toString());
      }
      
      setGameState(prev => ({ 
        ...prev, 
        gameOver: true, 
        score: Math.floor(score), 
        pixels: collectedPixels,
        highScore: currentHighScore
      }));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyP' || e.code === 'Escape') && hasStarted && !isGameOver) {
         isPaused = !isPaused;
         playSound(pauseSoundRef);
         setGameState(prev => ({ ...prev, isPaused }));
         return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); 
        if (isPaused) return;

        if (!hasStarted) {
          hasStarted = true;
          setGameState(prev => ({ ...prev, hasStarted: true }));
          player.velocity = player.jumpStrength;
          playSound(jumpSoundRef);
        } else if (isGameOver) {
          player.y = 150;
          player.velocity = 0;
          obstacles = [
            { x: 400, y: 200, width: 120, height: 40, color: '#3b82f6', isBrand: true },
            { x: 600, y: 150, width: 15, height: 15, color: '#f59e0b', isBrand: false },
          ];
          particles = [];
          isGameOver = false;
          score = 0;
          collectedPixels = 0;
          shakeFrames = 0;
          gameSpeed = 3;
          setGameState(prev => ({ ...prev, gameOver: false, score: 0, pixels: 0 }));
          render(); 
        } else {
          player.velocity = player.jumpStrength;
          playSound(jumpSoundRef);
          
          for (let i = 0; i < 5; i++) {
            particles.push({
              x: player.x + player.width / 2,
              y: player.y + player.height,
              vx: (Math.random() - 0.5) * 2,
              vy: Math.random() * 2,
              life: 1.0
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });

    const checkCollision = (rect1: any, rect2: any) => {
      return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.height + rect1.y > rect2.y
      );
    };

    const render = () => {
      if (isGameOver && shakeFrames <= 0) return;
      if (isPaused) {
         animationFrameId = window.requestAnimationFrame(render);
         return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (shakeFrames > 0) {
        ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
        shakeFrames--;
      }

      if (hasStarted && !isGameOver) {
        player.velocity += player.gravity;
        player.y += player.velocity;
        score += 0.05; 
        gameSpeed = 3 + (score / 150); 
        
        if (Math.floor(score) % 5 === 0) {
            setGameState(prev => ({ ...prev, score: Math.floor(score) }));
        }
      }

      if ((player.y + player.height >= canvas.height || player.y <= 0) && hasStarted) {
        if (!isGameOver) triggerGameOver();
      }

      // Cálculo de Squash and Stretch (mantido igual)
      let drawWidth = player.width;
      let drawHeight = player.height;
      if (hasStarted) {
          if (player.velocity < -2) { drawHeight += 6; drawWidth -= 4; } 
          else if (player.velocity > 3) { drawHeight += 6; drawWidth -= 4; } 
          else if (player.velocity > -1 && player.velocity < 1) { drawHeight -= 2; drawWidth += 2; } 
      }

      // [MUDANÇA] Desenho do Jogador substitui o quadrado branco pela Azeitona
      // Mantemos o cálculo exato do tamanho e posição para preservar o feedback visual (squash and stretch)
      if (oliveImageRef.current && oliveImageRef.current.complete) {
          ctx.drawImage(
              oliveImageRef.current, // A imagem
              player.x + (player.width - drawWidth) / 2, // Posição X ajustada
              player.y + (player.height - drawHeight),    // Posição Y ajustada
              drawWidth,   // Largura (com squash/stretch)
              drawHeight   // Altura (com squash/stretch)
          );
      } else {
          // Fallback: se a imagem não carregar, desenha o quadrado branco para não quebrar o jogo
          ctx.fillStyle = 'white';
          ctx.fillRect(player.x + (player.width - drawWidth) / 2, player.y + (player.height - drawHeight), drawWidth, drawHeight);
      }

      // Partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
          particles.splice(i, 1);
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
          ctx.fillRect(p.x, p.y, 4, 4);
        }
      }

      // Obstáculos e Mapa
      for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (hasStarted && !isGameOver) obs.x -= gameSpeed;

        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        
        if(obs.isBrand) {
           ctx.fillStyle = 'white';
           ctx.font = '12px Arial';
           ctx.fillText('MARCA', obs.x + 5, obs.y + 20);
        }

        if (hasStarted && !isGameOver && checkCollision(player, obs)) {
          if (obs.isBrand) {
            if (player.velocity > 0 && player.y + player.height - player.velocity <= obs.y + 10) {
              player.y = obs.y - player.height;
              player.velocity = 0; 
            } else {
              triggerGameOver();
            }
          } else {
            playSound(coinSoundRef);
            obstacles.splice(i, 1);
            collectedPixels++;
            score += 20;
            setGameState(prev => ({ ...prev, pixels: collectedPixels }));
            continue; 
          }
        }

        if (obs.x + obs.width < 0) {
          obstacles.splice(i, 1);
          const isNewBrand = Math.random() > 0.6;
          const yPos = isNewBrand ? Math.random() * (canvas.height - 80) + 40 : Math.random() * (canvas.height - 40);
          
          obstacles.push({
            x: canvas.width + Math.random() * 200,
            y: yPos,
            width: isNewBrand ? 120 : 15,
            height: isNewBrand ? 20 : 15,
            color: isNewBrand ? '#ef4444' : '#8b5cf6',
            isBrand: isNewBrand
          });
        }
      }

      ctx.restore(); 

      if (!(isGameOver && shakeFrames <= 0)) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-start w-full max-w-4xl mx-auto pt-10 min-h-screen bg-black">
      
      {/* Abas de Navegação */}
      <div className="flex gap-4 mb-6 border-b border-gray-800 w-full px-4 pb-2">
         <button 
            onClick={() => setView('canvas')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${view === 'canvas' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}
         >
            Vista do Canvas
         </button>
         <button 
            onClick={() => setView('game')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${view === 'game' ? 'bg-gray-800 text-white border-b-2 border-green-500' : 'text-gray-500 hover:text-white'}`}
         >
            Vista do Jogo
         </button>
      </div>

      {/* Conteúdo da Aba: Vista do Canvas */}
      {view === 'canvas' && (
         <div className="w-full flex flex-col items-center animate-fade-in px-4">
            <h2 className="text-2xl text-white font-bold mb-4">Canvas de Territórios</h2>
            <div className="w-full h-[400px] bg-gray-900 border border-gray-700 rounded-lg flex items-center justify-center p-8 text-center">
               <p className="text-gray-400">
                  Aqui será implementada a grade estática de 1.000.000 de pixels. <br/>
                  Jogadores poderão clicar em espaços vazios para comprar e registrar suas marcas por $1.
               </p>
            </div>
         </div>
      )}

      {/* Conteúdo da Aba: Vista do Jogo */}
      <div className={`w-full flex flex-col items-center ${view === 'game' ? 'block' : 'hidden'}`}>
          <div className="mb-2 text-white text-xl font-bold flex justify-between w-full px-4">
            <span className="text-blue-400">High Score: {gameState.highScore}</span>
            <div className="flex gap-6">
                <span className="text-yellow-400">Pixels: {gameState.pixels}</span>
                <span className="text-green-400">Score: {Math.floor(gameState.score)}</span>
            </div>
          </div>
          
          <div className="relative w-full overflow-hidden flex justify-center">
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={400} 
                className="border border-gray-700 bg-gray-900 rounded-lg shadow-lg max-w-full" 
              />
              
              {/* Tela Inicial (Start Screen) */}
              {!gameState.hasStarted && !gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg z-10 w-[800px] max-w-full mx-auto backdrop-blur-sm">
                      <h2 className="text-white text-4xl font-extrabold mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">OLIV</h2>
                      <p className="text-gray-300 text-lg mb-8">Navegue pela tela e conquiste território.</p>
                      <p className="text-white bg-blue-600 px-6 py-3 rounded-full animate-pulse">
                        Pressione <kbd className="font-bold">ESPAÇO</kbd> para começar
                      </p>
                  </div>
              )}

              {/* Tela de Pause */}
              {gameState.isPaused && !gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg z-10 w-[800px] max-w-full mx-auto backdrop-blur-md">
                      <h2 className="text-white text-4xl font-extrabold mb-4 tracking-widest">PAUSADO</h2>
                      <p className="text-gray-300">Pressione <kbd className="font-bold text-yellow-400">P</kbd> ou <kbd className="font-bold text-yellow-400">ESC</kbd> para continuar</p>
                  </div>
              )}
              
              {/* Tela de Game Over */}
              {gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg z-10 w-[800px] max-w-full mx-auto backdrop-blur-sm">
                      <h2 className="text-red-500 text-5xl font-extrabold mb-4 tracking-widest">GAME OVER</h2>
                      <p className="text-gray-300 text-lg mb-2">Pixels Coletados: <span className="text-yellow-400 font-bold">{gameState.pixels}</span></p>
                      <p className="text-gray-300 text-lg mb-6">Score Final: <span className="text-green-400 font-bold">{Math.floor(gameState.score)}</span></p>
                      <p className="text-white bg-gray-800 px-6 py-3 rounded-full animate-pulse cursor-pointer">
                        Pressione <kbd className="font-bold text-yellow-400">ESPAÇO</kbd> para tentar novamente
                      </p>
                  </div>
              )}
          </div>
          
          <p className="mt-6 text-gray-400 text-sm flex gap-4">
            <span><kbd className="bg-gray-800 p-1 rounded font-mono">ESPAÇO</kbd> Pular / Iniciar</span>
            <span><kbd className="bg-gray-800 p-1 rounded font-mono">P</kbd> ou <kbd className="bg-gray-800 p-1 rounded font-mono">ESC</kbd> Pausar</span>
          </p>
      </div>
    </div>
  );
};

export default GameEngine;