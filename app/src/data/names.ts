// Names for characters and places, by region and era, made up on the device
// (no internet needed). First names come from lists of names really used in
// each place and time; surnames from each region's common family names; place
// names are built from the pieces real place names in that region are made of.

export type Region = 'british' | 'american' | 'french' | 'german' | 'italian' | 'spanish' | 'nordic' | 'slavic';
export type Era = 'medieval' | 'victorian' | 'modern';
export type Gender = 'any' | 'female' | 'male';

export const REGIONS: { id: Region; label: string }[] = [
  { id: 'british', label: 'British & Irish' },
  { id: 'american', label: 'American' },
  { id: 'french', label: 'French' },
  { id: 'german', label: 'German' },
  { id: 'italian', label: 'Italian' },
  { id: 'spanish', label: 'Spanish' },
  { id: 'nordic', label: 'Scandinavian' },
  { id: 'slavic', label: 'Slavic' },
];

export const ERAS: { id: Era; label: string }[] = [
  { id: 'medieval', label: 'Medieval' },
  { id: 'victorian', label: '1800s' },
  { id: 'modern', label: 'Modern' },
];

type Firsts = Record<Era, { female: string[]; male: string[] }>;

// Names separated by spaces; '|' starts a name of several words ("Alto Bianco|d’Oro|del Lago").
const w = (s: string) => s.split('|').flatMap((part, i) => (i === 0 ? part.split(' ') : [part]));

