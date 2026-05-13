const adjectives = [
  'fluffy', 'bouncy', 'sparkly', 'sleepy', 'cozy',
  'chubby', 'wobbly', 'bubbly', 'fuzzy', 'snowy',
  'pudgy', 'wiggly', 'squashy', 'squishy', 'lumpy',
  'grumpy', 'dreamy', 'spooky', 'misty', 'cloudy',
  'zingy', 'zesty', 'peppy', 'tippy', 'jumpy',
  'silky', 'crispy', 'toasty', 'chewy', 'gooey',
  'sappy', 'loopy', 'dizzy', 'jazzy', 'snazzy',
];

const nouns = [
  'Cookie', 'Muffin', 'Noodle', 'Pickle', 'Pudding',
  'Biscuit', 'Waffle', 'Pretzel', 'Dumpling', 'Nugget',
  'Pebble', 'Bubble', 'Marshmallow', 'Sprinkle', 'Brownie',
  'Boba', 'Jellybean', 'Truffle', 'Caramel', 'Toffee',
  'Croissant', 'Bagel', 'Pancake', 'Cupcake', 'Donut',
  'Crumpet', 'Scone', 'Macaron', 'Cinnamon', 'Pistachio',
  'Coconut', 'Mango', 'Lychee', 'Papaya', 'Tiramisu',
];

export function generateGuestName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}${noun}${num}`;
}