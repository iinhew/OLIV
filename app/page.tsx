import GameEngine from './GameEngine';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black">
      {/* Aqui estamos chamando o componente do jogo que criamos no Passo 3 */}
      <GameEngine />
    </main>
  );
}