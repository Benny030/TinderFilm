// Aggettivi inglesi
const adjectivesEnglish = [
  'fluffy', 'bouncy', 'sparkly', 'sleepy', 'cozy',
  'chubby', 'wobbly', 'bubbly', 'fuzzy', 'snowy',
  'pudgy', 'wiggly', 'squashy', 'squishy', 'lumpy',
  'grumpy', 'dreamy', 'spooky', 'misty', 'cloudy',
  'zingy', 'zesty', 'peppy', 'tippy', 'jumpy',
  'silky', 'crispy', 'toasty', 'chewy', 'gooey',
  'sappy', 'loopy', 'dizzy', 'jazzy', 'snazzy'
];

// Sostantivi inglesi
const nounsEnglish = [
  'Cookie', 'Muffin', 'Noodle', 'Pickle', 'Pudding',
  'Biscuit', 'Waffle', 'Pretzel', 'Dumpling', 'Nugget',
  'Pebble', 'Bubble', 'Marshmallow', 'Sprinkle', 'Brownie',
  'Boba', 'Jellybean', 'Truffle', 'Caramel', 'Toffee',
  'Croissant', 'Bagel', 'Pancake', 'Cupcake', 'Donut',
  'Crumpet', 'Scone', 'Macaron', 'Cinnamon', 'Pistachio',
  'Coconut', 'Mango', 'Lychee', 'Papaya', 'Tiramisu'
];

// Aggettivi italiani
const adjectivesItalian = [
  'dolce', 'piccante', 'frizzante', 'soffice', 'croccante',
  'gustoso', 'cremoso', 'aromatico', 'fragrante', 'saporito',
  'sfizioso', 'invitante', 'delizioso', 'succulento', 'vellutato',
  'brillante', 'vivace', 'solare', 'tenero', 'allegro'
];

// Sostantivi italiani
const nounsItalian = [
  'Gelato', 'Pizza', 'Pasta', 'Risotto', 'Cannolo',
  'Espresso', 'Brioche', 'Panettone', 'Colomba', 'Arancino',
  'Focaccia', 'Lasagna', 'Raviolo', 'Gnocchi', 'Polpetta',
  'Tortellino', 'Cappuccino', 'Granita', 'Sorbetto', 'Zabaione'
];

export function generateGuestName(): string {
  // Scegli lingua a caso (true = inglese, false = italiano)
  const isEnglish = Math.random() < 0.5;

  const adjectives = isEnglish ? adjectivesEnglish : adjectivesItalian;
  const nouns = isEnglish ? nounsEnglish : nounsItalian;

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90) + 10;

  return `${adj}${noun}${num}`;
}