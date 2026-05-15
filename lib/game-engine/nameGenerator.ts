export const generateRandomGuestName = (): string => {
  const adjectives = [
    'Azeitona', 'Tomate', 'Queijo', 'Pudim', 'Abacate', 'Batata', 'Picles', 'Bacon',
    'Pirata', 'Ninja', 'Mago', 'Zumbi', 'Fantasma', 'Alienígena', 'Monstro', 'Robo',
    'Furioso', 'Lento', 'Cansado', 'Eletrico', 'Doido', 'Sujo', 'Limpo', 'Cheiroso'
  ];
  const nouns = [
    'Voador', 'Sorridente', 'Chorao', 'Brilhante', 'Escuro', 'Gordo', 'Fininho', 'Gigante',
    'Amarelo', 'Azul', 'Vermelho', 'Verde', 'Roxo', 'Rosa', 'Preto', 'Branco', 'Frito'
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999);

  return `${adj}_${noun}_${number}`;
};
