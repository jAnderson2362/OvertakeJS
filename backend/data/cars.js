// Car seed data. The MongoDB `cars` collection is seeded/synced from this
// list at startup, and it doubles as the in-memory fallback when no DB is
// reachable (see data/store.js).
//
// Figures are from manufacturer data / published instrumented tests:
//   power       - peak crank power in kW
//   mass        - curb weight (kg) + 75 kg driver
//   dragArea    - Cd * A in m^2 (aerodynamic drag area)
//   liftArea    - -Cl * A in m^2 (downforce area; 0 for cars with negligible downforce)
//   tireGrip    - peak lateral friction coefficient on factory-option track tires
//   topSpeed    - manufacturer top speed, km/h
//   drive       - 'rwd' | 'awd' | 'fwd' (sets launch traction fraction)
//   ev          - electric (higher driveline efficiency, no fuel burn)
//   fuelPerKm   - fuel consumed at race pace, kg/km
//   consistency - per-lap pace variation (1 sigma, fraction of lap time)

export const seedCars = [
  {
    id: 'mazda-mx5',
    name: 'Mazda MX-5 (ND)',
    hp: 181, power: 135, mass: 1137,
    dragArea: 0.66, liftArea: 0, tireGrip: 0.98,
    topSpeed: 219, drive: 'rwd', ev: false,
    fuelPerKm: 0.14, consistency: 0.0025,
    class: 'Roadster', country: 'JP', year: 2019,
  },
  {
    id: 'civic-type-r',
    name: 'Honda Civic Type R (FL5)',
    hp: 315, power: 235, mass: 1504,
    dragArea: 0.77, liftArea: 0.15, tireGrip: 1.06,
    topSpeed: 275, drive: 'fwd', ev: false,
    fuelPerKm: 0.17, consistency: 0.0025,
    class: 'Hot Hatch', country: 'JP', year: 2023,
  },
  {
    id: 'gr-supra',
    name: 'Toyota GR Supra 3.0',
    hp: 382, power: 285, mass: 1615,
    dragArea: 0.68, liftArea: 0, tireGrip: 1.04,
    topSpeed: 250, drive: 'rwd', ev: false,
    fuelPerKm: 0.19, consistency: 0.003,
    class: 'Sports', country: 'JP', year: 2021,
  },
  {
    id: 'bmw-m3-comp',
    name: 'BMW M3 Competition',
    hp: 503, power: 375, mass: 1805,
    dragArea: 0.76, liftArea: 0, tireGrip: 1.05,
    topSpeed: 290, drive: 'rwd', ev: false,
    fuelPerKm: 0.22, consistency: 0.003,
    class: 'Super Sedan', country: 'DE', year: 2021,
  },
  {
    id: 'porsche-911-gt3',
    name: 'Porsche 911 GT3 (992)',
    hp: 502, power: 375, mass: 1510,
    dragArea: 0.72, liftArea: 1.30, tireGrip: 1.22,
    topSpeed: 318, drive: 'rwd', ev: false,
    fuelPerKm: 0.21, consistency: 0.002,
    class: 'Track Special', country: 'DE', year: 2022,
  },
  {
    id: 'cayman-gt4-rs',
    name: 'Porsche Cayman GT4 RS',
    hp: 493, power: 368, mass: 1490,
    dragArea: 0.74, liftArea: 1.10, tireGrip: 1.21,
    topSpeed: 315, drive: 'rwd', ev: false,
    fuelPerKm: 0.21, consistency: 0.002,
    class: 'Track Special', country: 'DE', year: 2022,
  },
  {
    id: 'corvette-z06',
    name: 'Chevrolet Corvette Z06',
    hp: 670, power: 500, mass: 1636,
    dragArea: 0.86, liftArea: 0.90, tireGrip: 1.18,
    topSpeed: 313, drive: 'rwd', ev: false,
    fuelPerKm: 0.24, consistency: 0.003,
    class: 'Supercar', country: 'US', year: 2023,
  },
  {
    id: 'ferrari-296',
    name: 'Ferrari 296 GTB',
    hp: 819, power: 610, mass: 1545,
    dragArea: 0.73, liftArea: 1.00, tireGrip: 1.18,
    topSpeed: 330, drive: 'rwd', ev: false,
    fuelPerKm: 0.23, consistency: 0.0025,
    class: 'Supercar', country: 'IT', year: 2022,
  },
  {
    id: 'huracan-evo',
    name: 'Lamborghini Huracán EVO',
    hp: 631, power: 470, mass: 1497,
    dragArea: 0.78, liftArea: 0.40, tireGrip: 1.15,
    topSpeed: 325, drive: 'awd', ev: false,
    fuelPerKm: 0.25, consistency: 0.003,
    class: 'Supercar', country: 'IT', year: 2020,
  },
  {
    id: 'gtr-nismo',
    name: 'Nissan GT-R Nismo',
    hp: 600, power: 447, mass: 1795,
    dragArea: 0.83, liftArea: 0.35, tireGrip: 1.12,
    topSpeed: 315, drive: 'awd', ev: false,
    fuelPerKm: 0.24, consistency: 0.003,
    class: 'Supercar', country: 'JP', year: 2020,
  },
  {
    id: 'mclaren-720s',
    name: 'McLaren 720S',
    hp: 710, power: 530, mass: 1494,
    dragArea: 0.66, liftArea: 0.60, tireGrip: 1.17,
    topSpeed: 341, drive: 'rwd', ev: false,
    fuelPerKm: 0.23, consistency: 0.003,
    class: 'Supercar', country: 'GB', year: 2018,
  },
  {
    id: 'model-s-plaid',
    name: 'Tesla Model S Plaid',
    hp: 1020, power: 760, mass: 2237,
    dragArea: 0.58, liftArea: 0, tireGrip: 1.04,
    topSpeed: 322, drive: 'awd', ev: true,
    fuelPerKm: 0, consistency: 0.002,
    class: 'EV Sedan', country: 'US', year: 2021,
  },
];

// Launch traction: fraction of total weight over the driven axle,
// including dynamic load transfer under acceleration.
export const DRIVE_TRACTION = { fwd: 0.55, rwd: 0.72, awd: 1.0 };
