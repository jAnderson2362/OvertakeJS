// Trading card catalog data: rarity tiers, pack definitions, part cards and
// the car -> rarity map. Car cards themselves are generated from the car list
// at runtime (see cards/catalog.js) so adding a car to data/cars.js
// automatically adds its card.

export const STARTING_CREDITS = 500;

// Refund is what a duplicate pull pays back in credits.
export const RARITIES = [
  { id: 'common', label: 'Common', rank: 0, refund: 10 },
  { id: 'uncommon', label: 'Uncommon', rank: 1, refund: 20 },
  { id: 'rare', label: 'Rare', rank: 2, refund: 40 },
  { id: 'epic', label: 'Epic', rank: 3, refund: 90 },
  { id: 'legendary', label: 'Legendary', rank: 4, refund: 200 },
];

// Explicit tiers for the seed cars. Cars missing from this map get a tier
// from their power-to-weight ratio (see catalog.js).
export const CAR_RARITY = {
  'mazda-mx5': 'common',
  'civic-type-r': 'common',
  'gr-supra': 'uncommon',
  'bmw-m3-comp': 'uncommon',
  'model-s-plaid': 'rare',
  'gtr-nismo': 'rare',
  'huracan-evo': 'rare',
  'porsche-911-gt3': 'epic',
  'cayman-gt4-rs': 'epic',
  'corvette-z06': 'epic',
  'ferrari-296': 'legendary',
  'mclaren-720s': 'legendary',
};

export const PART_SLOTS = {
  tires: { label: 'Tires' },
  engine: { label: 'Engine' },
  chassis: { label: 'Chassis' },
  aero: { label: 'Aero' },
};