const FIRST: Record<Region, Firsts> = {
  british: {
    medieval: { female: w('Agnes Alice Avice Beatrice Cecily Edith Elena Emma Isabel Joan Juliana Mabel Margery Matilda Rohesia Sybil'), male: w('Adam Aldous Bartholomew Geoffrey Gilbert Hamo Hugh Jocelyn Osbert Ralph Reginald Roger Simon Walter William Wystan') },
    victorian: { female: w('Ada Beatrice Clara Edith Eliza Emily Florence Harriet Ivy Lavinia Lydia Maud Rose Violet Winifred Agnes'), male: w('Albert Alfred Arthur Bertram Cecil Edmund Ernest Frederick Herbert Horace Jasper Percival Septimus Silas Thomas Walter') },
    modern: { female: w('Amelia Bethan Chloe Eilidh Freya Grace Imogen Isla Megan Niamh Orla Phoebe Rhian Siobhan Sophie Zara'), male: w('Callum Ciaran Dylan Ewan Finn Harry Jack Jamie Liam Lewis Oscar Owen Rhys Rory Tom Will') },
  },
  american: {
    medieval: { female: w('Agnes Alice Anne Elizabeth Joan Margaret Mary Matilda Sarah'), male: w('Henry John Richard Robert Thomas Walter William') },
    victorian: { female: w('Abigail Clementine Cora Delia Eliza Hattie Josephine Louisa Mae Minnie Opal Pearl Ruth Temperance Viola Willa'), male: w('Abner Amos Augustus Booker Calvin Clement Elijah Ezra Gideon Hiram Jebediah Josiah Levi Silas Thaddeus Wyatt') },
    modern: { female: w('Avery Brooke Dakota Emma Harper Jasmine Kayla Lauren Madison Maya Nevaeh Riley Savannah Sierra Taylor Zoe'), male: w('Austin Brandon Carter Cody Dakota Dylan Hunter Jalen Jordan Logan Marcus Mason Tanner Travis Tyler Wyatt') },
  },
  french: {
    medieval: { female: w('Adélaïde Aliénor Aude Béatrix Blanche Ermengarde Héloïse Isabeau Jehanne Marguerite Mahaut Perrine Sibylle Yolande'), male: w('Arnaud Aymeric Bertrand Enguerrand Foulques Gautier Guillaume Hugues Jehan Raoul Renaud Thibaut Tristan Yves') },
    victorian: { female: w('Adèle Amélie Berthe Céleste Clémence Eugénie Hortense Joséphine Léonie Louise Mathilde Odette Pauline Victorine'), male: w('Achille Alphonse Anatole Armand Auguste Baptiste Camille Émile Eugène Gustave Honoré Lucien Octave Théophile') },
    modern: { female: w('Camille Chloé Clara Élodie Inès Jade Léa Lucie Manon Margaux Océane Romane Zoé Maëlle'), male: w('Antoine Arthur Baptiste Clément Hugo Jules Léo Louis Lucas Mathis Maxime Nathan Raphaël Théo') },
  },
  german: {
    medieval: { female: w('Adelheid Agnes Brunhild Gertrud Gisela Hedwig Hildegard Irmgard Kunigunde Mechthild Richenza Walburga'), male: w('Albrecht Burkhard Dietrich Eberhard Friedrich Gottfried Hartmann Heinrich Konrad Leopold Otto Rudolf Ulrich Wolfram') },
    victorian: { female: w('Auguste Charlotte Elisabeth Elise Emilie Frieda Hedwig Johanna Klara Luise Marie Mathilde Minna Wilhelmine'), male: w('August Ernst Ferdinand Franz Friedrich Georg Gottlieb Hermann Johann Karl Ludwig Otto Theodor Wilhelm') },
    modern: { female: w('Anna Emilia Hannah Johanna Lea Lena Leonie Marie Mia Nele Paula Sophie Lina Clara'), male: w('Ben Elias Felix Finn Jonas Leon Luca Lukas Maximilian Moritz Noah Paul Tim Jannik') },
  },
  italian: {
    medieval: { female: w('Beatrice Bianca Caterina Costanza Ginevra Isotta Lucrezia Matilde Monna Piccarda Simonetta Vanna'), male: w('Bartolo Bonifacio Cosimo Dante Filippo Giotto Guido Jacopo Lapo Lorenzo Niccolò Piero Rinaldo Tancredi') },
    victorian: { female: w('Adelaide Amalia Assunta Clotilde Concetta Elvira Ernesta Filomena Giuseppina Ida Rosalia Teresa Vittoria Zelinda'), male: w('Achille Alessandro Carlo Domenico Enrico Ettore Giacomo Giovanni Giuseppe Luigi Ottavio Salvatore Umberto Vittorio') },
    modern: { female: w('Alessia Alice Aurora Chiara Elisa Federica Francesca Giorgia Giulia Martina Sara Sofia Valentina Ginevra'), male: w('Alessandro Andrea Davide Francesco Gabriele Leonardo Lorenzo Luca Marco Matteo Riccardo Simone Tommaso Edoardo') },
  },
  spanish: {
    medieval: { female: w('Aldonza Beatriz Berenguela Blanca Constanza Elvira Inés Jimena Leonor Mencía Sancha Urraca'), male: w('Alfonso Álvar Bermudo Diego Fernán García Gonzalo Martín Nuño Pelayo Rodrigo Sancho') },
    victorian: { female: w('Amparo Ascensión Consuelo Dolores Encarnación Engracia Josefa Mercedes Pilar Remedios Rosario Soledad Trinidad Visitación'), male: w('Anselmo Benito Casimiro Eusebio Fermín Gregorio Ildefonso Leandro Mariano Pascual Ramón Saturnino Teodoro Vicente') },
    modern: { female: w('Alba Carla Daniela Elena Irene Julia Lucía Marta Martina Noa Paula Sara Valeria Ximena'), male: w('Adrián Álvaro Daniel David Diego Hugo Iker Javier Mario Mateo Pablo Sergio Martín Unai') },
  },
  nordic: {
    medieval: { female: w('Åsa Astrid Bergljot Gudrun Gunnhild Gyda Halldis Ingrid Ragnhild Sigrid Solveig Thora Ylva'), male: w('Arne Bjørn Eirik Gunnar Halvard Harald Ivar Leif Olav Ragnar Sigurd Sverre Torstein Ulf') },
    victorian: { female: w('Anna Beda Elin Hulda Ingeborg Karin Kristina Märta Nanna Ragna Signe Tekla Hilma Valborg'), male: w('Anders Axel Einar Fredrik Gustav Hjalmar Johan Knut Lars Nils Oskar Sven Ture Viggo') },
    modern: { female: w('Alma Astrid Ebba Elsa Freja Ida Ingrid Linnea Maja Nora Saga Selma Tuva Wilma'), male: w('Aksel Elias Emil Filip Isak Jonas Lucas Magnus Noah Oliver Sander Viktor Leo Kasper') },
  },
  slavic: {
    medieval: { female: w('Dobroslava Ludmila Milava Olga Predslava Rogneda Svetlana Vlasta Zbyslava Dubravka Ljubava'), male: w('Bogdan Boleslav Borislav Dobrynya Igor Jaroslav Mstislav Rurik Svyatoslav Vladimir Vratislav Yaropolk') },
    victorian: { female: w('Anastasia Darya Evdokia Fyokla Glafira Lyubov Marfa Natalya Praskovya Sofya Tatiana Varvara Zinaida'), male: w('Afanasy Arkady Dmitri Fyodor Gavrila Ivan Konstantin Lev Nikolai Pavel Pyotr Semyon Vasily Yakov') },
    modern: { female: w('Alina Anya Daria Ewa Katarzyna Lena Milena Nadia Petra Sasha Tereza Vera Zofia Julia'), male: w('Aleksei Bartosz Dominik Filip Jakub Kamil Lukas Marek Mikhail Oleg Pavel Tomasz Vadim Yuri') },
  },
};

