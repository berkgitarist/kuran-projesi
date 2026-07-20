function assignVerse(index, sura, verse, payload) {
  if (sura === null || sura === undefined || verse === null || verse === undefined) return;

  const key = `${String(sura)}:${String(verse)}`;
  const normalizedPayload = typeof payload === 'string'
    ? { text: payload }
    : {
        text: payload?.text || payload?.translation || '',
        translation: payload?.translation || '',
        arabic: payload?.arabic || payload?.verse || ''
      };

  if (!normalizedPayload.text && normalizedPayload.translation) {
    normalizedPayload.text = normalizedPayload.translation;
  }

  index[key] = normalizedPayload;
}

export function normalizeMealData(meal) {
  const index = Object.create(null);

  if (!meal) return index;

  if (Array.isArray(meal?.sures)) {
    meal.sures.forEach((sure, suraIndex) => {
      if (!Array.isArray(sure?.ayetler)) return;

      sure.ayetler.forEach((item) => {
        if (!Array.isArray(item)) return;
        assignVerse(index, suraIndex + 1, item[0], item[1]);
      });
    });
  }

  if (Array.isArray(meal)) {
    meal.forEach((sure, suraIndex) => {
      if (!Array.isArray(sure?.ayetler)) return;

      sure.ayetler.forEach((item) => {
        if (!Array.isArray(item)) return;
        assignVerse(index, suraIndex + 1, item[0], item[1]);
      });
    });
  }

  if (meal && typeof meal === 'object' && !Array.isArray(meal)) {
    for (const pageKey of Object.keys(meal)) {
      const suraData = meal[pageKey]?.sura;
      if (!suraData || typeof suraData !== 'object') continue;

      for (const sura of Object.keys(suraData)) {
        const verses = suraData[sura]?.verses;
        if (!verses || typeof verses !== 'object') continue;

        for (const verse of Object.keys(verses)) {
          assignVerse(index, sura, verse, verses[verse]);
        }
      }
    }
  }

  if (Array.isArray(meal?.surahs)) {
    meal.surahs.forEach((surah) => {
      if (!Array.isArray(surah?.verses)) return;

      surah.verses.forEach((verseObject) => {
        const verse = verseObject?.verse_number ?? verseObject?.verseNumber ?? verseObject?.id;

        assignVerse(index, surah.id, verse, {
          text: verseObject?.translation || verseObject?.text || verseObject?.verse || '',
          translation: verseObject?.translation || '',
          arabic: verseObject?.verse || ''
        });
      });
    });
  }

  return index;
}

export function normalizeMealCollection(meals) {
  const normalized = Object.create(null);

  for (const [mealName, mealData] of Object.entries(meals || {})) {
    normalized[mealName] = normalizeMealData(mealData);
  }

  return normalized;
}
