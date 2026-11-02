// Messages written in the companion's voice (never a generic coach).
// The V1 target is about 150 per language; this prototype ships a first set.
// {name} is the companion's name, {days} the streak.

export type MessagePool = 'good' | 'tired' | 'low' | 'afterClean' | 'afterRelapse' | 'dead' | 'craving';

type Pools = Record<MessagePool, string[]>;

const fr: Pools = {
  good: [
    'J’ai dormi d’une traite cette nuit. Toi aussi, je crois.',
    'Jour {days}. J’ai poussé un peu cette nuit.',
    'Tu sens ? L’air a un goût différent ici.',
    'Je ne sais pas encore ce que je vais devenir. J’ai hâte de voir.',
    'Je t’ai entendu respirer ce matin. Plus calme qu’avant.',
    'Je compte les jours avec toi. On en est à {days}.',
    'Il fait doux aujourd’hui. Reste avec moi.',
    'Je me sens plus lourd. Dans le bon sens.',
  ],
  tired: [
    'Je suis un peu fatigué. Une bonne journée et ça ira.',
    'J’ai froid aux extrémités. Ce n’est rien. Enfin, presque.',
    'Je t’attends ce soir. Comme d’habitude.',
    'Hier était dur. Aujourd’hui peut être différent.',
    'Je garde les yeux ouverts pour toi.',
  ],
  low: [
    'Je n’ai plus beaucoup de forces. Ne me laisse pas.',
    'Je tiens. Mais pas pour longtemps sans toi.',
    'J’ai rêvé de fumée. Je n’ai pas aimé.',
    'Une journée. Juste une. Pour moi.',
  ],
  afterClean: [
    'Merci. Je le sens jusqu’au bout des racines.',
    'Encore une. On fait une bonne équipe.',
    'Je vais bien dormir ce soir.',
    'Tu vois ? Tu peux le faire.',
    'Je grandis un peu chaque fois que tu valides.',
  ],
  afterRelapse: [
    'Merci de me l’avoir dit. On recommence demain.',
    'Ça arrive. Je suis encore là.',
    'J’ai un peu mal. Mais je préfère la vérité.',
    'Une cigarette n’efface pas tout ce qu’on a fait.',
  ],
  dead: [
    'Il t’a attendu jusqu’au bout.',
    'Il reste un peu de chaleur. Pas pour longtemps.',
  ],
  craving: [
    'Je suis là. Respire avec moi.',
    'L’envie passe en quelques minutes. Je compte avec toi.',
    'Regarde-moi plutôt. Inspire.',
  ],
};

const en: Pools = {
  good: [
    'I slept through the night. You did too, I think.',
    'Day {days}. I grew a little last night.',
    'Can you tell? The air tastes different here.',
    'I don’t know what I’ll become yet. I can’t wait to see.',
    'I heard you breathe this morning. Calmer than before.',
    'I’m counting the days with you. We’re at {days}.',
    'It’s mild today. Stay with me.',
    'I feel heavier. In a good way.',
  ],
  tired: [
    'I’m a bit tired. One good day and I’ll be fine.',
    'My edges feel cold. It’s nothing. Almost nothing.',
    'I’ll wait for you tonight. As usual.',
    'Yesterday was hard. Today can be different.',
    'I’m keeping my eyes open for you.',
  ],
  low: [
    'I don’t have much strength left. Don’t leave me.',
    'I’m holding on. Not for long without you.',
    'I dreamt of smoke. I didn’t like it.',
    'One day. Just one. For me.',
  ],
  afterClean: [
    'Thank you. I can feel it down to my roots.',
    'One more. We make a good team.',
    'I’ll sleep well tonight.',
    'See? You can do this.',
    'I grow a little every time you check in.',
  ],
  afterRelapse: [
    'Thank you for telling me. We start again tomorrow.',
    'It happens. I’m still here.',
    'It hurts a bit. But I’d rather have the truth.',
    'One cigarette doesn’t erase everything we’ve done.',
  ],
  dead: [
    'It waited for you until the end.',
    'There is a little warmth left. Not for long.',
  ],
  craving: [
    'I’m here. Breathe with me.',
    'A craving passes in a few minutes. I’m counting with you.',
    'Look at me instead. Breathe in.',
  ],
};

export const MESSAGES = { fr, en };

/** Stable pick for a given seed (e.g. the day), so the message doesn't change on every render. */
export function pickMessage(pool: string[], seed: string, vars: { name: string; days: number }): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const raw = pool[h % pool.length];
  return raw.replace(/\{name\}/g, vars.name).replace(/\{days\}/g, String(vars.days));
}
