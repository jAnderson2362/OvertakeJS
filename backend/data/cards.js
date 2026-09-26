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

// Upgrade categories, each split into sub-slots. A build fits at most one
// part card per sub-slot.
export const PART_CATEGORIES = [
  { id: 'engine', label: 'Engine', slots: [
    { id: 'intake', label: 'Intake' },
    { id: 'fuelSystem', label: 'Fuel System' },
    { id: 'ignition', label: 'Ignition' },
    { id: 'exhaust', label: 'Exhaust' },
    { id: 'camshaft', label: 'Camshaft' },
    { id: 'valves', label: 'Valves' },
    { id: 'displacement', label: 'Displacement' },
  ] },
  { id: 'platform', label: 'Platform & Handling', slots: [
    { id: 'brakes', label: 'Brakes' },
    { id: 'springs', label: 'Springs' },
    { id: 'antiRollBars', label: 'Anti-roll Bars' },
    { id: 'chassisReinforcement', label: 'Chassis Reinforcement' },
    { id: 'weightReduction', label: 'Weight Reduction' },
  ] },
  { id: 'drivetrain', label: 'Drivetrain', slots: [
    { id: 'clutch', label: 'Clutch' },
    { id: 'transmission', label: 'Transmission' },
    { id: 'driveline', label: 'Driveline' },
    { id: 'differential', label: 'Differential' },
  ] },
  { id: 'tires', label: 'Tires & Rims', slots: [
    { id: 'tireCompound', label: 'Tire Compound' },
    { id: 'frontTireWidth', label: 'Front Tire Width' },
    { id: 'rearTireWidth', label: 'Rear Tire Width' },
    { id: 'rims', label: 'Rims' },
    { id: 'rimSize', label: 'Rim Size' },
  ] },
  { id: 'aero', label: 'Aero & Appearance', slots: [
    { id: 'frontBumper', label: 'Front Bumper' },
    { id: 'rearBumper', label: 'Rear Bumper' },
    { id: 'rearWing', label: 'Spoiler & Wing' },
    { id: 'sideSkirts', label: 'Skirts & Mirrors' },
    { id: 'hood', label: 'Hood' },
  ] },
  { id: 'conversion', label: 'Conversion', slots: [
    { id: 'engineSwap', label: 'Engine Swap' },
    { id: 'drivetrainSwap', label: 'Drivetrain Swap' },
    { id: 'aspiration', label: 'Aspiration' },
  ] },
];

// slotId -> { label, category }
export const PART_SLOTS = Object.fromEntries(
  PART_CATEGORIES.flatMap((c) => c.slots.map((s) => [s.id, { label: s.label, category: c.id }])),
);

