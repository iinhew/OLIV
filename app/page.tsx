'use client';

import { useEffect, useState } from 'react';
import GameEngine from './GameEngine';
import { StorageManager } from '../lib/storage';
import { GAME_CONSTANTS } from '../lib/game-engine/constants';

export default function Home() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    StorageManager.init([
      'pixelArenaHighScore',
      'pixelArenaPixels',
      'olivGuestId',
      'olivOwnedSkins',
      'olivActiveSkin',
      GAME_CONSTANTS.BABYLON_LS_KEY
    ]).then(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
        <p className="animate-pulse font-bold text-xl">Iniciando Motor do Jogo...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black">
      <GameEngine />
    </main>
  );
}