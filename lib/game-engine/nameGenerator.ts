export const generateRandomGuestName = (): string => {
  const adjectives = [
    'Azeitona', 'Tomate', 'Queijo', 'Pudim', 'Abacate', 'Batata', 'Picles', 'Bacon',
    'Pirata', 'Ninja', 'Mago', 'Zumbi', 'Fantasma', 'Alienígena', 'Monstro', 'Robo',
    'Furioso', 'Lento', 'Cansado', 'Eletrico', 'Doido', 'Sujo', 'Limpo', 'Cheiroso',

    // Comidas engraçadas
    'Coxinha', 'Pastel', 'Hamburguer', 'Sorvete', 'Banana', 'Melancia', 'Pepino', 'Miojo',
    'Salsicha', 'Feijao', 'Arroz', 'Bolacha', 'Biscoito', 'Chocolate', 'Paçoca', 'Farofa',

    // Personagens e criaturas
    'Vampiro', 'Dinossauro', 'Pinguim', 'Macaco', 'Tartaruga', 'Unicornio', 'Dragao', 'Panda',
    'Galinha', 'Jacare', 'Capivara', 'Lhama', 'Polvo', 'Pato', 'Canguru', 'Hamster',

    // Adjetivos cômicos
    'Rabugento', 'Desastrado', 'Saltitante', 'Melequento', 'Barulhento', 'Dorminhoco',
    'Torto', 'Banguela', 'Bigodudo', 'Careca', 'Peludo', 'Molhado', 'Crocrante',
    'Gritante', 'Tagarela', 'Pipocante', 'Escorregadio', 'Zicado', 'Atrapalhado',
    'Piscante', 'Explosivo', 'Fedido', 'Grudento', 'Tremelique'
  ];

  const nouns = [
    'Voador', 'Sorridente', 'Chorao', 'Brilhante', 'Escuro', 'Gordo', 'Fininho', 'Gigante',
    'Amarelo', 'Azul', 'Vermelho', 'Verde', 'Roxo', 'Rosa', 'Preto', 'Branco', 'Frito',

    // Características engraçadas
    'Pulante', 'Rodopiante', 'Rebolante', 'Cantante', 'Dançante', 'Piscante',
    'Tropeçante', 'Escorregante', 'Bufante', 'Ronronante', 'Espirrante', 'Bocejante',

    // Estados e aparências
    'Enrolado', 'Despenteado', 'Amassado', 'Encharcado', 'Assustado', 'Confuso',
    'Sonolento', 'Atordoado', 'Gelado', 'Derretido', 'Crocrante', 'Queimado',

    // Tamanhos e formatos
    'Mini', 'Enorme', 'Quadrado', 'Redondo', 'Tortinho', 'Pontudo', 'Esticado',
    'Murchinho', 'Bombado', 'Fofo', 'Gordinho', 'Magrelo',

    // Cores e estilos extras
    'Listrado', 'Pintado', 'Dourado', 'Prateado', 'Neon', 'ArcoIris',
    'Fumacento', 'Brilhoso', 'Cintilante', 'Pixelado', 'Frito', 'Empanado'
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999);

  return `${adj}_${noun}_${number}`;
};
