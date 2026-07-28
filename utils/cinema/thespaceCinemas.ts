export type TheSpaceCinema = {
  id: number;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  slug: string;
};

export const THE_SPACE_CINEMAS: TheSpaceCinema[] = [
  // Emilia-Romagna
  {
    id: 1013,
    name: 'The Space Parma Campus',
    city: 'Parma',
    address: 'Largo Sergio Leone 7/A',
    lat: 44.7662,
    lng: 10.3213,
    slug: 'parma-campus',
  },
  {
    id: 1031,
    name: 'The Space Parma Centro',
    city: 'Parma',
    address: 'Via Toscana 22',
    lat: 44.7904,
    lng: 10.3347,
    slug: 'parma-centro',
  },
  {
    id: 1003,
    name: 'The Space Bologna',
    city: 'Bologna',
    address: 'Viale Europa 5',
    lat: 44.5286,
    lng: 11.3972,
    slug: 'bologna',
  },

  // Roma
  {
    id: 1025,
    name: "The Space Roma Parco de' Medici",
    city: 'Roma',
    address: 'Viale Parco de Medici 135',
    lat: 41.8078,
    lng: 12.3819,
    slug: 'roma-parco-de-medici', 
  },
  {
    id: 1021,
    name: 'The Space Roma Moderno',
    city: 'Roma',
    address: 'Piazza della Repubblica 44',
    lat: 41.9011,
    lng: 12.4966,
    slug: 'roma-moderno',
  },

  // Milano
  {
    id: 1004,
    name: 'The Space Cerro Maggiore',
    city: 'Milano',
    address: 'Via Roma 104, Cerro Maggiore',
    lat: 45.5927,
    lng: 8.9578,
    slug: 'cerro-maggiore',
  },
  {
    id: 1005,
    name: 'The Space Rozzano',
    city: 'Milano',
    address: 'Via Cascina Secco 1, Rozzano',
    lat: 45.3818,
    lng: 9.1457,
    slug: 'rozzano',
  },

  // Piemonte
  {
    id: 1028,
    name: 'The Space Torino',
    city: 'Torino',
    address: 'Corso Grosseto 54, Beinasco',
    lat: 45.1164,
    lng: 7.5945,
    slug: 'torino',
  },

  // Veneto
  {
    id: 1007,
    name: 'The Space Verona',
    city: 'Verona',
    address: 'Via Col. Galliano 2',
    lat: 45.4334,
    lng: 10.9748,
    slug: 'verona',
  },

  {
    id: 1015,
    name: 'The Space Limena',
    city: 'Padova',
    address: 'Via Lisbona 1, Limena',
    lat: 45.4467,
    lng: 11.8444,
    slug: 'limena',
  },

  {
    id: 1016,
    name: 'The Space Vicenza',
    city: 'Vicenza',
    address: 'Via della Scienza 16, Torri di Quartesolo',
    lat: 45.5145,
    lng: 11.6082,
    slug: 'vicenza-torri-di-quartesolo',
  },

  // Toscana
  {
    id: 1008,
    name: 'The Space Firenze',
    city: 'Firenze',
    address: 'Via Tirso 8, Novoli',
    lat: 43.7969,
    lng: 11.2193,
    slug: 'firenze',
  },

  // Campania
  {
    id: 1019,
    name: 'The Space Napoli',
    city: 'Napoli',
    address: 'Via Gianturco 50',
    lat: 40.8467,
    lng: 14.2855,
    slug: 'napoli',
  },

  {
    id: 1010,
    name: 'The Space Salerno',
    city: 'Salerno',
    address: 'Via Fiorentino 48',
    lat: 40.6896,
    lng: 14.7891,
    slug: 'salerno',
  },

  // Liguria
  {
    id: 1011,
    name: 'The Space Genova',
    city: 'Genova',
    address: 'Calata Gadda, Porto Antico',
    lat: 44.4106,
    lng: 8.9270,
    slug: 'genova',
  },

  // Friuli
  {
    id: 1012,
    name: 'The Space Trieste',
    city: 'Trieste',
    address: 'Via Luigi Negrelli 2',
    lat: 45.6370,
    lng: 13.7817,
    slug: 'trieste',
  },

  // Sardegna
  {
    id: 1017,
    name: 'The Space Cagliari Quartucciu',
    city: 'Cagliari',
    address: 'S.S. 554 Quartucciu',
    lat: 39.2567,
    lng: 9.1795,
    slug: 'quartucciu',
  },

  // Sicilia
  {
    id: 1032,
    name: 'The Space Catania Belpasso',
    city: 'Catania',
    address: 'C.da Pantano, Belpasso',
    lat: 37.5839,
    lng: 14.9846,
    slug: 'belpasso',
  },
];