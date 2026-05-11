'use client';
import React, { useRef, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // <-- NOVA LINHA

interface CustomBrand {
  id: number;
  name: string;
  color: string;
  pixelData: string[]; 
}

const GameEngine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref para o container pai
  const [view, setView] = useState<'game' | 'canvas'>('game');
  
  const [gameState, setGameState] = useState({ 
    hasStarted: false,
    gameOver: false, 
    isPaused: false,
    score: 0, 
    highScore: 0
  });

  const pixelsRef = useRef<number>(0);
  const [displayPixels, setDisplayPixels] = useState(0); 
  
  const purchasedBrandsRef = useRef<CustomBrand[]>([]);
  const [brandsUI, setBrandsUI] = useState<CustomBrand[]>([]);

  // --- CONFIGURAÇÕES DO ESTÚDIO ---
  const GRID_COLS = 24; // Largura expandida
  const GRID_ROWS = 8;  // Altura limitada
  const TOTAL_PIXELS = GRID_COLS * GRID_ROWS;

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [adType, setAdType] = useState<'obstacle' | 'parallax'>('obstacle');
  const freeDrawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isFreeDrawingRef = useRef(false);
  const parallaxImagesRef = useRef<Record<number, HTMLImageElement>>({}); // Guarda as imagens de fundo para não travar o jogo
  const [brandInputName, setBrandInputName] = useState('');
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [baseColor, setBaseColor] = useState('#3b82f6');
  const [pixelGrid, setPixelGrid] = useState<string[]>(Array(TOTAL_PIXELS).fill(''));
  const [isDrawing, setIsDrawing] = useState(false); 
  
  const jumpSoundRef = useRef<HTMLAudioElement | null>(null);
  const coinSoundRef = useRef<HTMLAudioElement | null>(null);
  const deathSoundRef = useRef<HTMLAudioElement | null>(null);
  const pauseSoundRef = useRef<HTMLAudioElement | null>(null);
  
  const oliveImageRef = useRef<HTMLImageElement | null>(null);
  const crownImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Pixels e Highscore continuam locais (o dinheiro ainda é seu)
    pixelsRef.current = parseInt(localStorage.getItem('pixelArenaPixels') || '0');
    setDisplayPixels(pixelsRef.current);

    // BUSCA DO SUPABASE (Função assíncrona)
    const fetchGlobalBrands = async () => {
      const { data, error } = await supabase.from('canvas_brands').select('*');
      if (data) {
        purchasedBrandsRef.current = data;
        setBrandsUI(data);
      }
    };
    fetchGlobalBrands(); // Chama a função assim que o jogo carrega
  }, []);

  const handleOpenStudio = (index: number) => {
    if (purchasedBrandsRef.current.find(b => b.id === index)) return; 
    
    if (pixelsRef.current < 50) {
      alert('Você precisa de 50 Pixels para registrar uma marca!');
      return;
    }

    setActiveCellIndex(index);
    setBrandInputName('');
    setPixelGrid(Array(TOTAL_PIXELS).fill(''));
    setBuyModalOpen(true);
  };

  const handleConfirmPurchase = async () => { // <-- Virou ASYNC
    if (!brandInputName.trim() || activeCellIndex === null) return;

    // --- NOVO: Define qual dado salvar (Grid de Obstáculo ou Imagem Base64 do Fundo) ---
    let finalPixelData = pixelGrid;
    if (adType === 'parallax' && freeDrawCanvasRef.current) {
        const base64Image = freeDrawCanvasRef.current.toDataURL('image/png');
        finalPixelData = [base64Image]; // Salva a imagem livre no banco!
    }
    // -----------------------------------------------------------------------------------

    const newBrand = {
      id: activeCellIndex,
      name: brandInputName.substring(0, 10).toUpperCase(),
      color: baseColor,
      pixel_data: finalPixelData // <-- Snake_case para o SQL (recebe o grid ou a imagem)
    };

    // TENTA SALVAR NO SUPABASE PRIMEIRO
    const { error } = await supabase.from('canvas_brands').insert([newBrand]);

    if (error) {
      alert("Erro ao salvar globalmente: " + error.message);
    } else {
      // SE DEU CERTO, aí sim desconta os pixels e atualiza a tela
      pixelsRef.current -= 50;
      localStorage.setItem('pixelArenaPixels', pixelsRef.current.toString());
      setDisplayPixels(pixelsRef.current);
      
      purchasedBrandsRef.current.push(newBrand as any);
      setBrandsUI([...purchasedBrandsRef.current]);
      
      // --- NOVO: Se for parallax, carrega na memória do jogo na mesma hora ---
      if (adType === 'parallax') {
          const img = new Image();
          img.src = finalPixelData[0];
          parallaxImagesRef.current[newBrand.id] = img;
      }
      // -----------------------------------------------------------------------
      
      setBuyModalOpen(false);
    }
  };

  const paintPixel = (index: number) => {
      const newGrid = [...pixelGrid];
      newGrid[index] = drawColor;
      setPixelGrid(newGrid);
  };

  // --- NOVO: Função para desenhar no Canvas Livre (Parallax) ---
  const drawFreehand = (e: any, isTouch = false) => {
      if (!isFreeDrawingRef.current || !freeDrawCanvasRef.current) return;
      const canvas = freeDrawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      let x = isTouch ? (e.touches[0].clientX - rect.left) * scaleX : (e.nativeEvent.offsetX) * scaleX;
      let y = isTouch ? (e.touches[0].clientY - rect.top) * scaleY : (e.nativeEvent.offsetY) * scaleY;
      
      // MÁGICA DO PIXEL ART: Calcula o "snap" (encaixe) na grade invisível de 10 em 10
      const pixelSize = 10; 
      const startX = Math.floor(x / pixelSize) * pixelSize;
      const startY = Math.floor(y / pixelSize) * pixelSize;

      ctx.fillStyle = drawColor === '' ? baseColor : drawColor; 
      
      // Em vez de um círculo, desenha um quadrado perfeito na posição calculada
      ctx.fillRect(startX, startY, pixelSize, pixelSize); 
      
      // Desenha uma borda bem suave para dar aquele charme de "bloco"
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.strokeRect(startX, startY, pixelSize, pixelSize);
  };

  // --- NOVO: Preenche o fundo do Canvas Livre ao abrir ou mudar a cor base ---
  useEffect(() => {
      if (adType === 'parallax' && freeDrawCanvasRef.current) {
          const ctx = freeDrawCanvasRef.current.getContext('2d');
          if (ctx && !isFreeDrawingRef.current) { 
              ctx.fillStyle = baseColor; 
              ctx.fillRect(0, 0, 300, 200); 
          }
      }
  }, [baseColor, adType]);
  // ---------------------------------------------------------------------------

  useEffect(() => {
    jumpSoundRef.current = new Audio('/sounds/pop.wav');
    coinSoundRef.current = new Audio('/sounds/coin.wav');
    deathSoundRef.current = new Audio('/sounds/death.wav');
    pauseSoundRef.current = new Audio('/sounds/pause.wav');

    const oliveImg = new Image();
    oliveImg.src = '/images/olive.png'; 
    oliveImageRef.current = oliveImg;

    const crownImg = new Image();
    crownImg.src = '/images/crown.png'; 
    crownImageRef.current = crownImg;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false; 
    
    let animationFrameId: number;

    const player = {
      x: 100, y: 150, width: 20, height: 20, 
      velocity: 0, gravity: 0.4, jumpStrength: -7
    };

    // --- LÓGICA DE CANVAS DINÂMICO ---
    const resizeCanvas = () => {
        if (container && canvas) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            
            // Impede que o jogador fique preso embaixo da tela ao redimensionar
            if (player.y + player.height > canvas.height) {
                player.y = canvas.height - player.height;
            }
        }
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Chama na primeira vez
    // ---------------------------------

    let obstacles: any[] = [];
    let particles: any[] = [];
    
    // Mais estrelas para cobrir monitores grandes
    let parallaxLayers = [
       { stars: Array.from({length: 60}).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 1.5 })), speed: 0.2, color: '#4b5563' },
       { stars: Array.from({length: 30}).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 2.5 })), speed: 0.5, color: '#9ca3af' }
    ];

    let hasStarted = false;
    let isGameOver = false;
    let isPaused = false;
    let score = 0;
    let shakeFrames = 0;
    let gameSpeed = 3;
    let hasBeatenHighScore = false;
    
    let currentHighScore = parseInt(localStorage.getItem('pixelArenaHighScore') || '0');
    setGameState(prev => ({ ...prev, highScore: currentHighScore }));

    const playSound = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
      if (audioRef.current) {
         audioRef.current.currentTime = 0;
         audioRef.current.play().catch(() => {});
      }
    };

    const triggerGameOver = () => {
      isGameOver = true;
      shakeFrames = 15;
      hasBeatenHighScore = false; 
      playSound(deathSoundRef);
      
      if (Math.floor(score) > currentHighScore) {
        currentHighScore = Math.floor(score);
        localStorage.setItem('pixelArenaHighScore', currentHighScore.toString());
      }
      
      setGameState(prev => ({ 
        ...prev, gameOver: true, score: Math.floor(score), highScore: currentHighScore
      }));
      setDisplayPixels(pixelsRef.current);
    };

    const handleAction = (e?: Event) => {
      if (e && e.cancelable) e.preventDefault(); 
      if (isPaused || view === 'canvas') return;

      if (!hasStarted) {
        hasStarted = true;
        setGameState(prev => ({ ...prev, hasStarted: true }));
        player.velocity = player.jumpStrength;
        playSound(jumpSoundRef);
      } else if (isGameOver) {
        player.y = Math.min(150, canvas.height / 2);
        player.velocity = 0;
        obstacles = [];
        particles = [];
        isGameOver = false;
        hasStarted = false;
        score = 0;
        shakeFrames = 0;
        gameSpeed = 3;
        hasBeatenHighScore = false;
        setGameState(prev => ({ ...prev, gameOver: false, hasStarted: false, score: 0 }));
        render(); 
      } else {
        player.velocity = player.jumpStrength;
        playSound(jumpSoundRef);
        for (let i = 0; i < 5; i++) {
          particles.push({
            x: player.x + player.width / 2, y: player.y + player.height,
            vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, life: 1.0
          });
        }
      }
    };

    const handleTogglePause = () => {
      if (hasStarted && !isGameOver && view === 'game') {
         isPaused = !isPaused;
         playSound(pauseSoundRef);
         setGameState(prev => ({ ...prev, isPaused }));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') { handleTogglePause(); return; }
      if (e.code === 'Space') { handleAction(e); }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    canvas.addEventListener('touchstart', handleAction, { passive: false });
    canvas.addEventListener('mousedown', handleAction, { passive: false });
    const externalPauseListener = () => handleTogglePause();
    window.addEventListener('toggleExternalPause', externalPauseListener);

    const checkCollision = (rect1: any, rect2: any) => {
      return (
        rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height && rect1.height + rect1.y > rect2.y
      );
    };

    const render = () => {
      if (isGameOver && shakeFrames <= 0) return;
      if (isPaused || view === 'canvas') {
         animationFrameId = window.requestAnimationFrame(render);
         return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (shakeFrames > 0) {
        ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
        shakeFrames--;
      }

      parallaxLayers.forEach(layer => {
         layer.stars.forEach(star => {
             if (hasStarted && !isGameOver) star.x -= gameSpeed * layer.speed;
             if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
             ctx.fillStyle = layer.color;
             ctx.fillRect(star.x, star.y, star.size, star.size);
         });
      });

      if (hasStarted && !isGameOver) {
        player.velocity += player.gravity;
        player.y += player.velocity;
        score += 0.05; 
        gameSpeed = 3 + (score / 150); 
        
        if (Math.floor(score) % 5 === 0) setGameState(prev => ({ ...prev, score: Math.floor(score) }));

        if (Math.floor(score) > currentHighScore && currentHighScore > 0 && !hasBeatenHighScore) {
            hasBeatenHighScore = true;
            for (let i = 0; i < 30; i++) {
                particles.push({
                    x: player.x + player.width / 2, y: player.y,
                    vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 1) * 7,    
                    life: 1.5, isGlitter: true                  
                });
            }
        }
      }

      if ((player.y + player.height >= canvas.height || player.y <= 0) && hasStarted) {
        if (!isGameOver) triggerGameOver();
      }

      let drawWidth = player.width;
      let drawHeight = player.height;
      if (hasStarted) {
          if (player.velocity < -2) { drawHeight += 6; drawWidth -= 4; } 
          else if (player.velocity > 3) { drawHeight += 6; drawWidth -= 4; } 
          else if (player.velocity > -1 && player.velocity < 1) { drawHeight -= 2; drawWidth += 2; } 
      }
      let renderY = player.y;
      if (!hasStarted && !isGameOver) {
          // Cria um movimento de sobe e desce suave com base no tempo
          renderY += Math.sin(Date.now() / 200) * 5; 
      }

      if (oliveImageRef.current && oliveImageRef.current.complete) {
          ctx.drawImage(
              oliveImageRef.current, 
              player.x + (player.width - drawWidth) / 2, player.y + (player.height - drawHeight),    
              drawWidth, drawHeight   
          );
      } else {
          ctx.fillStyle = 'white';
          ctx.fillRect(player.x + (player.width - drawWidth) / 2, player.y + (player.height - drawHeight), drawWidth, drawHeight);
      }

      if (hasBeatenHighScore && crownImageRef.current && crownImageRef.current.complete) {
          const totalFrames = 8; const cols = 3; const rows = 3; 
          const frameWidth = crownImageRef.current.width / cols;
          const frameHeight = crownImageRef.current.height / rows;
          const currentFrame = Math.floor(Date.now() / 120) % totalFrames;
          const sourceX = (currentFrame % cols) * frameWidth;
          const sourceY = Math.floor(currentFrame / cols) * frameHeight;
          const floatOffset = Math.sin(Date.now() / 200) * 5;
          const crownSize = 30; 
          
          ctx.drawImage(
              crownImageRef.current,
              sourceX, sourceY, frameWidth, frameHeight, 
              player.x + (player.width / 2) - (crownSize / 2), player.y - crownSize + floatOffset - 5, 
              crownSize, crownSize 
          );
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.fillStyle = p.isGlitter ? `rgba(255, 223, 0, ${p.life})` : `rgba(255, 255, 255, ${p.life})`; 
            ctx.fillRect(p.x, p.y, 4, 4);
        }
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (hasStarted && !isGameOver) obs.x -= gameSpeed;

        if (obs.isBrand && obs.pixelData) {
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            
            // Renderização Quadrada Perfeita Dinâmica
            const cols = obs.pixelData.length / GRID_ROWS; // Ex: 192 / 8 = 24 colunas
            const pSize = obs.height / GRID_ROWS; // Se height é 40, o pixel tem 5x5.
            
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < cols; col++) {
                    const pColor = obs.pixelData[row * cols + col];
                    if (pColor && pColor !== '') { 
                        ctx.fillStyle = pColor;
                        ctx.fillRect(obs.x + col * pSize, obs.y + row * pSize, pSize, pSize);
                    }
                }
            }
        } else {
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
        
        if(obs.isBrand) {
           ctx.fillStyle = 'white';
           ctx.font = '12px Arial';
           ctx.fillText(obs.name, obs.x + 5, obs.y - 5); 
        }

        if (hasStarted && !isGameOver && checkCollision(player, obs)) {
          if (obs.isBrand) {
            if (player.velocity > 0 && player.y + player.height - player.velocity <= obs.y + 10) {
              player.y = obs.y - player.height;
              player.velocity = 0; 
            } else triggerGameOver();
          } else {
            playSound(coinSoundRef);
            obstacles.splice(i, 1);
            pixelsRef.current += 1;
            localStorage.setItem('pixelArenaPixels', pixelsRef.current.toString());
            if (pixelsRef.current % 5 === 0) setDisplayPixels(pixelsRef.current);
            score += 20;
            continue; 
          }
        }

        if (obs.x + obs.width < 0) {
          obstacles.splice(i, 1);
        }
      }

      // Geração de mapa otimizada para o espaço dinâmico
      if (hasStarted && !isGameOver && (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 300)) {
         const isNewBrand = Math.random() > 0.6;
         let brandHeight = 40; // Altura limitada padrão
         let brandWidth = 120; // Largura padrão
         
         let brandData: any = { name: 'MARCA', color: '#ef4444', pixelData: null };
         
         if (isNewBrand && purchasedBrandsRef.current.length > 0 && Math.random() > 0.3) {
             const randomUserBrand = purchasedBrandsRef.current[Math.floor(Math.random() * purchasedBrandsRef.current.length)];
             brandData.name = randomUserBrand.name;
             brandData.color = randomUserBrand.color;
             brandData.pixelData = randomUserBrand.pixelData; 
             
             // Calcula a largura matematicamente para os pixels ficarem quadrados
             if (brandData.pixelData) {
                 const cols = brandData.pixelData.length / GRID_ROWS;
                 brandWidth = (brandHeight / GRID_ROWS) * cols; 
             }
         } else if (isNewBrand) {
             brandData.color = '#3b82f6'; 
         }

         const yPos = isNewBrand 
            ? Math.random() * (canvas.height - brandHeight - 40) + 40 
            : Math.random() * (canvas.height - 40);

         obstacles.push({
            x: canvas.width + Math.random() * 100,
            y: yPos,
            width: isNewBrand ? brandWidth : 15,
            height: isNewBrand ? brandHeight : 15,
            color: isNewBrand ? brandData.color : '#f59e0b',
            isBrand: isNewBrand,
            name: brandData.name,
            pixelData: brandData.pixelData 
         });
      }

      ctx.restore(); 

      if (!(isGameOver && shakeFrames <= 0)) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggleExternalPause', externalPauseListener);
      if (canvas) {
        canvas.removeEventListener('touchstart', handleAction);
        canvas.removeEventListener('mousedown', handleAction);
      }
    };
  }, [view]);

  return (
    // Transformamos o layout para ser Flex e crescer em toda a tela disponível
    <div className="flex flex-col w-full h-screen bg-black overflow-hidden pt-4 md:pt-6">
      
      <div className="flex gap-2 md:gap-4 mb-2 md:mb-4 border-b border-gray-800 w-full px-2 md:px-4 pb-2 justify-center shrink-0">
         <button 
            onClick={() => { setView('canvas'); setDisplayPixels(pixelsRef.current); }}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-t-lg transition-colors ${view === 'canvas' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}
         >
            Vista do Canvas
         </button>
         <button 
            onClick={() => setView('game')}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-t-lg transition-colors ${view === 'game' ? 'bg-gray-800 text-white border-b-2 border-green-500' : 'text-gray-500 hover:text-white'}`}
         >
            Vista do Jogo
         </button>
      </div>

      {view === 'canvas' && (
         <div className="w-full flex-1 flex flex-col items-center animate-fade-in px-4 pb-10 overflow-y-auto">
            <h2 className="text-xl md:text-2xl text-white font-bold mb-2">Canvas de Territórios</h2>
            <div className="flex justify-between w-full max-w-[600px] mb-4 bg-gray-900 p-4 rounded-lg border border-gray-700">
               <div>
                  <p className="text-gray-400 text-xs">Seus Pixels Coletados</p>
                  <p className="text-yellow-400 font-bold text-xl">{displayPixels}</p>
               </div>
               <div className="text-right">
                  <p className="text-gray-400 text-xs">Custo por Espaço</p>
                  <p className="text-blue-400 font-bold text-xl">50 Pixels</p>
               </div>
            </div>

            <div className="w-full max-w-[600px] grid grid-cols-10 gap-1 bg-gray-950 p-2 border border-gray-700 rounded-lg shadow-xl relative">
               {Array.from({ length: 50 }).map((_, i) => {
                  const brand = brandsUI.find(b => b.id === i);
                  return (
                     <div 
                        key={i}
                        onClick={() => handleOpenStudio(i)}
                        className={`aspect-square rounded-sm cursor-pointer transition-all ${brand ? 'scale-95 border border-black/20' : 'bg-gray-800 hover:bg-gray-700'}`}
                        style={brand ? { backgroundColor: brand.color } : {}}
                        title={brand ? `Marca: ${brand.name}` : 'Criar minha arte aqui (50 Px)'}
                     >
                        {brand && brand.pixelData && (
                            // Renderiza a miniatura baseada no formato de Outdoor
                            <div 
                                className="w-full h-full grid pointer-events-none opacity-90"
                                style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))` }}
                            >
                                {brand.pixelData.map((color, idx) => (
                                    <div key={idx} style={{ backgroundColor: color || 'transparent' }} />
                                ))}
                            </div>
                        )}
                     </div>
                  );
               })}
            </div>
            <p className="text-gray-500 text-xs mt-4 text-center">Clique em um espaço vazio para abrir o estúdio de Pixel Art!</p>
         </div>
      )}

      {buyModalOpen && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-xl flex flex-col gap-4">
                 <h2 className="text-white text-xl font-bold text-center">Central de Criação</h2>
                 
                 {/* --- NOVO: Escolha do Tipo de Anúncio --- */}
                 <div className="flex bg-gray-950 p-1 rounded-md border border-gray-700">
                     <button 
                        onClick={() => setAdType('obstacle')} 
                        className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${adType === 'obstacle' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                     >
                        Plataforma Física
                     </button>
                     <button 
                        onClick={() => setAdType('parallax')} 
                        className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${adType === 'parallax' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                     >
                        Arte de Fundo (Livre)
                     </button>
                 </div>
                 {/* ---------------------------------------- */}

                 <div className="flex flex-col gap-2">
                     <label className="text-gray-400 text-xs">Nome da Marca</label>
                     <input 
                        type="text" 
                        maxLength={10} 
                        value={brandInputName}
                        onChange={(e) => setBrandInputName(e.target.value)}
                        className="bg-gray-800 text-white p-2 rounded border border-gray-600 focus:border-blue-500 outline-none uppercase font-bold"
                        placeholder="EX: NIKE"
                     />
                 </div>

                 <div className="flex gap-4">
                     <div className="flex flex-col gap-2 w-1/2">
                         <label className="text-gray-400 text-xs">Cor de Fundo do Bloco</label>
                         <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                     </div>
                     <div className="flex flex-col gap-2 w-1/2">
                         <label className="text-gray-400 text-xs">Cor do Pincel</label>
                         <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                     </div>
                 </div>
                 
                 <div className="flex justify-between items-center bg-gray-800 p-2 rounded">
                    <div className="flex gap-2">
                        <button onClick={() => setDrawColor('#ffffff')} className="w-6 h-6 rounded-full bg-white border border-gray-500"></button>
                        <button onClick={() => setDrawColor('#000000')} className="w-6 h-6 rounded-full bg-black border border-gray-500"></button>
                        <button onClick={() => setDrawColor('#ef4444')} className="w-6 h-6 rounded-full bg-red-500 border border-gray-500"></button>
                        <button onClick={() => setDrawColor('#f59e0b')} className="w-6 h-6 rounded-full bg-yellow-500 border border-gray-500"></button>
                    </div>
                    <button onClick={() => setDrawColor('')} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white border border-gray-500">
                        Borracha
                    </button>
                 </div>

                 <div className="flex justify-center w-full overflow-hidden rounded bg-gray-900">
                     {/* --- NOVO: Renderização Condicional da Área de Desenho --- */}
                     {adType === 'obstacle' ? (
                         <div 
                            className="grid w-full min-w-[300px] h-[100px] border border-gray-600 cursor-crosshair touch-none shrink-0"
                            style={{ 
                               backgroundColor: baseColor,
                               gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                               gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`
                            }}
                            onMouseDown={() => setIsDrawing(true)}
                            onMouseUp={() => setIsDrawing(false)}
                            onMouseLeave={() => setIsDrawing(false)}
                            onTouchStart={() => setIsDrawing(true)}
                            onTouchEnd={() => setIsDrawing(false)}
                         >
                             {pixelGrid.map((color, index) => (
                                 <div 
                                    key={index}
                                    className="w-full h-full border border-black/10"
                                    style={{ backgroundColor: color || 'transparent' }}
                                    onMouseDown={() => paintPixel(index)}
                                    onMouseEnter={() => isDrawing && paintPixel(index)}
                                    onTouchMove={(e) => {
                                        const touch = e.touches[0];
                                        const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                        if (element && element.getAttribute('data-index')) {
                                            paintPixel(parseInt(element.getAttribute('data-index')!));
                                        }
                                    }}
                                    data-index={index}
                                 />
                             ))}
                         </div>
                     ) : (
                         <canvas 
                             ref={freeDrawCanvasRef} 
                             width={300} height={200} 
                             className="w-full h-[200px] cursor-crosshair touch-none object-contain border border-gray-600 shadow-inner"
                             onMouseDown={(e) => { isFreeDrawingRef.current = true; drawFreehand(e); }}
                             onMouseMove={(e) => drawFreehand(e)}
                             onMouseUp={() => isFreeDrawingRef.current = false}
                             onMouseLeave={() => isFreeDrawingRef.current = false}
                             onTouchStart={(e) => { isFreeDrawingRef.current = true; drawFreehand(e, true); }}
                             onTouchMove={(e) => drawFreehand(e, true)}
                             onTouchEnd={() => isFreeDrawingRef.current = false}
                         />
                     )}
                     {/* -------------------------------------------------------- */}
                 </div>
                 
                 <p className="text-gray-500 text-[10px] text-center mt-1">
                    {adType === 'obstacle' ? 'Arte em pixels 24x8. Vai virar um obstáculo físico no jogo.' : 'Arte em pixels 30x20. Vai flutuar no fundo do cenário (Parallax).'}
                 </p>

                 <div className="flex justify-between gap-4 mt-2">
                     <button onClick={() => setBuyModalOpen(false)} className="w-1/2 py-2 text-gray-300 hover:text-white border border-gray-600 rounded">Cancelar</button>
                     <button onClick={handleConfirmPurchase} className={`w-1/2 py-2 text-white font-bold rounded shadow-lg ${adType === 'parallax' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}>
                         Comprar (50 Px)
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* Vista do Jogo: Agora usa Flex-1 para preencher a tela */}
      <div className={`flex-1 w-full flex flex-col items-center relative ${view === 'game' ? 'flex' : 'hidden'}`}>
          <div className="mb-2 text-white text-sm md:text-xl font-bold flex justify-between items-center w-full px-4 md:px-8 shrink-0">
            <span className="text-blue-400 text-xs md:text-lg flex items-center gap-2">
               High Score: {gameState.highScore}
            </span>
            <div className="flex gap-3 md:gap-6 items-center">
                <span className="text-yellow-400">Px: {displayPixels}</span>
                <span className="text-green-400">Score: {Math.floor(gameState.score)}</span>
                <button 
                  onClick={() => window.dispatchEvent(new Event('toggleExternalPause'))}
                  className="bg-gray-800 hover:bg-gray-700 p-2 rounded-md text-white md:hidden shadow-lg border border-gray-600"
                >
                  {gameState.isPaused ? '▶️' : '⏸️'}
                </button>
            </div>
          </div>
          
          {/* Container do Canvas super fluido e responsivo */}
          <div ref={containerRef} className="flex-1 w-full relative overflow-hidden bg-[#0f172a]">
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 block touch-none select-none z-0" 
              />
              
              {/* --- CAMADA DE FILTRO CSS (Scanlines e Vinheta) --- */}
              <div 
                  className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
                  style={{
                      background: 'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.7) 100%)',
                  }}
              >
                  <div 
                      className="absolute inset-0 opacity-[0.15]" 
                      style={{
                          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.9) 50%, transparent 50%)',
                          backgroundSize: '100% 4px', 
                      }}
                  />
              </div>
              {/* -------------------------------------------------- */}

              {!gameState.hasStarted && !gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 backdrop-blur-sm pointer-events-none">
                      <h2 className="text-white text-4xl md:text-6xl font-extrabold mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 text-center">OLIV</h2>
                      <p className="text-gray-300 text-sm md:text-xl mb-8 text-center px-4">Navegue pelo canvas e conquiste território.</p>
                      <p className="text-white bg-blue-600 px-6 py-3 md:px-8 md:py-4 rounded-full animate-pulse font-bold">
                        TOQUE NA TELA para começar
                      </p>
                  </div>
              )}

              {gameState.isPaused && !gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-30 backdrop-blur-md pointer-events-none">
                      <h2 className="text-white text-4xl md:text-6xl font-extrabold mb-4 tracking-widest">PAUSADO</h2>
                      <p className="text-gray-300 md:text-xl">Toque no botão ⏸️ ou pressione <kbd className="font-bold text-yellow-400">P</kbd></p>
                  </div>
              )}
              
              {gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 backdrop-blur-sm pointer-events-none">
                      <h2 className="text-red-500 text-5xl md:text-7xl font-extrabold mb-4 tracking-widest">GAME OVER</h2>
                      <p className="text-gray-300 text-lg md:text-2xl mb-6">Score Final: <span className="text-green-400 font-bold">{Math.floor(gameState.score)}</span></p>
                      <p className="text-white bg-gray-800 px-6 py-3 md:px-8 md:py-4 rounded-full animate-pulse font-bold">
                        TOQUE NA TELA para tentar novamente
                      </p>
                  </div>
              )}
          </div>
          
          <p className="text-gray-400 text-xs md:text-sm flex flex-wrap justify-center gap-2 md:gap-4 p-2 md:p-4 text-center shrink-0">
            <span className="hidden md:inline"><kbd className="bg-gray-800 p-1 rounded font-mono">ESPAÇO</kbd> Pular / Iniciar</span>
            <span className="hidden md:inline"><kbd className="bg-gray-800 p-1 rounded font-mono">P</kbd> ou <kbd className="bg-gray-800 p-1 rounded font-mono">ESC</kbd> Pausar</span>
            <span className="md:hidden">Toque na tela do jogo para pular!</span>
          </p>
      </div>
    </div>
  );
};

export default GameEngine;