// Part cards. `mods` change the car's sim stats: mul multiplies, add adds,
// set replaces. Stats beyond data/cars.js default to 1 (no effect):
//   cornerGrip  lateral grip multiplier (springs, anti-roll bars, widths)
//   brake       braking decel multiplier
//   traction    share of grip usable under power (clutch, diff, rear width)
//   driveline   driveline efficiency multiplier (gearbox, driveshaft)
// consistency is the per-lap pace spread, so mul < 1 means steadier laps.
// The ids of the original 22 parts never change: players own those cards.
export const seedParts = [
  /* ----- Engine ----- */
  { id: 'cold-air-intake', name: 'Cold Air Intake', slot: 'intake', rarity: 'common',
    effect: '+2% power', mods: [{ stat: 'power', mul: 1.02 }] },
  { id: 'race-intake', name: 'Race Intake Manifold', slot: 'intake', rarity: 'rare',
    effect: '+4% power', mods: [{ stat: 'power', mul: 1.04 }] },

  { id: 'high-flow-injectors', name: 'High Flow Injectors', slot: 'fuelSystem', rarity: 'uncommon',
    effect: '+2% power', mods: [{ stat: 'power', mul: 1.02 }] },
  { id: 'race-fuel-system', name: 'Race Fuel System', slot: 'fuelSystem', rarity: 'epic',
    effect: '+5% power', mods: [{ stat: 'power', mul: 1.05 }] },

  { id: 'sport-ignition', name: 'Sport Ignition Coils', slot: 'ignition', rarity: 'common',
    effect: '+1% power', mods: [{ stat: 'power', mul: 1.01 }] },
  { id: 'ecu-remap', name: 'Stage 2 ECU Remap', slot: 'ignition', rarity: 'rare',
    effect: '+6% power', mods: [{ stat: 'power', mul: 1.06 }] },

  { id: 'sport-exhaust', name: 'Sport Exhaust', slot: 'exhaust', rarity: 'uncommon',
    effect: '+4% power', mods: [{ stat: 'power', mul: 1.04 }] },
  { id: 'titanium-exhaust', name: 'Titanium Race Exhaust', slot: 'exhaust', rarity: 'epic',
    effect: '+6% power, -8 kg', mods: [{ stat: 'power', mul: 1.06 }, { stat: 'mass', add: -8 }] },

  { id: 'sport-cams', name: 'Sport Camshaft', slot: 'camshaft', rarity: 'uncommon',
    effect: '+3% power', mods: [{ stat: 'power', mul: 1.03 }] },
  { id: 'race-cams', name: 'Race Camshaft', slot: 'camshaft', rarity: 'epic',
    effect: '+6% power', mods: [{ stat: 'power', mul: 1.06 }] },

  { id: 'uprated-valve-springs', name: 'Uprated Valve Springs', slot: 'valves', rarity: 'common',
    effect: '+1% power', mods: [{ stat: 'power', mul: 1.01 }] },
  { id: 'titanium-valvetrain', name: 'Titanium Valvetrain', slot: 'valves', rarity: 'rare',
    effect: '+4% power', mods: [{ stat: 'power', mul: 1.04 }] },

  { id: 'stroker-kit', name: 'Stroker Kit', slot: 'displacement', rarity: 'rare',
    effect: '+7% power, +10 kg', mods: [{ stat: 'power', mul: 1.07 }, { stat: 'mass', add: 10 }] },
  { id: 'big-bore-rebuild', name: 'Big Bore Rebuild', slot: 'displacement', rarity: 'legendary',
    effect: '+12% power, +15 kg', mods: [{ stat: 'power', mul: 1.12 }, { stat: 'mass', add: 15 }] },

  /* ----- Platform & Handling ----- */
  { id: 'sport-brake-pads', name: 'Sport Brake Pads', slot: 'brakes', rarity: 'common',
    effect: '+3% braking', mods: [{ stat: 'brake', mul: 1.03 }] },
  { id: 'big-brake-kit', name: 'Big Brake Kit', slot: 'brakes', rarity: 'rare',
    effect: '+7% braking, +8 kg', mods: [{ stat: 'brake', mul: 1.07 }, { stat: 'mass', add: 8 }] },
  { id: 'carbon-ceramic-brakes', name: 'Carbon Ceramic Brakes', slot: 'brakes', rarity: 'legendary',
    effect: '+12% braking, -15 kg', mods: [{ stat: 'brake', mul: 1.12 }, { stat: 'mass', add: -15 }] },

  { id: 'lowering-springs', name: 'Lowering Springs', slot: 'springs', rarity: 'common',
    effect: '+2% cornering', mods: [{ stat: 'cornerGrip', mul: 1.02 }] },
  { id: 'coilovers', name: 'Adjustable Coilovers', slot: 'springs', rarity: 'rare',
    effect: '+4% cornering, steadier laps', mods: [{ stat: 'cornerGrip', mul: 1.04 }, { stat: 'consistency', mul: 0.9 }] },
  { id: 'race-suspension', name: 'Race Suspension', slot: 'springs', rarity: 'epic',
    effect: '+7% cornering, steadier laps', mods: [{ stat: 'cornerGrip', mul: 1.07 }, { stat: 'consistency', mul: 0.8 }] },

  { id: 'sport-anti-roll-bars', name: 'Sport Anti-roll Bars', slot: 'antiRollBars', rarity: 'uncommon',
    effect: '+2% cornering', mods: [{ stat: 'cornerGrip', mul: 1.02 }] },
  { id: 'race-anti-roll-bars', name: 'Race Anti-roll Bars', slot: 'antiRollBars', rarity: 'epic',
    effect: '+4% cornering', mods: [{ stat: 'cornerGrip', mul: 1.04 }] },

  { id: 'strut-braces', name: 'Strut Tower Braces', slot: 'chassisReinforcement', rarity: 'common',
    effect: '+1% cornering, +4 kg', mods: [{ stat: 'cornerGrip', mul: 1.01 }, { stat: 'mass', add: 4 }] },
  { id: 'roll-cage', name: 'Bolt-in Roll Cage', slot: 'chassisReinforcement', rarity: 'rare',
    effect: '+3% cornering, steadier laps, +25 kg',
    mods: [{ stat: 'cornerGrip', mul: 1.03 }, { stat: 'consistency', mul: 0.9 }, { stat: 'mass', add: 25 }] },
  { id: 'seam-welded-shell', name: 'Seam Welded Shell', slot: 'chassisReinforcement', rarity: 'legendary',
    effect: '+5% cornering, steadier laps, +10 kg',
    mods: [{ stat: 'cornerGrip', mul: 1.05 }, { stat: 'consistency', mul: 0.8 }, { stat: 'mass', add: 10 }] },

  { id: 'stripped-interior', name: 'Stripped Interior', slot: 'weightReduction', rarity: 'common',
    effect: '-12 kg', mods: [{ stat: 'mass', add: -12 }] },
  { id: 'polycarbonate-glass', name: 'Polycarbonate Windows', slot: 'weightReduction', rarity: 'uncommon',
    effect: '-22 kg', mods: [{ stat: 'mass', add: -22 }] },
  { id: 'carbon-seats', name: 'Carbon Bucket Seats', slot: 'weightReduction', rarity: 'rare',
    effect: '-30 kg', mods: [{ stat: 'mass', add: -30 }] },
  { id: 'carbon-panels', name: 'Carbon Body Panels', slot: 'weightReduction', rarity: 'epic',
    effect: '-80 kg', mods: [{ stat: 'mass', add: -80 }] },
  { id: 'titanium-rebuild', name: 'Titanium Rebuild', slot: 'weightReduction', rarity: 'legendary',
    effect: '-140 kg', mods: [{ stat: 'mass', add: -140 }] },

  /* ----- Drivetrain ----- */
  { id: 'sport-clutch', name: 'Sport Clutch', slot: 'clutch', rarity: 'common',
    effect: '+3% traction', mods: [{ stat: 'traction', mul: 1.03 }] },
  { id: 'twin-plate-clutch', name: 'Twin Plate Race Clutch', slot: 'clutch', rarity: 'rare',
    effect: '+6% traction, +1% efficiency', mods: [{ stat: 'traction', mul: 1.06 }, { stat: 'driveline', mul: 1.01 }] },

  { id: 'close-ratio-gearbox', name: 'Close Ratio Gearbox', slot: 'transmission', rarity: 'uncommon',
    effect: '+2% efficiency', mods: [{ stat: 'driveline', mul: 1.02 }] },
  { id: 'sequential-gearbox', name: 'Sequential Gearbox', slot: 'transmission', rarity: 'epic',
    effect: '+4% efficiency', mods: [{ stat: 'driveline', mul: 1.04 }] },

  { id: 'carbon-driveshaft', name: 'Carbon Driveshaft', slot: 'driveline', rarity: 'uncommon',
    effect: '+1.5% efficiency, -5 kg', mods: [{ stat: 'driveline', mul: 1.015 }, { stat: 'mass', add: -5 }] },
  { id: 'race-driveline', name: 'Race Driveline', slot: 'driveline', rarity: 'rare',
    effect: '+3% efficiency, -8 kg', mods: [{ stat: 'driveline', mul: 1.03 }, { stat: 'mass', add: -8 }] },

  { id: 'limited-slip-diff', name: 'Limited Slip Differential', slot: 'differential', rarity: 'uncommon',
    effect: '+5% traction', mods: [{ stat: 'traction', mul: 1.05 }] },
  { id: 'active-diff', name: 'Active Differential', slot: 'differential', rarity: 'legendary',
    effect: '+10% traction, +2% cornering', mods: [{ stat: 'traction', mul: 1.1 }, { stat: 'cornerGrip', mul: 1.02 }] },

  /* ----- Tires & Rims ----- */
  { id: 'street-tires', name: 'Street Compound', slot: 'tireCompound', rarity: 'common',
    effect: '+1% grip', mods: [{ stat: 'tireGrip', mul: 1.01 }] },
  { id: 'track-day-tires', name: 'Track Day Compound', slot: 'tireCompound', rarity: 'uncommon',
    effect: '+2% grip', mods: [{ stat: 'tireGrip', mul: 1.02 }] },
  { id: 'sport-tires', name: 'Sport Compound', slot: 'tireCompound', rarity: 'rare',
    effect: '+3% grip', mods: [{ stat: 'tireGrip', mul: 1.03 }] },
  { id: 'racing-slicks', name: 'Racing Slicks', slot: 'tireCompound', rarity: 'epic',
    effect: '+6% grip', mods: [{ stat: 'tireGrip', mul: 1.06 }] },
  { id: 'qualifying-softs', name: 'Qualifying Softs', slot: 'tireCompound', rarity: 'legendary',
    effect: '+9% grip', mods: [{ stat: 'tireGrip', mul: 1.09 }] },

  { id: 'wider-front-tires', name: 'Wider Front Tires', slot: 'frontTireWidth', rarity: 'common',
    effect: '+2% cornering, +0.005 drag', mods: [{ stat: 'cornerGrip', mul: 1.02 }, { stat: 'dragArea', add: 0.005 }] },
  { id: 'max-front-width', name: 'Maximum Front Width', slot: 'frontTireWidth', rarity: 'rare',
    effect: '+4% cornering, +0.01 drag', mods: [{ stat: 'cornerGrip', mul: 1.04 }, { stat: 'dragArea', add: 0.01 }] },

  { id: 'wider-rear-tires', name: 'Wider Rear Tires', slot: 'rearTireWidth', rarity: 'common',
    effect: '+4% traction, +0.005 drag', mods: [{ stat: 'traction', mul: 1.04 }, { stat: 'dragArea', add: 0.005 }] },
  { id: 'max-rear-width', name: 'Maximum Rear Width', slot: 'rearTireWidth', rarity: 'rare',
    effect: '+8% traction, +1% cornering, +0.01 drag',
    mods: [{ stat: 'traction', mul: 1.08 }, { stat: 'cornerGrip', mul: 1.01 }, { stat: 'dragArea', add: 0.01 }] },

  { id: 'forged-wheels', name: 'Forged Wheels', slot: 'rims', rarity: 'common',
    effect: '-15 kg', mods: [{ stat: 'mass', add: -15 }] },
  { id: 'magnesium-wheels', name: 'Magnesium Race Wheels', slot: 'rims', rarity: 'epic',
    effect: '-28 kg', mods: [{ stat: 'mass', add: -28 }] },

  { id: 'plus-one-rims', name: 'Plus One Rims', slot: 'rimSize', rarity: 'common',
    effect: '+1% cornering, +6 kg', mods: [{ stat: 'cornerGrip', mul: 1.01 }, { stat: 'mass', add: 6 }] },
  { id: 'plus-two-rims', name: 'Plus Two Rims', slot: 'rimSize', rarity: 'uncommon',
    effect: '+2% cornering, +10 kg', mods: [{ stat: 'cornerGrip', mul: 1.02 }, { stat: 'mass', add: 10 }] },

  /* ----- Aero & Appearance ----- */
  { id: 'lip-spoiler', name: 'Lip Spoiler', slot: 'frontBumper', rarity: 'common',
    effect: '+0.10 downforce area', mods: [{ stat: 'liftArea', add: 0.1 }] },
  { id: 'race-front-bumper', name: 'Race Front Bumper', slot: 'frontBumper', rarity: 'rare',
    effect: '+0.25 downforce, -0.01 drag', mods: [{ stat: 'liftArea', add: 0.25 }, { stat: 'dragArea', add: -0.01 }] },
  { id: 'splitter-diffuser', name: 'Splitter and Diffuser', slot: 'frontBumper', rarity: 'epic',
    effect: '+0.60 downforce area', mods: [{ stat: 'liftArea', add: 0.6 }] },

  { id: 'rear-diffuser', name: 'Rear Diffuser', slot: 'rearBumper', rarity: 'uncommon',
    effect: '+0.15 downforce area', mods: [{ stat: 'liftArea', add: 0.15 }] },
  { id: 'race-diffuser', name: 'Race Diffuser', slot: 'rearBumper', rarity: 'epic',
    effect: '+0.40 downforce area', mods: [{ stat: 'liftArea', add: 0.4 }] },

  { id: 'ducktail-spoiler', name: 'Ducktail Spoiler', slot: 'rearWing', rarity: 'uncommon',
    effect: '+0.20 downforce area', mods: [{ stat: 'liftArea', add: 0.2 }] },
  { id: 'gt-wing', name: 'GT Wing', slot: 'rearWing', rarity: 'rare',
    effect: '+0.35 downforce, +0.03 drag', mods: [{ stat: 'liftArea', add: 0.35 }, { stat: 'dragArea', add: 0.03 }] },
  { id: 'dtm-aero', name: 'DTM Aero Package', slot: 'rearWing', rarity: 'legendary',
    effect: '+1.00 downforce, +0.05 drag', mods: [{ stat: 'liftArea', add: 1.0 }, { stat: 'dragArea', add: 0.05 }] },
  { id: 'active-wing', name: 'Active Rear Wing', slot: 'rearWing', rarity: 'legendary',
    effect: '-0.08 drag area', mods: [{ stat: 'dragArea', add: -0.08 }] },

  { id: 'low-drag-mirrors', name: 'Low Drag Mirrors', slot: 'sideSkirts', rarity: 'common',
    effect: '-0.02 drag area', mods: [{ stat: 'dragArea', add: -0.02 }] },
  { id: 'aero-side-skirts', name: 'Aero Side Skirts', slot: 'sideSkirts', rarity: 'uncommon',
    effect: '-0.03 drag area', mods: [{ stat: 'dragArea', add: -0.03 }] },
  { id: 'race-side-skirts', name: 'Race Side Skirts', slot: 'sideSkirts', rarity: 'rare',
    effect: '+0.10 downforce, -0.02 drag', mods: [{ stat: 'liftArea', add: 0.1 }, { stat: 'dragArea', add: -0.02 }] },

  { id: 'vented-hood', name: 'Vented Hood', slot: 'hood', rarity: 'uncommon',
    effect: '+0.05 downforce, -5 kg', mods: [{ stat: 'liftArea', add: 0.05 }, { stat: 'mass', add: -5 }] },
  { id: 'carbon-hood', name: 'Carbon Fibre Hood', slot: 'hood', rarity: 'rare',
    effect: '-12 kg', mods: [{ stat: 'mass', add: -12 }] },

  /* ----- Conversion ----- */
  { id: 'v8-swap', name: 'V8 Engine Swap', slot: 'engineSwap', rarity: 'epic',
    effect: '+25% power, +60 kg', mods: [{ stat: 'power', mul: 1.25 }, { stat: 'mass', add: 60 }] },
  { id: 'race-engine', name: 'Full Race Engine', slot: 'engineSwap', rarity: 'legendary',
    effect: '+20% power', mods: [{ stat: 'power', mul: 1.2 }] },

  { id: 'rwd-conversion', name: 'RWD Conversion', slot: 'drivetrainSwap', rarity: 'rare',
    effect: 'Converts to RWD, +15 kg', mods: [{ stat: 'drive', set: 'rwd' }, { stat: 'mass', add: 15 }] },
  { id: 'awd-conversion', name: 'AWD Conversion', slot: 'drivetrainSwap', rarity: 'epic',
    effect: 'Converts to AWD, +60 kg', mods: [{ stat: 'drive', set: 'awd' }, { stat: 'mass', add: 60 }] },

  { id: 'supercharger', name: 'Supercharger', slot: 'aspiration', rarity: 'rare',
    effect: '+8% power, +15 kg', mods: [{ stat: 'power', mul: 1.08 }, { stat: 'mass', add: 15 }] },
  { id: 'big-turbo', name: 'Big Turbo Kit', slot: 'aspiration', rarity: 'epic',
    effect: '+12% power', mods: [{ stat: 'power', mul: 1.12 }] },
  { id: 'twin-turbo', name: 'Twin Turbo Kit', slot: 'aspiration', rarity: 'legendary',
    effect: '+18% power, +25 kg', mods: [{ stat: 'power', mul: 1.18 }, { stat: 'mass', add: 25 }] },
];

// Chance each pack card is a car (the rest are parts). Rolled after rarity,
// so pack odds stay as advertised and cars don't get buried as parts grow.
export const CAR_CARD_SHARE = 0.35;

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
