'use client';
import React, { useRef, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // <-- NOVA LINHA
import { GAME_CONSTANTS } from '../lib/game-engine/constants';
import { ParticlePool } from '../lib/game-engine/particlePool';
import { gameAudio } from '../lib/game-engine/audioManager';
import { RendererUtils } from '../lib/game-engine/rendererUtils';
import { PhysicsEngine } from '../lib/game-engine/physics';

interface CustomBrand {
  id: number;
  name: string;
  color: string;
  pixel_data: string[]; // <-- Atualizado para o banco de dados
  pixelData?: string[]; // <-- Deixamos como opcional para não quebrar nenhuma leitura antiga
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
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [adType, setAdType] = useState<'obstacle' | 'parallax'>('obstacle');

  // --- NOVO: Controles Dinâmicos de Tamanho ---
  const [adCols, setAdCols] = useState(24); // Largura
  const [adRows, setAdRows] = useState(8);  // Altura
  // -------------------------------------------

  const freeDrawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isFreeDrawingRef = useRef(false);
  const parallaxImagesRef = useRef<Record<number, HTMLImageElement>>({});

  const [brandInputName, setBrandInputName] = useState('');
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [baseColor, setBaseColor] = useState('#3b82f6');
  const [isTransparentBg, setIsTransparentBg] = useState(false);

  const [pixelGrid, setPixelGrid] = useState<string[]>(Array(24 * 8).fill(''));
  const [isDrawing, setIsDrawing] = useState(false);

  // --- NOVO: Efeitos para reajustar o tamanho ao mudar de tipo ---
  useEffect(() => {
    if (adType === 'obstacle') {
      setAdRows(8); // Resetamos para 8, mas deixamos o usuário mexer até 16
      setAdCols(24);
    } else {
      setAdRows(20);
      setAdCols(30);
    }
  }, [adType]);

  // Recria a grade ou limpa o canvas livre quando os tamanhos ou a cor mudam
  useEffect(() => {
    setPixelGrid(Array(adCols * adRows).fill(''));
    if (adType === 'parallax' && freeDrawCanvasRef.current) {
      const ctx = freeDrawCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, adCols * 10, adRows * 10);
        if (!isTransparentBg) {
          ctx.fillStyle = baseColor;
          ctx.fillRect(0, 0, adCols * 10, adRows * 10);
        }
      }
    }
  }, [adCols, adRows, adType, baseColor, isTransparentBg]);
  // ---------------------------------------------------------------



  const oliveImageRef = useRef<HTMLImageElement | null>(null);
  const crownImageRef = useRef<HTMLImageElement | null>(null);
  const coinImageRef = useRef<HTMLImageElement | null>(null);
  const magnetImageRef = useRef<HTMLImageElement | null>(null);

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
    if (pixelsRef.current < 64) { alert('Você precisa de pelo menos 64 Pixels para criar uma arte!'); return; }

    setActiveCellIndex(index);
    setBrandInputName('');
    setIsTransparentBg(false);
    setAdType('obstacle'); // Garante que volta pro tipo plataforma
    setAdCols(24);         // Reseta o slider de largura
    setAdRows(8);          // Reseta o slider de altura
    setPixelGrid(Array(24 * 8).fill('')); // <-- A CORREÇÃO (24x8 fixo para resetar a grade inicial)
    setBuyModalOpen(true);
  };

  const handleConfirmPurchase = async () => { // <-- Virou ASYNC
    if (!brandInputName.trim()) {
      alert("Por favor, digite um Nome para a sua Marca antes de comprar!");
      return;
    }
    if (activeCellIndex === null) return;

    const currentCost = adCols * adRows;
    if (pixelsRef.current < currentCost) {
      alert(`Você precisa de ${currentCost} Pixels para comprar esta marca!`);
      return;
    }

    // --- NOVO: Define qual dado salvar (Grid de Obstáculo ou Imagem Base64 do Fundo) ---
    let finalPixelData = [`META:${adCols}:${adRows}:0:0`, ...pixelGrid];
    if (adType === 'parallax' && freeDrawCanvasRef.current) {
      const base64Image = freeDrawCanvasRef.current.toDataURL('image/png');
      finalPixelData = [base64Image]; // Salva a imagem livre no banco!
    }
    // -----------------------------------------------------------------------------------

    const newBrand = {
      id: activeCellIndex,
      name: brandInputName.substring(0, 10).toUpperCase(),
      color: isTransparentBg ? 'transparent' : baseColor,
      pixel_data: finalPixelData // <-- Snake_case para o SQL (recebe o grid ou a imagem)
    };

    // TENTA SALVAR NO SUPABASE PRIMEIRO
    const { error } = await supabase.from('canvas_brands').insert([newBrand]);

    if (error) {
      alert("Erro ao salvar globalmente: " + error.message);
    } else {
      // SE DEU CERTO, aí sim desconta os pixels e atualiza a tela
      pixelsRef.current -= currentCost;
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

    if (drawColor === '') {
      ctx.clearRect(startX, startY, pixelSize, pixelSize);
      if (!isTransparentBg) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(startX, startY, pixelSize, pixelSize);
      }
    } else {
      ctx.fillStyle = drawColor;
      ctx.fillRect(startX, startY, pixelSize, pixelSize);
    }

    // Desenha uma borda bem suave para dar aquele charme de "bloco"
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.strokeRect(startX, startY, pixelSize, pixelSize);
  };

  // --- NOVO: Preenche o fundo do Canvas Livre ao abrir ou mudar a cor base ---
  useEffect(() => {
    if (adType === 'parallax' && freeDrawCanvasRef.current) {
      const ctx = freeDrawCanvasRef.current.getContext('2d');
      if (ctx && !isFreeDrawingRef.current) {
        ctx.clearRect(0, 0, 300, 200);
        if (!isTransparentBg) {
          ctx.fillStyle = baseColor;
          ctx.fillRect(0, 0, 300, 200);
        }
      }
    }
  }, [baseColor, adType, isTransparentBg]);
  // ---------------------------------------------------------------------------

  useEffect(() => {
    gameAudio.loadSound('jump', '/sounds/pop.wav');
    gameAudio.loadSound('coin', '/sounds/coin.wav');
    gameAudio.loadSound('death', '/sounds/death.wav');
    gameAudio.loadSound('pause', '/sounds/pause.wav');
    gameAudio.loadSound('break', '/sounds/break.wav');

    const oliveImg = new Image();
    oliveImg.src = '/images/olive.png';
    oliveImageRef.current = oliveImg;

    const crownImg = new Image();
    crownImg.src = '/images/crown.png';
    crownImageRef.current = crownImg;

    const coinImg = new Image();
    coinImg.src = '/images/coin.png';
    coinImageRef.current = coinImg;

    const magnetImg = new Image();
    magnetImg.src = '/images/ima.png';
    magnetImageRef.current = magnetImg;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let animationFrameId: number;

    const player = {
      x: GAME_CONSTANTS.PLAYER_START_X,
      y: GAME_CONSTANTS.PLAYER_START_Y,
      width: GAME_CONSTANTS.PLAYER_WIDTH,
      height: GAME_CONSTANTS.PLAYER_HEIGHT,
      velocity: 0,
      gravity: GAME_CONSTANTS.GRAVITY,
      jumpStrength: GAME_CONSTANTS.JUMP_STRENGTH
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
    const particlePool = new ParticlePool(200);
    let activeParallaxAds: any[] = [];

    // Mais estrelas para cobrir monitores grandes
    let parallaxLayers = [
      { stars: Array.from({ length: 60 }).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 1.5 })), speed: 0.2, color: '#4b5563' },
      { stars: Array.from({ length: 30 }).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 2.5 })), speed: 0.5, color: '#9ca3af' }
    ];

    let hasStarted = false;
    let isGameOver = false;
    let isPaused = false;
    let score = 0;
    let shakeFrames = 0;
    let gameSpeed = GAME_CONSTANTS.INITIAL_GAME_SPEED;
    let hasBeatenHighScore = false;
    let magnetActiveUntil = 0;
    let countdownUntil = 0;

    let currentHighScore = parseInt(localStorage.getItem('pixelArenaHighScore') || '0');
    setGameState(prev => ({ ...prev, highScore: currentHighScore }));



    const triggerGameOver = () => {
      isGameOver = true;
      shakeFrames = 15;
      hasBeatenHighScore = false;
      gameAudio.play('death');

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
        if (countdownUntil === 0) {
          countdownUntil = Date.now() + 3000;
          setGameState(prev => ({ ...prev, hasStarted: true }));
        }
      } else if (isGameOver) {
        player.y = Math.min(150, canvas.height / 2);
        player.velocity = 0;
        obstacles = [];
        particlePool.clear();
        activeParallaxAds = [];
        isGameOver = false;
        hasStarted = false;
        score = 0;
        shakeFrames = 0;
        gameSpeed = 3;
        hasBeatenHighScore = false;
        countdownUntil = Date.now() + 3000;
        setGameState(prev => ({ ...prev, gameOver: false, hasStarted: true, score: 0 }));
        render();
      } else {
        if (countdownUntil > Date.now()) return;
        player.velocity = player.jumpStrength;
        gameAudio.play('jump');
        for (let i = 0; i < 5; i++) {
          particlePool.spawn(
            player.x + player.width / 2, player.y + player.height,
            (Math.random() - 0.5) * 2, Math.random() * 2, 1.0, false
          );
        }
      }
    };

    const handleTogglePause = () => {
      if (hasStarted && !isGameOver && view === 'game') {
        if (isPaused) {
          isPaused = false;
          countdownUntil = Date.now() + 3000;
          gameAudio.play('pause');
          setGameState(prev => ({ ...prev, isPaused: false }));
        } else {
          isPaused = true;
          gameAudio.play('pause');
          setGameState(prev => ({ ...prev, isPaused: true }));
        }
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



    const render = () => {
      if (isGameOver && shakeFrames <= 0) return;
      if (isPaused || view === 'canvas') {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      let isCountingDown = false;
      let countdownSecs = 0;
      if (countdownUntil > Date.now()) {
        isCountingDown = true;
        countdownSecs = Math.ceil((countdownUntil - Date.now()) / 1000);
      } else if (countdownUntil > 0) {
        countdownUntil = 0;
        if (!hasStarted) {
          hasStarted = true;
          setGameState(prev => ({ ...prev, hasStarted: true }));
          player.velocity = player.jumpStrength;
          gameAudio.play('jump');
        }
      }

      const isPhysicsActive = hasStarted && !isGameOver && !isCountingDown;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (shakeFrames > 0) {
        ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
        shakeFrames--;
      }

      // 1. Renderiza o fundo de estrelas (Parallax Base)
      parallaxLayers.forEach(layer => {
        layer.stars.forEach(star => {
          if (isPhysicsActive) star.x -= gameSpeed * layer.speed;
          if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
          ctx.fillStyle = layer.color;
          ctx.fillRect(star.x, star.y, star.size, star.size);
        });
      });

      // 2. Lógica de Física e Geração de Artes de Fundo (Parallax Ads)
      if (isPhysicsActive) {
        player.velocity += player.gravity;
        player.y += player.velocity;
        score += 0.05;
        gameSpeed = 3 + (score / 150);

        if (Math.floor(score) % 5 === 0) setGameState(prev => ({ ...prev, score: Math.floor(score) }));

        // Partículas de Superação de High Score
        if (Math.floor(score) > currentHighScore && currentHighScore > 0 && !hasBeatenHighScore) {
          hasBeatenHighScore = true;
          for (let i = 0; i < 30; i++) {
            particlePool.spawn(
              player.x + player.width / 2, player.y,
              (Math.random() - 0.5) * 6, (Math.random() - 1) * 7,
              1.5, true
            );
          }
        }

        // --- NOVO: Gerador de Artes Livres no Fundo (1% de chance por frame) ---
        if (Math.random() < 0.01) {
          const adKeys = Object.keys(parallaxImagesRef.current);
          if (adKeys.length > 0) {
            const randomId = parseInt(adKeys[Math.floor(Math.random() * adKeys.length)]);
            const img = parallaxImagesRef.current[randomId];
            const sizeMulti = Math.random() * 1.5 + 0.3; // Cria tamanhos variados

            activeParallaxAds.push({
              x: canvas.width + 100,
              y: Math.random() * (canvas.height - (200 * sizeMulti)),
              width: 300 * sizeMulti,
              height: 200 * sizeMulti,
              speed: gameSpeed * (sizeMulti * 0.4), // Menor = mais lento (profundidade)
              alpha: 0.3 + (sizeMulti * 0.3),
              img: img
            });
          }
        }
        // ------------------------------------------------------------------------
      }

      // 3. Renderiza as Artes Livres (Parallax) ATRÁS dos obstáculos
      for (let i = activeParallaxAds.length - 1; i >= 0; i--) {
        let ad = activeParallaxAds[i];
        if (isPhysicsActive) ad.x -= ad.speed;

        if (ad.img && ad.img.complete) {
          ctx.globalAlpha = Math.min(ad.alpha, 1);
          ctx.drawImage(ad.img, ad.x, ad.y, ad.width, ad.height);
          ctx.globalAlpha = 1.0; // Restaura a opacidade para o resto do jogo
        }
        if (ad.x + ad.width < -100) activeParallaxAds.splice(i, 1);
      }

      // 4. Verificação de Morte por queda
      if ((player.y + player.height >= canvas.height || player.y <= 0) && hasStarted) {
        if (!isGameOver) triggerGameOver();
      }

      // 5. Renderização da Azeitona (Jogador)
      let drawWidth = player.width;
      let drawHeight = player.height;
      if (hasStarted) {
        if (player.velocity < -2) { drawHeight += 6; drawWidth -= 4; }
        else if (player.velocity > 3) { drawHeight += 6; drawWidth -= 4; }
        else if (player.velocity > -1 && player.velocity < 1) { drawHeight -= 2; drawWidth += 2; }
      }
      let renderY = player.y;
      if (!hasStarted && !isGameOver) {
        renderY += Math.sin(Date.now() / 200) * 5;
      }

      if (oliveImageRef.current && oliveImageRef.current.complete) {
        ctx.drawImage(
          oliveImageRef.current,
          player.x + (player.width - drawWidth) / 2, renderY + (player.height - drawHeight),
          drawWidth, drawHeight
        );
      } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(player.x + (player.width - drawWidth) / 2, renderY + (player.height - drawHeight), drawWidth, drawHeight);
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
          player.x + (player.width / 2) - (crownSize / 2), renderY - crownSize + floatOffset - 5,
          crownSize, crownSize
        );
      }

      // 6. Renderização de Partículas
      // 6. Atualização e Renderização das Partículas
      particlePool.updateAndDraw(ctx);

      // 7. Renderização dos Obstáculos Físicos
      for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (isPhysicsActive) {
          if (!obs.isBrand && !obs.isTrampoline && Date.now() < magnetActiveUntil) {
            const dx = (player.x + player.width / 2) - (obs.x + obs.width / 2);
            const dy = (renderY + player.height / 2) - (obs.y + obs.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 400) {
              obs.x += (dx / dist) * 12;
              obs.y += (dy / dist) * 12;
            } else {
              obs.x -= gameSpeed;
            }
          } else {
            obs.x -= gameSpeed;
          }
        }

        // --- NOVO: Renderiza apenas plataformas físicas (exclui artes base64 de parallax) ---
        if (obs.isBrand && obs.pixel_data && obs.pixel_data.length > 1) {
          if (obs.isBreaking) {
            if (Date.now() > obs.breakTimer) {
              gameAudio.play('break');
              for (let j = 0; j < 30; j++) {
                particlePool.spawn(
                  obs.x + Math.random() * obs.width,
                  obs.y + Math.random() * obs.height,
                  (Math.random() - 0.5) * 8,
                  (Math.random() - 0.5) * 8,
                  1.0,
                  false
                );
              }
              obstacles.splice(i, 1);
              continue;
            }
          }

          if (obs.color !== 'transparent') {
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          }

          let rows = 8;
          let cols = obs.pixel_data.length / 8;
          let pixels = obs.pixel_data;

          if (pixels[0] && pixels[0].startsWith('META:')) {
            const parts = pixels[0].split(':');
            cols = parseInt(parts[1]);
            rows = parseInt(parts[2]);
            pixels = pixels.slice(1);
          }

          // Renderização Quadrada Perfeita Dinâmica
          const pSize = obs.height / rows; // Altura dividida pelas linhas lógicas

          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const pColor = pixels[row * cols + col];
              if (pColor && pColor !== '') {
                ctx.fillStyle = pColor;
                ctx.fillRect(obs.x + col * pSize, obs.y + row * pSize, pSize, pSize);
              }
            }
          }

          if (obs.isBreaking && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          }
        } else {
          if (obs.isTrampoline) {
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 15;
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#059669';
            ctx.fillRect(obs.x, obs.y + 4, obs.width, 2);
            ctx.shadowBlur = 0;
          } else {
            const imgRef = obs.isMagnet ? magnetImageRef : coinImageRef;
            if (imgRef.current && imgRef.current.complete) {
              let sourceX = 0, sourceY = 0, sourceSizeX = 0, sourceSizeY = 0;
              let destX = obs.x - 5;
              let destY = obs.y - 5;
              let destW = obs.width + 10;
              let destH = obs.height + 10;

              if (obs.isMagnet) {
                const totalFrames = 24;
                const currentFrame = Math.floor(Date.now() / 60) % totalFrames;
                const cols = 8;
                const rows = 3;
                const col = currentFrame % cols;
                const row = Math.floor(currentFrame / cols);

                const rawWidth = imgRef.current.width / cols;
                const rawHeight = imgRef.current.height / rows;

                sourceSizeX = Math.floor(rawWidth);
                sourceSizeY = Math.floor(rawHeight);
                sourceX = Math.floor(col * rawWidth);
                sourceY = Math.floor(row * rawHeight);

                ctx.shadowColor = '#3b82f6';
                ctx.shadowBlur = 15;

                // Aumentando o tamanho do íma na tela (apenas visual, a hitbox continua a mesma)
                destW = 45; // de 30 para 45
                destH = destW * (sourceSizeY / sourceSizeX); // Mantém a proporção real da arte
                destX = obs.x + (obs.width / 2) - (destW / 2);
                destY = obs.y + (obs.height / 2) - (destH / 2);

              } else {
                const totalFrames = 8;
                const currentFrame = Math.floor(Date.now() / 100) % totalFrames;
                const col = currentFrame % 4;
                const row = Math.floor(currentFrame / 4);
                const centersX = [366, 665, 941, 1217];
                const centersY = [333, 722];
                const size = 250;
                sourceX = centersX[col] - (size / 2);
                sourceY = centersY[row] - (size / 2);
                sourceSizeX = size;
                sourceSizeY = size;

                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = 15;
              }

              ctx.drawImage(
                imgRef.current,
                sourceX, sourceY, sourceSizeX, sourceSizeY,
                destX, destY, destW, destH
              );

              ctx.shadowBlur = 0;
            } else {
              if (obs.color !== 'transparent') {
                ctx.fillStyle = obs.color;
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
              }
            }
          }
        }

        if (obs.isBrand) {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(obs.name, obs.x + 5, obs.y - 5);
        }

        // Colisão
        if (isPhysicsActive && PhysicsEngine.checkCollision({ x: player.x, y: renderY, width: player.width, height: player.height }, obs)) {
          if (obs.isBrand) {
            if (player.velocity > 0 && player.y + player.height - player.velocity <= obs.y + 10) {
              player.y = obs.y - player.height;
              player.velocity = 0;

              if (obs.isBouncy) {
                player.velocity = player.jumpStrength * 2.0;
                gameAudio.play('jump');
              }

              if (obs.isBreakable && !obs.isBreaking) {
                obs.isBreaking = true;
                obs.breakTimer = Date.now() + 500;
              }
            } else {
              if (!obs.isBouncy) {
                triggerGameOver();
              }
            }
          } else if (obs.isTrampoline) {
            if (player.velocity > 0 && player.y + player.height - player.velocity <= obs.y + 10) {
              player.y = obs.y - player.height;
              player.velocity = player.jumpStrength * 2.0;
              gameAudio.play('jump');
            }
          } else {
            gameAudio.play('coin');
            obstacles.splice(i, 1);

            for (let j = 0; j < 10; j++) {
              particlePool.spawn(
                obs.x + obs.width / 2, obs.y + obs.height / 2,
                (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6,
                1.0, true
              );
            }

            if (obs.isMagnet) {
              magnetActiveUntil = Date.now() + 10000;
            } else {
              pixelsRef.current += 1;
              localStorage.setItem('pixelArenaPixels', pixelsRef.current.toString());
              if (pixelsRef.current % 5 === 0) setDisplayPixels(pixelsRef.current);
              score += 20;
            }
            continue;
          }
        }

        if (obs.x + obs.width < 0) {
          obstacles.splice(i, 1);
        }
      }

      // 8. Geração de novos obstáculos dinâmicos
      if (isPhysicsActive && (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 300)) {
        const isBrand = Math.random() > 0.6;

        // Filtra só as marcas que SÃO plataformas físicas (array de pixels com mais de 1 elemento)
        const obstacleBrands = purchasedBrandsRef.current.filter(b => b.pixel_data && b.pixel_data.length > 1);
        const brand = isBrand && obstacleBrands.length > 0 ? obstacleBrands[Math.floor(Math.random() * obstacleBrands.length)] : null;

        let rows = 8;
        let cols = brand?.pixel_data ? brand.pixel_data.length / 8 : 24;
        let isBreakable = false;
        let isBouncy = false;
        if (brand?.pixel_data && brand.pixel_data[0] && brand.pixel_data[0].startsWith('META:')) {
          const parts = brand.pixel_data[0].split(':');
          cols = parseInt(parts[1]);
          rows = parseInt(parts[2]);

          isBreakable = Math.random() < 0.15;
          isBouncy = !isBreakable && Math.random() < 0.15;
        }

        const brandHeight = brand ? rows * 5 : 40;
        const brandWidth = brand ? (brandHeight / rows) * cols : 20;

        const yPos = brand
          ? Math.random() * (canvas.height - brandHeight - 40) + 40
          : Math.random() * (canvas.height - 40);

        obstacles.push({
          x: canvas.width + 100,
          y: yPos,
          width: brandWidth,
          height: brand ? brandHeight : 20,
          color: brand ? brand.color : '#f59e0b',
          isBrand: !!brand,
          name: brand?.name || 'MOEDA',
          pixel_data: brand?.pixel_data,
          isMagnet: !brand && Math.random() < 0.1, // 10% chance
          isBreakable: isBreakable,
          isBouncy: isBouncy
        });

        if (brand && Math.random() < 0.15) {
          obstacles.push({
            x: canvas.width + 100 + Math.random() * (brandWidth - 20),
            y: yPos - 10,
            width: 20,
            height: 10,
            color: '#10b981',
            isBrand: false,
            isTrampoline: true,
            name: 'TRAMPOLIM'
          });
        }
      }

      if (isCountingDown) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(countdownSecs.toString(), canvas.width / 2, canvas.height / 2);
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
              <p className="text-blue-400 font-bold text-xl">1 Px / bloco</p>
            </div>
          </div>

          <div className="w-full max-w-[600px] grid grid-cols-10 gap-1 bg-gray-950 p-2 border border-gray-700 rounded-lg shadow-xl relative">
            {Array.from({ length: 50 }).map((_, i) => {
              const brand = brandsUI.find(b => b.id === i);
              const data = brand?.pixel_data || brand?.pixelData;
              const isParallax = data?.length === 1; // Verifica se é arte livre

              return (
                <div
                  key={i}
                  onClick={() => handleOpenStudio(i)}
                  className={`aspect-square rounded-sm cursor-pointer transition-all flex items-center justify-center overflow-hidden ${brand ? 'scale-95 border border-black/20' : 'bg-gray-800 hover:bg-gray-700'}`}
                  style={brand ? { backgroundColor: brand.color === 'transparent' ? '#1f2937' : brand.color } : {}}
                  title={brand ? `Marca: ${brand.name}` : 'Criar minha arte aqui'}
                >
                  {brand && data && !isParallax && (() => {
                    let rows = 8;
                    let cols = data.length / 8;
                    let pixels = data;
                    if (data[0] && data[0].startsWith('META:')) {
                      const parts = data[0].split(':');
                      cols = parseInt(parts[1]);
                      rows = parseInt(parts[2]);
                      pixels = data.slice(1);
                    }
                    return (
                      <div
                        className="w-full h-full grid pointer-events-none opacity-90"
                        style={{
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                        }}
                      >
                        {pixels.map((color, idx) => (
                          <div key={idx} style={{ backgroundColor: color || 'transparent' }} />
                        ))}
                      </div>
                    )
                  })()}
                  {brand && data && isParallax && (
                    // Renderiza a miniatura da imagem livre
                    <img src={data[0]} alt="Arte" className="w-full h-full object-cover opacity-90" />
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
                <div className="flex justify-between items-center">
                  <label className="text-gray-400 text-xs">Cor de Fundo</label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={isTransparentBg} onChange={(e) => setIsTransparentBg(e.target.checked)} className="accent-blue-500" />
                    <span className="text-[10px] text-gray-400">Transp.</span>
                  </label>
                </div>
                {!isTransparentBg ? (
                  <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                ) : (
                  <div className="w-full h-10 rounded border border-gray-600 bg-[#1f2937] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzNzQxNTEiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzc0MTUxIi8+PC9zdmc+")' }} />
                  </div>
                )}
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

            {/* --- Controles de Tamanho e Prévia --- */}
            <div className="flex flex-col md:flex-row gap-4 bg-gray-950 p-3 rounded border border-gray-700">
              {/* Sliders */}
              <div className="flex flex-col gap-4 w-full md:w-1/2 justify-center">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Largura (Pixels)</span>
                    <span className="font-bold text-white">{adCols}px</span>
                  </div>
                  <input type="range" min="8" max="64" value={adCols} onChange={(e) => setAdCols(parseInt(e.target.value))} className="w-full accent-blue-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Altura (Pixels)</span>
                    <span className="font-bold text-white">{adRows}px</span>
                  </div>
                  <input type="range" min="8" max={adType === 'obstacle' ? 16 : 40} value={adRows} onChange={(e) => setAdRows(parseInt(e.target.value))} className={`w-full ${adType === 'obstacle' ? 'accent-blue-500' : 'accent-purple-500'}`} />
                </div>
              </div>

              {/* Mini Janela de Prévia */}
              <div className="w-full md:w-1/2 flex flex-col items-center">
                <span className="text-[10px] text-gray-500 mb-1">PRÉVIA NO CENÁRIO</span>
                <div className="w-full max-w-[200px] aspect-[2/1] bg-slate-900 border border-gray-600 rounded relative overflow-hidden shadow-inner">
                  <div className="absolute left-[15%] bottom-[30%] w-[4%] h-[8%] bg-white rounded-sm opacity-80" />
                  <div
                    className={`absolute border border-white/50 transition-all duration-200 ${adType === 'parallax' ? 'bg-purple-500/50' : 'bg-blue-500/80'}`}
                    style={{
                      width: adType === 'obstacle' ? `${(adCols * 5) / 8}%` : `${(adCols * 10) / 8}%`,
                      height: adType === 'obstacle' ? `10%` : `${(adRows * 10) / 4}%`,
                      right: '20%',
                      top: adType === 'obstacle' ? '40%' : '20%',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center w-full overflow-hidden rounded bg-gray-900 my-2 border border-gray-700">
              {adType === 'obstacle' ? (
                <div
                  className="grid w-full h-[120px] cursor-crosshair touch-none shrink-0"
                  style={{
                    backgroundColor: isTransparentBg ? '#1f2937' : baseColor,
                    backgroundImage: isTransparentBg ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzNzQxNTEiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzc0MTUxIi8+PC9zdmc+")' : 'none',
                    gridTemplateColumns: `repeat(${adCols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${adRows}, minmax(0, 1fr))`
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
                  width={adCols * 10} height={adRows * 10}
                  className="w-full max-h-[200px] cursor-crosshair touch-none object-contain shadow-inner"
                  style={{
                    backgroundColor: isTransparentBg ? '#1f2937' : 'black',
                    backgroundImage: isTransparentBg ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzNzQxNTEiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzc0MTUxIi8+PC9zdmc+")' : 'none',
                  }}
                  onMouseDown={(e) => { isFreeDrawingRef.current = true; drawFreehand(e); }}
                  onMouseMove={(e) => drawFreehand(e)}
                  onMouseUp={() => isFreeDrawingRef.current = false}
                  onMouseLeave={() => isFreeDrawingRef.current = false}
                  onTouchStart={(e) => { isFreeDrawingRef.current = true; drawFreehand(e, true); }}
                  onTouchMove={(e) => drawFreehand(e, true)}
                  onTouchEnd={() => isFreeDrawingRef.current = false}
                />
              )}
            </div>

            <p className="text-gray-500 text-[10px] text-center mt-1">
              {adType === 'obstacle' ? 'Arte em pixels. Vai virar um obstáculo físico no jogo.' : 'Arte em pixels. Vai flutuar no fundo do cenário (Parallax).'}
            </p>

            <div className="flex justify-between gap-4 mt-2">
              <button onClick={() => setBuyModalOpen(false)} className="w-1/2 py-2 text-gray-300 hover:text-white border border-gray-600 rounded">Cancelar</button>
              <button onClick={handleConfirmPurchase} className={`w-1/2 py-2 text-white font-bold rounded shadow-lg ${adType === 'parallax' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}>
                Comprar ({adCols * adRows} Px)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vista do Jogo */}
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

        <style>{`
          @keyframes vhs-flicker {
            0% { opacity: 0.98; }
            5% { opacity: 0.90; }
            10% { opacity: 0.98; }
            15% { opacity: 1; }
            100% { opacity: 1; }
          }
          @keyframes vhs-glitch {
            0% { transform: translate(0); filter: hue-rotate(0deg); }
            1% { transform: translate(-4px, 1px); filter: hue-rotate(90deg); }
            2% { transform: translate(4px, -1px); filter: hue-rotate(-90deg); }
            3% { transform: translate(0); filter: hue-rotate(0deg); }
            49% { transform: translate(0); }
            50% { transform: translate(1px, 2px) skewX(1deg); }
            51% { transform: translate(0); }
            98% { transform: translate(0); }
            99% { transform: translate(-2px, -2px) skewX(-1deg); }
            100% { transform: translate(0); }
          }
          @keyframes scanline-scroll {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100vh); }
          }
          .crt-container {
            animation: vhs-flicker 0.15s infinite;
            border-radius: 25px;
            box-shadow: inset 0 0 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,1);
            transform: perspective(600px) rotateX(1deg);
          }
          @media (min-width: 768px) {
            .crt-container { border-radius: 50px; }
          }
          .crt-glitch-layer {
            animation: vhs-glitch 5s infinite;
            width: 100%;
            height: 100%;
          }
          .crt-scanlines {
            background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.35));
            background-size: 100% 4px;
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 21;
          }
          .crt-moving-line {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 30px;
            background: rgba(255,255,255,0.03);
            pointer-events: none;
            z-index: 22;
            animation: scanline-scroll 8s linear infinite;
          }
          .crt-vignette {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 23;
            background: radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.85) 90%, rgba(0,0,0,1) 100%);
          }
          .crt-aberration {
            filter: contrast(1.25) saturate(1.3) brightness(1.1) sepia(0.15) hue-rotate(-5deg);
          }
        `}</style>

        <div className="flex-1 w-full p-2 md:p-6 flex flex-col relative bg-black items-center justify-center">
          <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#0f172a] crt-container shadow-[0_0_50px_rgba(59,130,246,0.15)] border-2 border-gray-900">
            <div className="crt-glitch-layer absolute inset-0">
              <canvas
                ref={canvasRef}
                className="absolute inset-0 block touch-none select-none z-0 crt-aberration"
              />
            </div>

            <div className="crt-scanlines" />
            <div className="crt-moving-line" />
            <div className="crt-vignette" />

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