// Part cards. `mods` describe how a part would change a car's sim stats
// (mul = multiply, add = add). They are catalog data for now; applying parts
// to a car in the simulation is a later step.
export const seedParts = [
  // Tires: grip
  { id: 'street-tires', name: 'Street Compound', slot: 'tires', rarity: 'common',
    effect: '+1% grip', mods: [{ stat: 'tireGrip', mul: 1.01 }] },
  { id: 'track-day-tires', name: 'Track Day Compound', slot: 'tires', rarity: 'uncommon',
    effect: '+2% grip', mods: [{ stat: 'tireGrip', mul: 1.02 }] },
  { id: 'sport-tires', name: 'Sport Compound', slot: 'tires', rarity: 'rare',
    effect: '+3% grip', mods: [{ stat: 'tireGrip', mul: 1.03 }] },
  { id: 'racing-slicks', name: 'Racing Slicks', slot: 'tires', rarity: 'epic',
    effect: '+6% grip', mods: [{ stat: 'tireGrip', mul: 1.06 }] },
  { id: 'qualifying-softs', name: 'Qualifying Softs', slot: 'tires', rarity: 'legendary',
    effect: '+9% grip', mods: [{ stat: 'tireGrip', mul: 1.09 }] },

  // Engine: power
  { id: 'cold-air-intake', name: 'Cold Air Intake', slot: 'engine', rarity: 'common',
    effect: '+2% power', mods: [{ stat: 'power', mul: 1.02 }] },
  { id: 'sport-exhaust', name: 'Sport Exhaust', slot: 'engine', rarity: 'uncommon',
    effect: '+4% power', mods: [{ stat: 'power', mul: 1.04 }] },
  { id: 'ecu-remap', name: 'Stage 2 ECU Remap', slot: 'engine', rarity: 'rare',
    effect: '+6% power', mods: [{ stat: 'power', mul: 1.06 }] },
  { id: 'big-turbo', name: 'Big Turbo Kit', slot: 'engine', rarity: 'epic',
    effect: '+12% power', mods: [{ stat: 'power', mul: 1.12 }] },
  { id: 'race-engine', name: 'Full Race Engine', slot: 'engine', rarity: 'legendary',
    effect: '+20% power', mods: [{ stat: 'power', mul: 1.2 }] },

  // Chassis: mass
  { id: 'forged-wheels', name: 'Forged Wheels', slot: 'chassis', rarity: 'common',
    effect: '-15 kg', mods: [{ stat: 'mass', add: -15 }] },
  { id: 'polycarbonate-glass', name: 'Polycarbonate Windows', slot: 'chassis', rarity: 'uncommon',
    effect: '-22 kg', mods: [{ stat: 'mass', add: -22 }] },
  { id: 'carbon-seats', name: 'Carbon Bucket Seats', slot: 'chassis', rarity: 'rare',
    effect: '-30 kg', mods: [{ stat: 'mass', add: -30 }] },
  { id: 'carbon-panels', name: 'Carbon Body Panels', slot: 'chassis', rarity: 'epic',
    effect: '-80 kg', mods: [{ stat: 'mass', add: -80 }] },
  { id: 'titanium-rebuild', name: 'Titanium Rebuild', slot: 'chassis', rarity: 'legendary',
    effect: '-140 kg', mods: [{ stat: 'mass', add: -140 }] },

  // Aero: downforce and drag
  { id: 'lip-spoiler', name: 'Lip Spoiler', slot: 'aero', rarity: 'common',
    effect: '+0.10 downforce area', mods: [{ stat: 'liftArea', add: 0.1 }] },
  { id: 'low-drag-mirrors', name: 'Low Drag Mirrors', slot: 'aero', rarity: 'common',
    effect: '-0.02 drag area', mods: [{ stat: 'dragArea', add: -0.02 }] },
  { id: 'ducktail-spoiler', name: 'Ducktail Spoiler', slot: 'aero', rarity: 'uncommon',
    effect: '+0.20 downforce area', mods: [{ stat: 'liftArea', add: 0.2 }] },
  { id: 'gt-wing', name: 'GT Wing', slot: 'aero', rarity: 'rare',
    effect: '+0.35 downforce, +0.03 drag', mods: [{ stat: 'liftArea', add: 0.35 }, { stat: 'dragArea', add: 0.03 }] },
  { id: 'splitter-diffuser', name: 'Splitter and Diffuser', slot: 'aero', rarity: 'epic',
    effect: '+0.60 downforce area', mods: [{ stat: 'liftArea', add: 0.6 }] },
  { id: 'dtm-aero', name: 'DTM Aero Package', slot: 'aero', rarity: 'legendary',
    effect: '+1.00 downforce, +0.05 drag', mods: [{ stat: 'liftArea', add: 1.0 }, { stat: 'dragArea', add: 0.05 }] },
  { id: 'active-wing', name: 'Active Rear Wing', slot: 'aero', rarity: 'legendary',
    effect: '-0.08 drag area', mods: [{ stat: 'dragArea', add: -0.08 }] },
];

// Packs. `odds` are relative weights per rarity for each card slot in the
// pack. `guarantee` forces at least one card of that tier or better.
// The daily pack is free and claimable once per UTC day; the rest cost
// credits and can be bought several at a time.
export const PACKS = [
  {
    id: 'daily',
    name: 'Daily Pit Stop',
    tagline: 'One free pack every day. Come back tomorrow for another.',
    price: 0,
    daily: true,
    cards: 3,
    odds: { common: 55, uncommon: 25, rare: 13, epic: 6, legendary: 1 },
    guarantee: null,
  },
  {
    id: 'paddock',
    name: 'Paddock Pack',
    tagline: 'Three cards, standard odds. The bread and butter.',
    price: 150,
    daily: false,
    cards: 3,
    odds: { common: 55, uncommon: 25, rare: 13, epic: 6, legendary: 1 },
    guarantee: null,
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    tagline: 'Five cards with better odds and a guaranteed Rare or better.',
    price: 400,
    daily: false,
    cards: 5,
    odds: { common: 35, uncommon: 30, rare: 20, epic: 11, legendary: 4 },
    guarantee: 'rare',
  },
  {
    id: 'elite',
    name: 'Elite Pack',
    tagline: 'Five cards, one of them Epic or better. Legendary odds ten times the daily pack.',
    price: 900,
    daily: false,
    cards: 5,
    odds: { common: 15, uncommon: 22, rare: 33, epic: 20, legendary: 10 },
    guarantee: 'epic',
  },
];

export const MAX_PACKS_PER_PURCHASE = 10;
