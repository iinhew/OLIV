'use client';
import React, { useRef, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // <-- NOVA LINHA
import { GAME_CONSTANTS } from '../lib/game-engine/constants';
import { ParticlePool } from '../lib/game-engine/particlePool';
import { gameAudio } from '../lib/game-engine/audioManager';
import { RendererUtils } from '../lib/game-engine/rendererUtils';
import { PhysicsEngine } from '../lib/game-engine/physics';
import { generateRandomGuestName } from '../lib/game-engine/nameGenerator';

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
  const [view, setView] = useState<'game' | 'canvas' | 'brecho'>('game');

  // --- NOVO: Guest & Auth Session ---
  const [showGuestModal, setShowGuestModal] = useState(true);
  const [authMode, setAuthMode] = useState<'guest' | 'login' | 'signup'>('login');
  const [guestInputName, setGuestInputName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkMode, setLinkMode] = useState<'login' | 'signup'>('signup');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkUsername, setLinkUsername] = useState('');
  const guestUserRef = useRef<{ id: string, username: string } | null>(null);
  const [guestUser, setGuestUser] = useState<{ id: string, username: string } | null>(null);

  // --- NOVO: Ranking Global ---
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [rankingData, setRankingData] = useState<{ username: string, high_score: number }[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);

  // --- NOVO: Easter Egg Konami / Modo Neo ---
  const [neoMode, setNeoMode] = useState(false);
  const neoModeRef = useRef(false);
  const neoExtraLifeRef = useRef(0);
  const bulletTimeRef = useRef(0);
  const konamiSequenceRef = useRef<string[]>([]);
  const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  const oliveNeoImageRef = useRef<HTMLImageElement | null>(null);
  const [vazioTapCount, setVazioTapCount] = useState(0);
  const [dpadUnlocked, setDpadUnlocked] = useState(false);
  const vazioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ----------------------------------------

  // --- NOVO: Loja de Skins ---
  const SKINS = [
    { id: 'olive', name: 'Azeitona', img: '/images/olive.png', price: 0, trailColor: 'rgba(120, 200, 80, ALPHA)', owned: true, emoji: '🪴', description: 'A clássica azeitona verde.' },
    { id: 'olive_rainbow', name: 'Arco-Íris', img: '/images/skin_olive_rainbow.png', price: 500, trailColor: 'rainbow', owned: false, emoji: '🌈', description: 'Uma azeitona com brilho prismatico!' },
    { id: 'pear', name: 'Pera', img: '/images/skin_pear.png', price: 300, trailColor: 'rgba(190, 220, 60, ALPHA)', owned: false, emoji: '🍐', description: 'Doce e suculenta.' },
    { id: 'orange', name: 'Laranja', img: '/images/skin_orange.png', price: 400, trailColor: 'rgba(255, 160, 40, ALPHA)', owned: false, emoji: '🍊', description: 'Vitamina C em forma de heroi.' },
    { id: 'pepper', name: 'Pimenta', img: '/images/skin_pepper.png', price: 600, trailColor: 'rgba(255, 60, 30, ALPHA)', owned: false, emoji: '🌶️', description: 'Quente demais pra morrer!' },
  ];
  const [showSkinShop, setShowSkinShop] = useState(false);
  const [activeSkinId, setActiveSkinId] = useState('olive');
  const activeSkinRef = useRef('olive');
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['olive']);
  const skinImagesRef = useRef<Record<string, HTMLImageElement>>({});
  // ---------------------------

  const handleOpenRanking = async () => {
    setShowRankingModal(true);
    setLoadingRanking(true);
    const { data, error } = await supabase.from('players').select('username, high_score').order('high_score', { ascending: false }).limit(50);
    if (data) setRankingData(data);
    setLoadingRanking(false);
  };
  // -----------------------------

  const [gameState, setGameState] = useState({
    hasStarted: false,
    gameOver: false,
    isPaused: false,
    score: 0,
    highScore: 0
  });

  const pixelsRef = useRef<number>(0);
  const [displayPixels, setDisplayPixels] = useState(0);

  const [isMutedSFX, setIsMutedSFX] = useState(false);
  const [isMutedMusic, setIsMutedMusic] = useState(false);

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

  // --- Konami Code listener (ativo na vista do canvas) ---
  useEffect(() => {
    const handleKonami = (e: KeyboardEvent) => {
      if (view !== 'canvas') return;
      const seq = konamiSequenceRef.current;
      seq.push(e.code);
      if (seq.length > KONAMI_CODE.length) seq.shift();
      if (seq.length === KONAMI_CODE.length && seq.every((k, i) => k === KONAMI_CODE[i])) {
        konamiSequenceRef.current = [];
        const next = !neoModeRef.current;
        neoModeRef.current = next;
        setNeoMode(next);
        if (next) neoExtraLifeRef.current = 1;
      }
    };
    window.addEventListener('keydown', handleKonami);
    return () => window.removeEventListener('keydown', handleKonami);
  }, [view]);
  // -------------------------------------------------------

  useEffect(() => {
    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { data: player } = await supabase.from('players').select('*').eq('auth_id', session.user.id).single();
        if (player) {
          guestUserRef.current = player;
          setGuestUser(player);
          pixelsRef.current = player.pixels;
          localStorage.setItem('pixelArenaHighScore', player.high_score.toString());
          localStorage.setItem('pixelArenaPixels', player.pixels.toString());
          setShowGuestModal(false);
          setGameState(prev => ({ ...prev, highScore: player.high_score }));
          return;
        }
      }

      const savedId = localStorage.getItem('olivGuestId');
      if (savedId) {
        const { data } = await supabase.from('players').select('*').eq('id', savedId).single();
        if (data && !data.auth_id) {
          guestUserRef.current = data;
          setGuestUser(data);
          pixelsRef.current = data.pixels;
          localStorage.setItem('pixelArenaHighScore', data.high_score.toString());
          localStorage.setItem('pixelArenaPixels', data.pixels.toString());
          setShowGuestModal(false);
          setGameState(prev => ({ ...prev, highScore: data.high_score }));
        } else {
          localStorage.removeItem('olivGuestId');
          setGuestInputName(generateRandomGuestName());
        }
      } else {
        setGuestInputName(generateRandomGuestName());
      }

      pixelsRef.current = pixelsRef.current || parseInt(localStorage.getItem('pixelArenaPixels') || '0');
      setDisplayPixels(pixelsRef.current);
    };

    initializeSession();

    // BUSCA DO SUPABASE (Função assíncrona)
    const fetchGlobalBrands = async () => {
      const { data, error } = await supabase.from('canvas_brands').select('*');
      if (data) {
        purchasedBrandsRef.current = data;
        setBrandsUI(data);

        // --- CARREGA IMAGENS DE PARALLAX PARA A MEMÓRIA ---
        data.forEach(brand => {
          const pixels = brand.pixel_data || brand.pixelData;
          if (pixels && pixels.length > 0) {
            const firstElement = pixels[0];
            if (!firstElement.startsWith('META:')) {
              const img = new Image();
              img.src = firstElement;
              parallaxImagesRef.current[brand.id] = img;
            }
          }
        });
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
      if (guestUserRef.current) {
        supabase.from('players').update({ pixels: pixelsRef.current }).eq('id', guestUserRef.current.id).then();
      }

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

  // --- NOVO: Upload e Pixelização de Imagem ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = adCols;
        offCanvas.height = adRows;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;

        // Desenha a imagem reduzida para a grade exata (força a pixelização)
        offCtx.drawImage(img, 0, 0, adCols, adRows);
        const imgData = offCtx.getImageData(0, 0, adCols, adRows).data;

        if (adType === 'obstacle') {
          const newGrid = Array(adCols * adRows).fill('');
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a > 128) {
              newGrid[i / 4] = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            }
          }
          setPixelGrid(newGrid);
        } else {
          if (freeDrawCanvasRef.current) {
            const ctx = freeDrawCanvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, adCols * 10, adRows * 10);
              if (!isTransparentBg) {
                ctx.fillStyle = baseColor;
                ctx.fillRect(0, 0, adCols * 10, adRows * 10);
              }

              for (let r = 0; r < adRows; r++) {
                for (let c = 0; c < adCols; c++) {
                  const idx = (r * adCols + c) * 4;
                  if (imgData[idx + 3] > 128) {
                    ctx.fillStyle = `rgb(${imgData[idx]},${imgData[idx + 1]},${imgData[idx + 2]})`;
                    ctx.fillRect(c * 10, r * 10, 10, 10);
                  }
                }
              }
            }
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  // ---------------------------------------------

  // --- NOVO: Função para desenhar no Canvas Livre (Parallax) ---
  const drawFreehand = (e: any, isTouch = false) => {
    if (!isFreeDrawingRef.current || !freeDrawCanvasRef.current) return;
    const canvas = freeDrawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    // --- CORREÇÃO DE DISTORÇÃO (Object-Fit e Touch) ---
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasAspect > rectAspect) {
      renderHeight = rect.width / canvasAspect;
      offsetY = (rect.height - renderHeight) / 2;
    } else {
      renderWidth = rect.height * canvasAspect;
      offsetX = (rect.width - renderWidth) / 2;
    }

    const scaleX = canvas.width / renderWidth;
    const scaleY = canvas.height / renderHeight;

    let x = (clientX - rect.left - offsetX) * scaleX;
    let y = (clientY - rect.top - offsetY) * scaleY;

    // Se estiver clicando fora da área real da imagem desenhada (nas margens do object-fit), ignora
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
    // ----------------------------------------------------

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

  const handleToggleSFX = () => {
    gameAudio.toggleMuteSFX();
    setIsMutedSFX(gameAudio.isMutedSFX);
  };

  const handleToggleMusic = () => {
    gameAudio.toggleMuteMusic();
    setIsMutedMusic(gameAudio.isMutedMusic);
  };

  useEffect(() => {
    gameAudio.loadMusic('bgm', '/sounds/bgm.mp3');
    gameAudio.loadSound('jump', '/sounds/pop.wav');
    gameAudio.loadSound('jump_trampoline', '/sounds/jump.wav');
    gameAudio.loadSound('coin', '/sounds/coin.wav');
    gameAudio.loadSound('death', '/sounds/death.wav');
    gameAudio.loadSound('pause', '/sounds/pause.wav');
    gameAudio.loadSound('break', '/sounds/break.wav');
    gameAudio.loadSound('magnet', '/sounds/ima.wav');

    const oliveImg = new Image();
    oliveImg.src = '/images/olive.png';
    oliveImageRef.current = oliveImg;

    const oliveNeoImg = new Image();
    oliveNeoImg.src = '/images/olive_neo.png';
    oliveNeoImageRef.current = oliveNeoImg;

    const crownImg = new Image();
    crownImg.src = '/images/crown.png';
    crownImageRef.current = crownImg;

    const coinImg = new Image();
    coinImg.src = '/images/coin.png';
    coinImageRef.current = coinImg;

    const magnetImg = new Image();
    magnetImg.src = '/images/ima.png';
    magnetImageRef.current = magnetImg;

    // Pré-carrega TODAS as imagens de skins
    SKINS.forEach(skin => {
      const img = new Image();
      img.src = skin.img;
      skinImagesRef.current[skin.id] = img;
    });

    // Restaura skins do localStorage
    const savedOwned = localStorage.getItem('olivOwnedSkins');
    if (savedOwned) {
      try { const parsed = JSON.parse(savedOwned); setOwnedSkins(parsed); } catch { }
    }
    const savedActive = localStorage.getItem('olivActiveSkin');
    if (savedActive) {
      setActiveSkinId(savedActive);
      activeSkinRef.current = savedActive;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let animationFrameId: number;
    let lastFrameTime = performance.now();
    const TARGET_FPS = 60;
    const TARGET_FRAME_MS = 1000 / TARGET_FPS; // 16.667ms

    const player = {
      x: GAME_CONSTANTS.PLAYER_START_X,
      y: GAME_CONSTANTS.PLAYER_START_Y,
      width: GAME_CONSTANTS.PLAYER_WIDTH,
      height: GAME_CONSTANTS.PLAYER_HEIGHT,
      velocity: 0,
      gravity: GAME_CONSTANTS.GRAVITY,
      jumpStrength: GAME_CONSTANTS.JUMP_STRENGTH,
      rocketTimer: 0
    };

    // --- LÓGICA DE CANVAS DINÂMICO ---
    const resizeCanvas = () => {
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Ajuste dinâmico da posição X do jogador para Mobile vs Desktop
        player.x = Math.min(GAME_CONSTANTS.PLAYER_START_X, canvas.width * 0.25);

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
    const isMobile = canvas.width < 768;
    const particlePool = new ParticlePool(isMobile ? 80 : 200);
    let activeParallaxAds: any[] = [];

    // Menos estrelas no mobile para melhor performance
    const starCount = isMobile ? 20 : 60;
    let parallaxLayers = [
      { stars: Array.from({ length: starCount }).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 1.5 })), speed: 0.2, color: '#4b5563' },
      { stars: Array.from({ length: Math.floor(starCount * 0.5) }).map(() => ({ x: Math.random() * 2000, y: Math.random() * 1500, size: 2.5 })), speed: 0.5, color: '#9ca3af' },
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
    let lastParallaxAdId = -1; // Anti-duplicata: rastreia última arte de fundo
    let lastBrandId = -1;      // Anti-duplicata: rastreia última plataforma

    // --- NEO MODE: Matrix rain drops ---
    const matrixChars = '01ABCDEFNEOMATRIX';
    let matrixDrops: { x: number, y: number, speed: number, char: string, alpha: number }[] = [];
    const initMatrixDrops = (w: number, h: number) => {
      const dropCount = isMobile ? 20 : 60;
      matrixDrops = Array.from({ length: dropCount }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        speed: 1 + Math.random() * 3,
        char: matrixChars[Math.floor(Math.random() * matrixChars.length)],
        alpha: 0.2 + Math.random() * 0.6
      }));
    };
    initMatrixDrops(canvas.width, canvas.height);
    // ------------------------------------

    let currentHighScore = parseInt(localStorage.getItem('pixelArenaHighScore') || '0');
    setGameState(prev => ({ ...prev, highScore: currentHighScore }));



    const triggerGameOver = () => {
      // --- HACK DE INVENCIBILIDADE (via Console) ---
      if (typeof window !== 'undefined' && (window as any).isInvincible) {
        if (player.y + player.height >= canvas.height || player.y <= 0) {
          player.y = canvas.height / 2;
          player.velocity = 0;
        }
        return;
      }
      // ----------------------------------------------

      // --- NEO EXTRA LIFE (protege de QUALQUER morte) ---
      if (neoModeRef.current && neoExtraLifeRef.current > 0) {
        neoExtraLifeRef.current = 0;
        // Reseta posição e limpa obstáculos, mantém o score
        player.y = Math.min(150, canvas.height / 2);
        player.velocity = 0;
        obstacles = [];
        activeParallaxAds = [];
        countdownUntil = Date.now() + 3000;
        // Partículas verdes de feedback
        for (let j = 0; j < 20; j++) {
          particlePool.spawn(
            player.x + player.width / 2, player.y + player.height / 2,
            (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
            1.5, false, 'rgba(0, 255, 70, ALPHA)'
          );
        }
        return; // Não morre!
      }
      // --------------------------------------------------

      isGameOver = true;
      shakeFrames = 15;
      hasBeatenHighScore = false;
      gameAudio.play('death');

      if (Math.floor(score) > currentHighScore) {
        currentHighScore = Math.floor(score);
        localStorage.setItem('pixelArenaHighScore', currentHighScore.toString());
        // Sincroniza Highscore no Cloud
        if (guestUserRef.current) {
          supabase.from('players').update({ high_score: currentHighScore }).eq('id', guestUserRef.current.id).then();
        }
      }

      setGameState(prev => ({
        ...prev, gameOver: true, score: Math.floor(score), highScore: currentHighScore
      }));
      setDisplayPixels(pixelsRef.current);
    };

    const handleAction = (e?: Event) => {
      if (e && e.cancelable) e.preventDefault();
      if (isPaused || view === 'canvas' || view === 'brecho') return;

      if (!hasStarted) {
        if (countdownUntil === 0) {
          gameAudio.playMusic('bgm');
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
        // Garante que o render loop reinicie mesmo se estava parado
        window.cancelAnimationFrame(animationFrameId);
        lastFrameTime = performance.now();
        render();
      } else {
        if (countdownUntil > Date.now()) return;
        player.velocity = player.jumpStrength;
        gameAudio.play('jump');
        // Trail colorido baseado na skin ativa
        const skinDef = SKINS.find(s => s.id === activeSkinRef.current);
        const trailColor = skinDef?.trailColor || 'rgba(120, 200, 80, ALPHA)';
        for (let i = 0; i < 5; i++) {
          if (trailColor === 'rainbow') {
            const hue = (Date.now() / 5 + i * 40) % 360;
            particlePool.spawn(
              player.x + player.width / 2, player.y + player.height,
              (Math.random() - 0.5) * 2, Math.random() * 2, 1.0, false,
              `hsla(${hue}, 100%, 60%, ALPHA)`
            );
          } else {
            particlePool.spawn(
              player.x + player.width / 2, player.y + player.height,
              (Math.random() - 0.5) * 2, Math.random() * 2, 1.0, false,
              trailColor
            );
          }
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



    const render = (timestamp?: number) => {
      if (isGameOver && shakeFrames <= 0) return;
      if (isPaused || view === 'canvas' || view === 'brecho') {
        lastFrameTime = timestamp || performance.now();
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      // --- Delta Time ---
      const now = timestamp || performance.now();
      const rawDt = (now - lastFrameTime) / TARGET_FRAME_MS;
      const dt = Math.min(rawDt, 3); // Limita a 3x para evitar saltos em tab-switch
      lastFrameTime = now;
      // ------------------

      // --- BULLET TIME (Neo extra-life) ---
      if (bulletTimeRef.current > 0) {
        bulletTimeRef.current -= dt;
        animationFrameId = window.requestAnimationFrame(render);
        if (bulletTimeRef.current > 0 && Math.floor(bulletTimeRef.current) % 3 !== 0) return;
      }
      // ------------------------------------

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
        shakeFrames -= dt;
      }

      // 1. Fundo: modo Matrix (Neo) ou estrelas normais
      if (neoModeRef.current) {
        // Fundo verde escuro sólido
        ctx.fillStyle = '#020d02';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Camada de brilho sutil
        ctx.fillStyle = 'rgba(0, 40, 10, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 14px monospace';
        matrixDrops.forEach(drop => {
          if (isPhysicsActive || isGameOver) {
            drop.y += drop.speed * 0.5 * dt;
            drop.x -= (isPhysicsActive ? gameSpeed : 3) * 0.4 * dt;
            if (drop.y > canvas.height) {
              drop.y = -14;
              drop.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
            }
            if (drop.x < -14) {
              drop.x = canvas.width + Math.random() * 100;
              drop.y = Math.random() * canvas.height;
              drop.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
            }
          }
          ctx.fillStyle = `rgba(0, 255, 70, ${drop.alpha})`;
          ctx.fillText(drop.char, drop.x, drop.y);
        });
      } else {
        parallaxLayers.forEach(layer => {
          layer.stars.forEach(star => {
            if (isPhysicsActive) star.x -= gameSpeed * layer.speed * dt;
            if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
            ctx.fillStyle = layer.color;
            ctx.fillRect(star.x, star.y, star.size, star.size);
          });
        });
      }

      // 2. Lógica de Física e Geração de Artes de Fundo (Parallax Ads)
      if (isPhysicsActive) {
        player.velocity += player.gravity * dt;
        player.y += player.velocity * dt;
        score += 0.05 * dt;
        gameSpeed = 3 + (score / 150);

        if (player.rocketTimer > 0) {
          player.rocketTimer -= dt;
          particlePool.spawn(
            player.x + player.width / 2 + (Math.random() - 0.5) * 10,
            player.y + player.height,
            (Math.random() - 0.5) * 2,
            Math.random() * 2 + 2,
            1.0,
            false,
            'rgba(200, 200, 200, ALPHA)'
          );
          if (Math.random() < 0.3) {
            particlePool.spawn(
              player.x + player.width / 2,
              player.y + player.height,
              (Math.random() - 0.5) * 2,
              Math.random() * 2 + 2,
              0.5,
              false,
              'rgba(255, 100, 0, ALPHA)'
            );
          }
        }

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

        // --- NOVO: Gerador de Artes Livres no Fundo ---
        // Aumenta a chance se a tela estiver vazia para aparecer rápido ao iniciar
        let spawnChance = activeParallaxAds.length === 0 ? 0.05 : 0.005; // 0.5% padrão

        if (Math.random() < spawnChance) {
          const adKeys = Object.keys(parallaxImagesRef.current);
          if (adKeys.length > 0) {
            // Evita repetir a mesma arte consecutivamente
            let randomIdx = Math.floor(Math.random() * adKeys.length);
            if (adKeys.length > 1 && parseInt(adKeys[randomIdx]) === lastParallaxAdId) {
              randomIdx = (randomIdx + 1) % adKeys.length;
            }
            const randomId = parseInt(adKeys[randomIdx]);
            lastParallaxAdId = randomId;
            const img = parallaxImagesRef.current[randomId];

            // Variabilidade de tamanho entre 40% e 80% do tamanho real desenhado
            const sizeMulti = Math.random() * 0.4 + 0.4;

            // Respeita a proporção e o tamanho original da imagem (img.width/height)
            const drawWidth = (img.width || 300) * sizeMulti;
            const drawHeight = (img.height || 200) * sizeMulti;

            // Se for a primeira arte na tela, nasce colada na borda para não ter delay
            let startX = canvas.width + 100 + (Math.random() * 400);
            if (activeParallaxAds.length === 0) {
              startX = canvas.width;
            }

            activeParallaxAds.push({
              x: startX,
              y: Math.random() * (canvas.height - drawHeight),
              width: drawWidth,
              height: drawHeight,
              speed: gameSpeed * (sizeMulti * 0.3), // Menor = mais lento (profundidade)
              alpha: 0.15 + (sizeMulti * 0.4), // Mais suave para não poluir
              img: img
            });
          }
        }
        // ------------------------------------------------------------------------
      }

      // 3. Renderiza as Artes Livres (Parallax) ATRÁS dos obstáculos
      for (let i = activeParallaxAds.length - 1; i >= 0; i--) {
        let ad = activeParallaxAds[i];
        if (isPhysicsActive) ad.x -= ad.speed * dt;

        if (ad.img && ad.img.complete) {
          ctx.globalAlpha = Math.min(ad.alpha, 1);
          ctx.drawImage(ad.img, ad.x, ad.y, ad.width, ad.height);
          ctx.globalAlpha = 1.0; // Restaura a opacidade para o resto do jogo
        }
        if (ad.x + ad.width < -100) activeParallaxAds.splice(i, 1);
      }

      // 4. Verificação de Morte por queda/teto
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

      // Escolhe imagem: neo mode = olive_neo, skin ativa, ou olive padrão
      let activeOliveImg: HTMLImageElement | null;
      if (neoModeRef.current) {
        activeOliveImg = oliveNeoImageRef.current;
      } else {
        activeOliveImg = skinImagesRef.current[activeSkinRef.current] || oliveImageRef.current;
      }

      if (activeOliveImg && activeOliveImg.complete) {
        // Tint verde em modo matrix
        if (neoModeRef.current) {
          ctx.save();
          if (!isMobile) ctx.filter = 'hue-rotate(80deg) saturate(3) brightness(1.2)';
        }
        // Efeito arco-íris na skin rainbow (simplificado no mobile)
        if (!neoModeRef.current && activeSkinRef.current === 'olive_rainbow') {
          ctx.save();
          if (!isMobile) {
            const hue = (Date.now() / 10) % 360;
            ctx.filter = `hue-rotate(${hue}deg) saturate(1.5) brightness(1.1)`;
          }
        }
        ctx.drawImage(
          activeOliveImg,
          player.x + (player.width - drawWidth) / 2, renderY + (player.height - drawHeight),
          drawWidth, drawHeight
        );
        if (neoModeRef.current || activeSkinRef.current === 'olive_rainbow') ctx.restore();
      } else {
        ctx.fillStyle = neoModeRef.current ? '#00ff46' : 'white';
        ctx.fillRect(player.x + (player.width - drawWidth) / 2, renderY + (player.height - drawHeight), drawWidth, drawHeight);
      }

      // Indicador de vida extra Neo
      if (neoModeRef.current && neoExtraLifeRef.current > 0) {
        ctx.fillStyle = 'rgba(0,255,70,0.9)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('[NEO SHIELD]', player.x - 8, renderY - 8);
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
      particlePool.updateAndDraw(ctx, dt);

      // 7. Renderização dos Obstáculos Físicos
      for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (isPhysicsActive) {
          if (!obs.isBrand && !obs.isTrampoline && Date.now() < magnetActiveUntil) {
            const dx = (player.x + player.width / 2) - (obs.x + obs.width / 2);
            const dy = (renderY + player.height / 2) - (obs.y + obs.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 400) {
              obs.x += (dx / dist) * 12 * dt;
              obs.y += (dy / dist) * 12 * dt;
            } else {
              obs.x -= gameSpeed * dt;
            }
          } else {
            obs.x -= gameSpeed * dt;
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

          let rows = 8;
          let cols = obs.pixel_data.length / 8;
          let pixels = obs.pixel_data;

          if (pixels[0] && pixels[0].startsWith('META:')) {
            const parts = pixels[0].split(':');
            cols = parseInt(parts[1]);
            rows = parseInt(parts[2]);
            pixels = pixels.slice(1);
          }

          // Usa o sistema de cache de Offscreen Canvas para evitar milhares de fillRect por frame
          const cachedCanvas = RendererUtils.getOrRenderPixelGrid(
            pixels,
            cols,
            rows,
            obs.color,
            obs.color === 'transparent',
            obs.width,
            obs.height
          );

          if (cachedCanvas) {
            ctx.drawImage(cachedCanvas, obs.x, obs.y);
          } else {
            // Fallback caso o cache falhe
            if (obs.color !== 'transparent') {
              ctx.fillStyle = obs.color;
              ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            }
          }

          if (obs.isBreaking && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          }
        } else {
          // Apenas renderiza itens que não são baseados em grade
          if (!obs.isBrand) {
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

                // Removed shadowBlur for mobile performance

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

                // Removed shadowBlur for mobile performance
              }

              ctx.drawImage(
                imgRef.current,
                sourceX, sourceY, sourceSizeX, sourceSizeY,
                destX, destY, destW, destH
              );

              // Removed shadowBlur for mobile performance
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
                gameAudio.play('jump_trampoline');
                player.rocketTimer = 30;
              }

              if (obs.isBreakable && !obs.isBreaking) {
                obs.isBreaking = true;
                obs.breakTimer = Date.now() + 500;
              }
            } else {
              if (!obs.isBouncy) {
                // --- NEO EXTRA LIFE: reseta posição, mantém score ---
                if (neoModeRef.current && neoExtraLifeRef.current > 0) {
                  neoExtraLifeRef.current = 0;
                  player.y = Math.min(150, canvas.height / 2);
                  player.velocity = 0;
                  obstacles = [];
                  activeParallaxAds = [];
                  countdownUntil = Date.now() + 3000;
                  for (let j = 0; j < 20; j++) {
                    particlePool.spawn(
                      player.x + player.width / 2, player.y + player.height / 2,
                      (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
                      1.5, false, 'rgba(0, 255, 70, ALPHA)'
                    );
                  }
                } else {
                  triggerGameOver();
                }
                // -----------------------------------------------
              }
            }
          } else {
            obstacles.splice(i, 1);

            for (let j = 0; j < 10; j++) {
              particlePool.spawn(
                obs.x + obs.width / 2, obs.y + obs.height / 2,
                (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6,
                1.0, true
              );
            }

            if (obs.isMagnet) {
              gameAudio.play('magnet');
              magnetActiveUntil = Date.now() + 10000;
            } else {
              gameAudio.play('coin');
              pixelsRef.current += 1;
              localStorage.setItem('pixelArenaPixels', pixelsRef.current.toString());
              if (pixelsRef.current % 5 === 0) {
                setDisplayPixels(pixelsRef.current);
                // Sincroniza Pixels no Cloud
                if (guestUserRef.current) {
                  supabase.from('players').update({ pixels: pixelsRef.current }).eq('id', guestUserRef.current.id).then();
                }
              }
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
      if (isPhysicsActive && (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 250)) {
        const isBrand = Math.random() > 0.45; // 55% chance de plataforma (antes era 40%)

        // Filtra só as marcas que SÃO plataformas físicas (array de pixels com mais de 1 elemento)
        const obstacleBrands = purchasedBrandsRef.current.filter(b => b.pixel_data && b.pixel_data.length > 1);
        // Round-robin: evita repetir a mesma plataforma consecutivamente
        let brand: typeof obstacleBrands[0] | null = null;
        if (isBrand && obstacleBrands.length > 0) {
          if (obstacleBrands.length === 1) {
            brand = obstacleBrands[0];
          } else {
            // Pega uma diferente da última
            let idx = Math.floor(Math.random() * obstacleBrands.length);
            if (obstacleBrands[idx].id === lastBrandId) {
              idx = (idx + 1) % obstacleBrands.length;
            }
            brand = obstacleBrands[idx];
            lastBrandId = brand.id;
          }
        }

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

  const handleCreateGuest = async () => {
    const finalName = guestInputName.trim() || generateRandomGuestName();
    const { data, error } = await supabase.from('players').insert([{ username: finalName, pixels: pixelsRef.current, high_score: gameState.highScore }]).select('*').single();
    if (data) {
      localStorage.setItem('olivGuestId', data.id);
      guestUserRef.current = data;
      setGuestUser(data);
      setShowGuestModal(false);
    } else {
      alert("Erro ao conectar com servidor. Tente novamente.");
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) return alert("Preencha email e senha");
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
      setAuthLoading(false);
      return;
    }
    if (data.user) {
      const savedId = localStorage.getItem('olivGuestId');
      if (savedId) {
        // Vincula a conta existente ao auth
        const usernameToUse = signUpUsername.trim() || email.split('@')[0].substring(0, 15).toUpperCase();
        await supabase.from('players').update({ auth_id: data.user.id, username: usernameToUse }).eq('id', savedId);
        const { data: player } = await supabase.from('players').select('*').eq('id', savedId).single();
        if (player) {
          guestUserRef.current = player;
          setGuestUser(player);
        }
      } else {
        const finalName = signUpUsername.trim() || email.split('@')[0].substring(0, 15).toUpperCase();
        const { data: player } = await supabase.from('players').insert([{ username: finalName, pixels: pixelsRef.current, high_score: gameState.highScore, auth_id: data.user.id }]).select('*').single();
        if (player) {
          guestUserRef.current = player;
          setGuestUser(player);
        }
      }
      setShowGuestModal(false);
    }
    setAuthLoading(false);
  };

  const handleLinkAccount = async () => {
    if (!linkEmail || !linkPassword) return alert('Preencha email e senha');
    setAuthLoading(true);
    const savedId = guestUserRef.current?.id;

    if (linkMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email: linkEmail, password: linkPassword });
      if (error) { alert(error.message); setAuthLoading(false); return; }
      if (data.user && savedId) {
        const usernameToUse = linkUsername.trim() || linkEmail.split('@')[0].substring(0, 15).toUpperCase();
        await supabase.from('players').update({ auth_id: data.user.id, username: usernameToUse }).eq('id', savedId);
        const { data: player } = await supabase.from('players').select('*').eq('id', savedId).single();
        if (player) { guestUserRef.current = player; setGuestUser(player); }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: linkEmail, password: linkPassword });
      if (error) { alert(error.message); setAuthLoading(false); return; }
      if (data.user) {
        const { data: existingPlayer } = await supabase.from('players').select('*').eq('auth_id', data.user.id).single();
        if (existingPlayer) {
          // Já tem uma conta, merge: mantém o maior highscore e soma pixels
          const mergedHighScore = Math.max(existingPlayer.high_score, gameState.highScore);
          const mergedPixels = existingPlayer.pixels + (pixelsRef.current || 0);
          await supabase.from('players').update({ high_score: mergedHighScore, pixels: mergedPixels }).eq('id', existingPlayer.id);
          // Deleta o perfil de convidado se existir
          if (savedId) await supabase.from('players').delete().eq('id', savedId);
          localStorage.removeItem('olivGuestId');
          guestUserRef.current = { ...existingPlayer, high_score: mergedHighScore, pixels: mergedPixels };
          setGuestUser(guestUserRef.current as any);
          pixelsRef.current = mergedPixels;
          setDisplayPixels(mergedPixels);
          setGameState(prev => ({ ...prev, highScore: mergedHighScore }));
        } else if (savedId) {
          await supabase.from('players').update({ auth_id: data.user.id }).eq('id', savedId);
          const { data: player } = await supabase.from('players').select('*').eq('id', savedId).single();
          if (player) { guestUserRef.current = player; setGuestUser(player); }
        }
      }
    }

    setAuthLoading(false);
    setShowLinkModal(false);
  };

  const handleSignIn = async () => {
    if (!email || !password) return alert("Preencha email e senha");
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Erro ao logar: " + error.message);
      setAuthLoading(false);
      return;
    }
    if (data.user) {
      const { data: player } = await supabase.from('players').select('*').eq('auth_id', data.user.id).single();
      if (player) {
        guestUserRef.current = player;
        setGuestUser(player);
        pixelsRef.current = player.pixels;
        setDisplayPixels(player.pixels);
        setGameState(prev => ({ ...prev, highScore: player.high_score }));
        localStorage.setItem('pixelArenaHighScore', player.high_score.toString());
        localStorage.setItem('pixelArenaPixels', player.pixels.toString());
        setShowGuestModal(false);
      } else {
        alert("Usuário logado mas sem perfil encontrado. Tente criar conta.");
      }
    }
    setAuthLoading(false);
  };

  return (
    // Transformamos o layout para ser Flex e crescer em toda a tela disponível
    <div className="flex flex-col w-full h-screen bg-black overflow-hidden pt-4 md:pt-6 relative">

      {/* Modal de Convidado */}
      {showGuestModal && (
        <div className="absolute inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-xl shadow-[0_0_50px_rgba(59,130,246,0.3)] w-full max-w-sm flex flex-col items-center animate-fade-in">
            <img src="/images/olive.png" alt="OLIV" className="w-20 h-20 mb-4 animate-bounce" style={{ imageRendering: 'pixelated' }} />
            <h1 className="text-3xl font-black text-white tracking-widest mb-1 uppercase">OLIV</h1>
            <p className="text-gray-400 text-sm text-center mb-6">Entre no mundo invertido</p>

            {/* Abas de Autenticação */}
            <div className="flex w-full bg-gray-950 p-1 rounded-md border border-gray-700 mb-6">
              <button onClick={() => setAuthMode('login')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${authMode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Login</button>
              <button onClick={() => setAuthMode('signup')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${authMode === 'signup' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>Criar Conta</button>
              <button onClick={() => setAuthMode('guest')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${authMode === 'guest' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Convidado</button>
            </div>

            {authMode === 'guest' ? (
              <div className="w-full flex flex-col gap-2 mb-6 animate-fade-in">
                <label className="text-gray-400 text-xs font-bold uppercase">Nome de convidado</label>
                <div className="relative">
                  <input
                    type="text" maxLength={15} value={guestInputName} onChange={(e) => setGuestInputName(e.target.value)}
                    className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none font-bold"
                    placeholder="Seu Nome..."
                  />
                  <button onClick={() => setGuestInputName(generateRandomGuestName())} className="absolute right-2 top-1/2 -translate-y-1/2 text-xl hover:scale-110">🎲</button>
                </div>
                <button onClick={handleCreateGuest} className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all active:scale-95">
                  Jogar como Convidado
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3 mb-6 animate-fade-in">
                {authMode === 'signup' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-400 text-xs font-bold uppercase">Nome de Usuário</label>
                    <input type="text" maxLength={15} value={signUpUsername} onChange={(e) => setSignUpUsername(e.target.value.toUpperCase())} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none font-bold" placeholder="SEU_NICK" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-gray-400 text-xs font-bold uppercase">E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" placeholder="seu@email.com" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-gray-400 text-xs font-bold uppercase">Senha</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" placeholder="••••••••" />
                </div>

                {authMode === 'login' ? (
                  <button onClick={handleSignIn} disabled={authLoading} className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all active:scale-95">
                    {authLoading ? 'Carregando...' : 'Entrar'}
                  </button>
                ) : (
                  <button onClick={handleSignUp} disabled={authLoading} className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all active:scale-95">
                    {authLoading ? 'Carregando...' : 'Criar Conta e Salvar'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nome do Jogador + Botão de Vinculação (fora da barra de abas) */}
      {guestUser && (
        <div className="flex justify-end items-center w-full px-3 pb-1 shrink-0 gap-2">
          <span className="text-[10px] md:text-xs text-gray-400 hidden sm:inline">
            {(guestUser as any).auth_id ? 'Conta:' : 'Convidado:'}
          </span>
          <span className="text-[10px] md:text-sm text-blue-400 font-bold truncate max-w-[120px]">{guestUser.username}</span>
          {!(guestUser as any).auth_id && (
            <button
              onClick={() => { setLinkEmail(''); setLinkPassword(''); setLinkUsername(''); setShowLinkModal(true); }}
              className="text-[9px] md:text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold transition-colors shrink-0"
            >
              Vincular Conta
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 md:gap-4 mb-2 md:mb-4 border-b border-gray-800 w-full px-2 md:px-4 pb-2 justify-center shrink-0">
        <button
          onClick={() => { setView('canvas'); setDisplayPixels(pixelsRef.current); }}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-t-lg transition-colors ${view === 'canvas' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}
        >
          Mural
        </button>
        <button
          onClick={() => setView('game')}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-t-lg transition-colors ${view === 'game' ? 'bg-gray-800 text-white border-b-2 border-green-500' : 'text-gray-500 hover:text-white'}`}
        >
          Jogo
        </button>
        <button
          onClick={() => { setView('brecho'); setDisplayPixels(pixelsRef.current); }}
          className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-t-lg transition-colors ${view === 'brecho' ? 'bg-gray-800 text-white border-b-2 border-yellow-500' : 'text-gray-500 hover:text-white'}`}
        >
          Brechó
        </button>
      </div>

      {/* Modal de Vinculação de Conta */}
      {showLinkModal && (
        <div className="absolute inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-sm flex flex-col gap-4">
            <h2 className="text-white font-bold text-xl text-center">🔗 Vincular Conta</h2>
            <p className="text-gray-400 text-xs text-center">Seus pontos e High Score serão salvos permanentemente!</p>

            <div className="flex bg-gray-950 p-1 rounded-md border border-gray-700">
              <button onClick={() => setLinkMode('signup')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${linkMode === 'signup' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>Criar Conta</button>
              <button onClick={() => setLinkMode('login')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${linkMode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>Já tenho conta</button>
            </div>

            {linkMode === 'signup' && (
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs font-bold uppercase">Nome de Usuário</label>
                <input type="text" maxLength={15} value={linkUsername} onChange={(e) => setLinkUsername(e.target.value.toUpperCase())} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-purple-500 outline-none font-bold" placeholder="SEU_NICK" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-bold uppercase">E-mail</label>
              <input type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" placeholder="seu@email.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-bold uppercase">Senha</label>
              <input type="password" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} className="w-full bg-gray-950 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" placeholder="••••••••" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowLinkModal(false)} className="flex-1 py-2.5 text-gray-300 hover:text-white border border-gray-600 rounded-lg font-bold transition-colors">Cancelar</button>
              <button onClick={handleLinkAccount} disabled={authLoading} className={`flex-1 py-2.5 text-white font-bold rounded-lg transition-all active:scale-95 ${linkMode === 'signup' ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800' : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800'}`}>
                {authLoading ? 'Salvando...' : linkMode === 'signup' ? 'Criar e Vincular' : 'Entrar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <p className="text-gray-500 text-xs mt-4 text-center">
            Clique em um espaço{' '}
            <span
              onPointerDown={() => {
                if (dpadUnlocked) return;
                if (vazioTimerRef.current) clearTimeout(vazioTimerRef.current);
                const next = vazioTapCount + 1;
                setVazioTapCount(next);
                if (next >= 7) {
                  setDpadUnlocked(true);
                  setVazioTapCount(0);
                } else {
                  vazioTimerRef.current = setTimeout(() => setVazioTapCount(0), 2500);
                }
              }}
              className={`cursor-pointer select-none transition-all ${dpadUnlocked
                ? 'text-green-400 font-bold'
                : vazioTapCount > 0
                  ? `text-green-${Math.min(vazioTapCount * 100, 600)} font-semibold`
                  : 'text-gray-500'
                }`}
            >
              vazio
            </span>{' '}
            para abrir o estúdio de Pixel Art!
          </p>

          {/* D-PAD MOBILE - visível apenas após desbloquear tocando em "vazio" */}
          {dpadUnlocked && (
            <div className="md:hidden flex flex-col items-center gap-1 mt-4 opacity-80 select-none animate-fade-in">
              <p className="text-gray-600 text-[9px] mb-1 font-mono">KONAMI CODE</p>
              <div className="flex justify-center">
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))} className="w-10 h-10 rounded bg-gray-800/80 border border-gray-600 flex items-center justify-center text-white active:bg-gray-600 text-lg">&#9650;</button>
              </div>
              <div className="flex gap-1">
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }))} className="w-10 h-10 rounded bg-gray-800/80 border border-gray-600 flex items-center justify-center text-white active:bg-gray-600 text-lg">&#9664;</button>
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }))} className="w-10 h-10 rounded bg-gray-800/80 border border-gray-600 flex items-center justify-center text-white active:bg-gray-600 text-lg">&#9660;</button>
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }))} className="w-10 h-10 rounded bg-gray-800/80 border border-gray-600 flex items-center justify-center text-white active:bg-gray-600 text-lg">&#9654;</button>
              </div>
              <div className="flex gap-2 mt-1">
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true }))} className="w-10 h-10 rounded-full bg-gray-800/80 border border-gray-600 text-white text-xs font-bold active:bg-gray-600">B</button>
                <button onPointerDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }))} className="w-10 h-10 rounded-full bg-gray-800/80 border border-gray-600 text-white text-xs font-bold active:bg-gray-600">A</button>
              </div>
            </div>
          )}
        </div>
      )}
      {neoMode && view === 'canvas' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-green-500 text-green-400 font-mono text-xs px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,255,70,0.5)] animate-pulse pointer-events-none">
          &#9672; MODO MATRIX ATIVADO &#9672; VIDA EXTRA ATIVA
        </div>
      )}

      {/* --- NOVO: Modal de Ranking Global --- */}
      {showRankingModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <h2 className="text-2xl font-bold text-center text-white mb-4 flex items-center justify-center gap-2">
              <img src="/images/icon_trophy.png" alt="Trophy" className="w-8 h-8" /> Ranking Global (Top 50)
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar" style={{ minHeight: '300px' }}>
              {loadingRanking ? (
                <div className="text-center text-gray-400 py-10">Carregando Ranking...</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {rankingData.map((player, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${index === 0 ? 'bg-yellow-600/20 border border-yellow-500/50' : index === 1 ? 'bg-gray-400/20 border border-gray-400/50' : index === 2 ? 'bg-amber-700/20 border border-amber-700/50' : 'bg-gray-800'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-500' : 'text-gray-500'}`}>#{index + 1}</span>
                        <span className="text-white font-medium">{player.username || 'Anônimo'}</span>
                      </div>
                      <span className="text-blue-400 font-bold">{player.high_score} pts</span>
                    </div>
                  ))}
                  {rankingData.length === 0 && <div className="text-center text-gray-500">Nenhum jogador encontrado.</div>}
                </div>
              )}
            </div>

            <button onClick={() => setShowRankingModal(false)} className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all active:scale-95">
              Fechar Ranking
            </button>
          </div>
        </div>
      )}
      {/* ------------------------------------- */}

      {/* --- Vista do Brechó (Loja de Skins) --- */}
      <div className={`flex-1 w-full flex flex-col items-center px-4 md:px-8 py-4 overflow-y-auto ${view === 'brecho' ? 'flex' : 'hidden'}`}>
        <div className="w-full max-w-lg flex flex-col gap-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-1 flex items-center justify-center gap-2">
              👕 Brechó
            </h2>
            <p className="text-gray-400 text-xs md:text-sm">Equipe skins exclusivas para sua azeitona!</p>
            <p className="text-yellow-400 text-sm font-bold mt-2">Seus Pixels: <span className="text-lg">{displayPixels}</span></p>
          </div>

          {/* Skin Equipada - Destaque */}
          <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-600/50 rounded-xl p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gray-950 border-2 border-green-500 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,255,70,0.3)]">
              <img
                src={SKINS.find(s => s.id === activeSkinId)?.img || '/images/olive.png'}
                alt="Skin Ativa"
                className="w-12 h-12 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div>
              <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Skin Equipada</p>
              <p className="text-white font-bold text-lg">{SKINS.find(s => s.id === activeSkinId)?.emoji} {SKINS.find(s => s.id === activeSkinId)?.name}</p>
            </div>
          </div>

          {/* Lista de Skins */}
          <div className="flex flex-col gap-3">
            {SKINS.map(skin => {
              const isOwned = ownedSkins.includes(skin.id);
              const isActive = activeSkinId === skin.id;
              const canAfford = pixelsRef.current >= skin.price;

              return (
                <div
                  key={skin.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive
                    ? 'border-green-500 bg-green-900/20 shadow-[0_0_12px_rgba(0,255,70,0.2)]'
                    : isOwned
                      ? 'border-gray-600 bg-gray-800/60 hover:bg-gray-800'
                      : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
                    }`}
                >
                  {/* Preview da Skin */}
                  <div className="w-14 h-14 rounded-lg bg-gray-950 border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={skin.img}
                      alt={skin.name}
                      className="w-10 h-10 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{skin.emoji} {skin.name}</span>
                      {isActive && <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">ATIVA</span>}
                      {isOwned && !isActive && <span className="text-[9px] bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full font-bold">DESBLOQUEADA</span>}
                    </div>
                    <p className="text-gray-400 text-xs">{skin.description}</p>
                    {!isOwned && (
                      <p className="text-yellow-400 text-xs font-bold mt-0.5">💰 {skin.price} Px</p>
                    )}
                  </div>

                  {/* Botão */}
                  <div className="shrink-0">
                    {isActive ? (
                      <span className="text-green-400 text-xs font-bold px-3 py-1.5">✓ Equipada</span>
                    ) : isOwned ? (
                      <button
                        onClick={() => { setActiveSkinId(skin.id); activeSkinRef.current = skin.id; localStorage.setItem('olivActiveSkin', skin.id); }}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      >
                        Equipar
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!canAfford) return;
                          pixelsRef.current -= skin.price;
                          setDisplayPixels(pixelsRef.current);
                          localStorage.setItem('pixelArenaPixels', pixelsRef.current.toString());
                          if (guestUserRef.current) {
                            supabase.from('players').update({ pixels: pixelsRef.current }).eq('id', guestUserRef.current.id).then();
                          }
                          const newOwned = [...ownedSkins, skin.id];
                          setOwnedSkins(newOwned);
                          localStorage.setItem('olivOwnedSkins', JSON.stringify(newOwned));
                          setActiveSkinId(skin.id);
                          activeSkinRef.current = skin.id;
                          localStorage.setItem('olivActiveSkin', skin.id);
                        }}
                        disabled={!canAfford}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${canAfford
                          ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-600/20'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                        Comprar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-gray-600 text-[10px] text-center mt-2">Mais skins em breve... 👀</p>
        </div>
      </div>


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

              <div className="flex gap-2 items-center">
                <label className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-white font-bold cursor-pointer transition-colors shadow-lg shadow-blue-500/30">
                  📁 Upload Imagem
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <button onClick={() => setDrawColor('')} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white border border-gray-500">
                  Borracha
                </button>
              </div>
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
                  className="grid cursor-crosshair touch-none shrink-0"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '200px',
                    maxWidth: `calc(200px * (${adCols} / ${adRows}))`,
                    aspectRatio: `${adCols} / ${adRows}`,
                    margin: '0 auto',
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

            <button onClick={handleOpenRanking} className="hover:scale-110 transition-transform" title="Ranking Global">
              <img src="/images/icon_trophy.png" alt="Ranking" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
            </button>
            <button onClick={handleToggleMusic} className="hover:scale-110 transition-transform" title="Música de Fundo">
              <img src={isMutedMusic ? "/images/icon_music_muted.png" : "/images/icon_music.png"} alt="Music" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
            </button>
            <button onClick={handleToggleSFX} className="hover:scale-110 transition-transform" title="Efeitos Sonoros">
              <img src={isMutedSFX ? "/images/icon_sound_muted.png" : "/images/icon_sound.png"} alt="SFX" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
            </button>
            <span className="text-yellow-400">Px: {displayPixels}</span>
            <span className="text-green-400">Score: {Math.floor(gameState.score)}</span>
            <button
              onClick={() => window.dispatchEvent(new Event('toggleExternalPause'))}
              className="bg-gray-800 hover:bg-gray-700 p-2 rounded-md text-white md:hidden shadow-lg border border-gray-600"
            >
              <img src={gameState.isPaused ? '/images/icon_play.png' : '/images/icon_pause.png'} alt="Pause/Play" className="w-5 h-5" />
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

        {/* Injetar estilos CRT - simplificados no mobile */}
        <style>{`
          .crt-mobile-simple .crt-scanlines,
          .crt-mobile-simple .crt-moving-line,
          .crt-mobile-simple .crt-glitch-layer {
            animation: none !important;
          }
          .crt-mobile-simple .crt-scanlines {
            background-size: 100% 6px;
            opacity: 0.3;
          }
          .crt-mobile-simple .crt-aberration {
            filter: none !important;
          }
          .crt-mobile-simple.crt-container {
            animation: none !important;
            transform: none !important;
            box-shadow: inset 0 0 30px rgba(0,0,0,0.8);
          }
        `}</style>

        <div className="flex-1 w-full p-2 md:p-6 flex flex-col relative bg-black items-center justify-center">
          <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-[#0f172a] crt-container shadow-[0_0_50px_rgba(59,130,246,0.15)] border-2 border-gray-900 ${typeof window !== 'undefined' && window.innerWidth < 768 ? 'crt-mobile-simple' : ''}`}>
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
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 pointer-events-none">
                <h2 className="text-white text-4xl md:text-6xl font-extrabold mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400 text-center">OLIV</h2>
                <p className="text-gray-300 text-sm md:text-xl mb-8 text-center px-4">Navegue pelo canvas e conquiste território.</p>
                <p className="text-white bg-blue-600 px-6 py-3 md:px-8 md:py-4 rounded-full animate-pulse font-bold">
                  TOQUE NA TELA para começar
                </p>
              </div>
            )}

            {gameState.isPaused && !gameState.gameOver && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-30 pointer-events-none">
                <h2 className="text-white text-4xl md:text-6xl font-extrabold mb-4 tracking-widest">PAUSADO</h2>
                <p className="text-gray-300 md:text-xl">Toque no botão ⏸️ ou pressione <kbd className="font-bold text-yellow-400">P</kbd></p>
              </div>
            )}

            {gameState.gameOver && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center z-30 backdrop-blur-sm pointer-events-none ${neoMode ? 'bg-black/70' : 'bg-black/80'}`}>
                {neoMode ? (
                  <>
                    <p className="text-green-400 font-mono text-xs tracking-[0.3em] mb-2 opacity-80">// SIMULATION_TERMINATED</p>
                    <h2 className="font-extrabold mb-4 tracking-widest text-5xl md:text-7xl" style={{ color: '#00ff46', textShadow: '0 0 20px #00ff46, 0 0 40px #00cc38' }}>GAME OVER</h2>
                    <p className="font-mono text-green-300 text-lg md:text-2xl mb-2">score.final = <span className="text-white font-bold">{Math.floor(gameState.score)}</span></p>
                    <p className="text-green-600 font-mono text-xs mb-6">&gt; neo.shield = th3_ch0s3n_0N3</p>
                    <p className="font-mono text-green-400 border border-green-500 px-6 py-3 md:px-8 md:py-4 rounded animate-pulse font-bold" style={{ boxShadow: '0 0 15px rgba(0,255,70,0.4)' }}>
                      [ TOQUE PARA REINICIAR ]
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-red-500 text-5xl md:text-7xl font-extrabold mb-4 tracking-widest">GAME OVER</h2>
                    <p className="text-gray-300 text-lg md:text-2xl mb-6">Score Final: <span className="text-green-400 font-bold">{Math.floor(gameState.score)}</span></p>
                    <p className="text-white bg-gray-800 px-6 py-3 md:px-8 md:py-4 rounded-full animate-pulse font-bold">
                      TOQUE NA TELA para tentar novamente
                    </p>
                  </>
                )}
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