const SURNAMES: Record<Region, string[]> = {
  british: w('Ashdown Bramwell Carrick Crane Dunmore Fairweather Fenwick Gallagher Hartley Kavanagh Lockwood Mackenzie Marlowe Pennington Quayle Rowntree Sinclair Thackeray Whitlock Yardley Abbott Blackwood Brennan Cartwright Delaney Ellery Fairfax Garside Hale Holloway Kingsley Lennox Morrow Nightingale Oakes Prescott Radcliffe Sutherland Tolliver Underhill Wentworth'),
  american: w('Abernathy Bishop Boone Calloway Carver Crockett Dawson Ellsworth Garrison Holloway Jefferson Kincaid Mercer Pruitt Ramsey Sawyer Thornton Tucker Walker Whitaker Alvarez Beaumont Coleman Delacroix Fitzgerald Grady Harlan McAllister Novak Okafor Pierce Reyes Sullivan Washington Yates'),
  french: w('Aubert Beaumont Blanchard Chevalier Delacroix Dubois Fontaine Garnier Lacroix Lemaire Marchand Mercier Moreau Perrin Rousseau Vasseur'),
  german: w('Albrecht Baumann Brandt Eckhart Falkenrath Hartmann Keller Krause Lindner Morgenstern Richter Schaefer Vogel Weber Winkler Zimmermann'),
  italian: w('Abate Bellini Benedetti Caruso Costa Esposito Ferrante Gallo Lombardi Marchetti Moretti Orsini Ricci Romano Santoro Vitale'),
  spanish: w('Alarcón Báez Castellanos Delgado Escobar Fuentes Guerrero Ibarra Lozano Medina Navarro Ortega Quintero Salazar Valdés Zamora'),
  nordic: w('Andersen Berg Dahl Ek Falk Holm Lind Lindqvist Nilsson Nyberg Sandberg Strand Sundström Vik Holmgren Lund'),
  slavic: w('Belov Dvořák Horvat Ivanov Jankowski Kowalski Kozlov Levski Markovic Novak Orlov Petrov Sokolov Volkov Wójcik Zelenko'),
};

/** Medieval people mostly went by a place, a trade or a father's name. */
const MEDIEVAL_BY: Partial<Record<Region, (r: () => number, female: boolean, place: () => string) => string>> = {
  british: (r, _f, place) => (r() < 0.5 ? `of ${place()}` : pick(r, w('Archer Baker Carter Cooper Fletcher Mason Miller Shepherd Smith Thatcher Tanner Webb'))),
  french: (_r, _f, place) => `de ${place()}`,
  german: (_r, _f, place) => `von ${place()}`,
  italian: (_r, _f, place) => `da ${place()}`,
  spanish: (r, _f, place) => (r() < 0.5 ? `de ${place()}` : pick(r, w('Fernández García González López Martínez Pérez Rodríguez Sánchez'))),
  // A father's name: Eirik's son, Eirik's daughter.
  nordic: (r, female) => `${pick(r, w('Eirik Gunnar Harald Ivar Olav Sigurd Sven Thorstein'))}${female ? 'sdatter' : 'sson'}`,
  slavic: (r, female) => `${pick(r, w('Bogdan Igor Ivan Jaroslav Mstislav Vladimir'))}${female ? 'ovna' : 'ovich'}`,
};

