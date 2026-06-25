export interface EloLevel {
  id: number;
  name: string;
  emoji: string;
  elo_min: number;
  elo_max: number;
}

export const ELO_LEVELS: EloLevel[] = [
  { id: 1,  name: "Bonnet d'âne",  emoji: '🫏', elo_min: 0,    elo_max: 200  },
  { id: 2,  name: 'Profane',       emoji: '🙏', elo_min: 201,  elo_max: 500  },
  { id: 3,  name: "Tête en l'air", emoji: '🌬️', elo_min: 501,  elo_max: 900  },
  { id: 4,  name: 'Touriste',      emoji: '🧳', elo_min: 901,  elo_max: 1400 },
  { id: 5,  name: 'Curieux',       emoji: '🔍', elo_min: 1401, elo_max: 1900 },
  { id: 6,  name: 'Intello',       emoji: '🧠', elo_min: 1901, elo_max: 2500 },
  { id: 7,  name: 'Kogiteur',      emoji: '⚙️', elo_min: 2501, elo_max: 3100 },
  { id: 8,  name: 'Savant',        emoji: '📚', elo_min: 3101, elo_max: 3800 },
  { id: 9,  name: 'Nobel',         emoji: '🏆', elo_min: 3801, elo_max: 4500 },
  { id: 10, name: 'GPT',           emoji: '🤖', elo_min: 4501, elo_max: 5000 },
];

export function getEloLevel(elo: number): EloLevel {
  return (
    ELO_LEVELS.find(l => elo >= l.elo_min && elo <= l.elo_max) ??
    (elo < 0 ? ELO_LEVELS[0] : ELO_LEVELS[ELO_LEVELS.length - 1])
  );
}
