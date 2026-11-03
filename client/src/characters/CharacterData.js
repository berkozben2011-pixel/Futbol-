export const CharactersDatabase = {
  berk: {
    id: 'berk',
    name: 'Berk',
    role: 'Balanced',
    color: 0x2196f3,
    modelPath: 'assets/models/characters/berk.glb',
    celebrationModelPath: 'assets/models/characters/berkgoal.glb',
    stats: { speed: 75, acceleration: 75, shootPower: 80, shootAccuracy: 80, pass: 80, ballControl: 80, defense: 60, stamina: 80 }
  },
  erdogan: {
    id: 'erdogan',
    name: 'Erdoğan',
    role: 'Defender / Physical',
    color: 0x8d6e63,
    modelPath: 'assets/models/characters/erdogan.glb',
    celebrationModelPath: 'assets/models/characters/erdogangoal.glb',
    stats: { speed: 65, acceleration: 65, shootPower: 70, shootAccuracy: 60, pass: 65, ballControl: 60, defense: 90, stamina: 95 }
  },
  koray: {
    id: 'koray',
    name: 'Koray',
    role: 'Midfielder / Technical',
    color: 0xffc107,
    modelPath: 'assets/models/characters/koray.glb',
    celebrationModelPath: 'assets/models/characters/koraygoal.glb',
    stats: { speed: 70, acceleration: 70, shootPower: 75, shootAccuracy: 85, pass: 92, ballControl: 90, defense: 65, stamina: 85 }
  },
  yanki: {
    id: 'yanki',
    name: 'Yankı',
    role: 'Winger / Forward',
    color: 0xff5252,
    modelPath: 'assets/models/characters/yanki.glb',
    celebrationModelPath: 'assets/models/characters/yankigoal.glb',
    stats: { speed: 90, acceleration: 92, shootPower: 85, shootAccuracy: 75, pass: 70, ballControl: 85, defense: 40, stamina: 75 }
  },
  erenarda: {
    id: 'erenarda',
    name: 'Eren Arda',
    role: 'Forward / Finisher',
    color: 0x9c27b0,
    modelPath: 'assets/models/characters/erenarda.glb',
    celebrationModelPath: 'assets/models/characters/erenardagoal.glb',
    stats: { speed: 80, acceleration: 82, shootPower: 88, shootAccuracy: 88, pass: 75, ballControl: 82, defense: 45, stamina: 80 }
  },
  kaan: {
    id: 'kaan',
    name: 'Kaan',
    role: 'Striker / Power',
    color: 0x00bcd4,
    modelPath: 'assets/models/characters/kaan.glb',
    celebrationModelPath: 'assets/models/characters/kaangoal.glb',
    stats: { speed: 78, acceleration: 76, shootPower: 92, shootAccuracy: 78, pass: 68, ballControl: 76, defense: 50, stamina: 78 }
  },
  ruzgar: {
    id: 'ruzgar',
    name: 'Rüzgar',
    role: 'Speedster / Winger',
    color: 0x4caf50,
    modelPath: 'assets/models/characters/ruzgar.glb',
    celebrationModelPath: 'assets/models/characters/ruzgargoal.glb',
    stats: { speed: 94, acceleration: 95, shootPower: 74, shootAccuracy: 72, pass: 72, ballControl: 84, defense: 35, stamina: 72 }
  },
  cigdemoglu: {
    id: 'cigdemoglu',
    name: 'Çiğdemoğlu',
    role: 'Playmaker',
    color: 0xe91e63,
    modelPath: 'assets/models/characters/cigdemoglu.glb',
    celebrationModelPath: 'assets/models/characters/cigdemoglugoal.glb',
    stats: { speed: 68, acceleration: 70, shootPower: 72, shootAccuracy: 82, pass: 94, ballControl: 92, defense: 58, stamina: 82 }
  },
  ahmet: {
    id: 'ahmet',
    name: 'Ahmet',
    role: 'Defensive Midfielder',
    color: 0x607d8b,
    modelPath: 'assets/models/characters/ahmet.glb',
    celebrationModelPath: 'assets/models/characters/ahmetgoal.glb',
    stats: { speed: 68, acceleration: 66, shootPower: 72, shootAccuracy: 66, pass: 78, ballControl: 72, defense: 86, stamina: 90 }
  },
  kandemir: {
    id: 'kandemir',
    name: 'Kandemir',
    role: 'Centre Back / Wall',
    color: 0x795548,
    modelPath: 'assets/models/characters/kandemir.glb',
    celebrationModelPath: 'assets/models/characters/kandemirgoal.glb',
    stats: { speed: 62, acceleration: 60, shootPower: 68, shootAccuracy: 58, pass: 64, ballControl: 58, defense: 94, stamina: 92 }
  },
  kemal: {
    id: 'kemal',
    name: 'Kemal',
    role: 'All-rounder',
    color: 0xff9800,
    modelPath: 'assets/models/characters/kemal.glb',
    celebrationModelPath: 'assets/models/characters/kemalgoal.glb',
    stats: { speed: 76, acceleration: 74, shootPower: 78, shootAccuracy: 78, pass: 78, ballControl: 78, defense: 70, stamina: 80 }
  }
};

export function getCharacterData(id) {
  return CharactersDatabase[id] || CharactersDatabase['berk'];
}

export function getAllCharacterIds() {
  return Object.keys(CharactersDatabase);
}