/** Pieces of place names: the start, the end, and (sometimes) a word in front or behind. */
const PLACES: Record<Region, { start: string[]; end: string[]; extra?: string[]; fem?: { start: string[]; end: string[] } }> = {
  british: { start: w('Ash Black Brack Brad Chester Cold Dun Elm Fen Glen Hart Kil Lang Lyn Mar Nether Pen Red Stan Thorn Wick Wolver'), end: w('bury by combe cott dale den field ford ham hollow holme ley mere minster more ness stead stow thwaite ton wick worth'), extra: w('Upper Lower Great Little Kings Bishops St') },
  american: { start: w('Ash Bear Cedar Clear Copper Deer Eagle Elk Fair Green Hickory Iron Maple Oak Pine Red Rock Silver Spring Willow'), end: w('brook burg creek dale falls field ford grove haven hill ridge ton ville wood port'), extra: w('North South East West New Fort Mount') },
  french: { start: w('Beau Belle Bois Chante Château Clair Font Mont Neuf Roche Val Ville'), end: w('ac bois court fort lieu mont roche ville val'), extra: w('Saint-Martin-de- Sainte-Croix-de-') },
  german: { start: w('Alten Bad Berg Eich Falken Freuden Grün Hoch Kirch Linden Mühl Neu Oster Rosen Schön Stein Wald Wolfs'), end: w('au bach berg brück burg dorf feld furt hausen heim hof stadt stein tal wald'), extra: [] },
  // Two words, the second agreeing with the first: masculine ones, then feminine ones ("Monte Rosso", "Torre Vecchia").
  italian: { start: w('Borgo Castel Colle Monte Poggio Pian'), end: w('Alto Bianco Chiaro Fiorito Lungo Nuovo Rosso Vecchio Verde|d’Oro|del Lago'), fem: { start: w('Acqua Fonte Rocca Serra Torre Villa'), end: w('Alta Bianca Chiara Fiorita Lunga Marina Nuova Rossa Vecchia Verde|d’Oro|del Lago') } },
  spanish: { start: w('Campo Castillo Monte Puerto Río Valle'), end: w('Alto Blanco Claro Dorado Hermoso Mayor Nuevo Real Seco Verde|del Mar|de la Sierra'), fem: { start: w('Fuente Peña Torre Villa Vega'), end: w('Alta Blanca Clara Dorada Hermosa Mayor Nueva Real Seca Verde|del Mar|de la Sierra') } },
  nordic: { start: w('Ask Björk Ek Fjell Grøn Hav Is Kalv Lind Mal Ny Ravn Sand Sol Stor Ulv Vind'), end: w('by dal fjord holm hus lund nes stad strand sund vik vang berg'), extra: [] },
  slavic: { start: w('Belo Bystro Dubro Gora Krasno Lipo Novo Ozero Pod Polo Sosno Stara Velika Zelena Zlato'), end: w('dar gorod grad nik ovo polye sk slav vac vka vo yar'), extra: [] },
};

function pick<T>(r: () => number, list: T[]): T {
  return list[Math.floor(r() * list.length)];
}

/** A small, repeatable random number source. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** A made-up place name from the region's pieces. */
export function placeName(region: Region, r: () => number): string {
  const p = PLACES[region];
  let name: string;
  if (p.fem) {
    // Two words that agree ("Monte Rosso", "Torre Vecchia", "Fuente del Mar").
    const parts = r() < 0.5 ? p.fem : p;
    name = `${pick(r, parts.start)} ${pick(r, parts.end)}`;
  } else {
    // Pieces that meet vowel to vowel ("Beau" + "ac") read badly: choose again.
    let start = pick(r, p.start);
    let end = pick(r, p.end);
    for (let i = 0; i < 6 && /[aeiouyéèêâûô]$/i.test(start) && /^[aeiouy]/i.test(end); i++) {
      start = pick(r, p.start);
      end = pick(r, p.end);
    }
    name = start + end;
  }
  name = name.replace(/(.)\1\1/g, '$1$1');
  if (p.extra?.length && r() < 0.2) {
    const extra = pick(r, p.extra);
    name = extra.endsWith('-') ? extra + name : `${extra} ${name}`;
  }
  return name;
}

/** A character's full name. */
export function personName(region: Region, era: Era, gender: Gender, r: () => number): string {
  const g = gender === 'any' ? (r() < 0.5 ? 'female' : 'male') : gender;
  const first = pick(r, FIRST[region][era][g]);
  const by = MEDIEVAL_BY[region];
  if (era === 'medieval' && by) return `${first} ${by(r, g === 'female', () => placeName(region, r))}`;
  return `${first} ${g === 'female' && region === 'slavic' ? feminine(pick(r, SURNAMES[region])) : pick(r, SURNAMES[region])}`;
}

/** A Slavic family name as a woman carries it: Sokolova, Jankowska. */
function feminine(surname: string): string {
  if (/(ov|ev|in)$/.test(surname)) return `${surname}a`;
  if (/ski$/.test(surname)) return surname.replace(/ski$/, 'ska');
  if (/(ý)$/.test(surname)) return surname.replace(/ý$/, 'á');
  if (/ák$|ek$|ík$|ář$/.test(surname)) return `${surname}ová`;
  return surname;
}

/** A handful of different names to choose from. */
export function suggestNames(kind: 'character' | 'place', region: Region, era: Era, gender: Gender, seed: number, count = 12): string[] {
  const r = seeded(seed);
  const out = new Set<string>();
  for (let tries = 0; out.size < count && tries < count * 20; tries++) out.add(kind === 'place' ? placeName(region, r) : personName(region, era, gender, r));
  return [...out];
}
