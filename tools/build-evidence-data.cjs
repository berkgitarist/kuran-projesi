const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function fail(message) {
  console.error(`HATA: ${message}`);
  process.exit(1);
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, {
    recursive: true
  });
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Dosya bulunamadı: ${filePath}`);
  }

  const extension = path.extname(filePath).toLowerCase();

  try {
    if (extension === '.gz') {
      const compressed = fs.readFileSync(filePath);
      const uncompressed = zlib.gunzipSync(compressed);

      return JSON.parse(
        uncompressed.toString('utf8')
      );
    }

    return JSON.parse(
      fs.readFileSync(filePath, 'utf8')
    );
  } catch (error) {
    fail(
      `${filePath} okunamadı: ${error.message}`
    );
  }
}

function writeJson(filePath, value) {
  ensureDirectory(
    path.dirname(filePath)
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(value),
    'utf8'
  );
}

function normalizeTurkishData(rawTurkishData) {
  const verseIndex = Object.create(null);

  if (
    rawTurkishData &&
    typeof rawTurkishData === 'object' &&
    !Array.isArray(rawTurkishData)
  ) {
    for (
      const pageKey of Object.keys(rawTurkishData)
    ) {
      const pageObject =
        rawTurkishData[pageKey];

      const suraObject =
        pageObject?.sura;

      if (
        !suraObject ||
        typeof suraObject !== 'object'
      ) {
        continue;
      }

      for (
        const suraNumber of Object.keys(suraObject)
      ) {
        const verses =
          suraObject[suraNumber]?.verses;

        if (
          !verses ||
          typeof verses !== 'object'
        ) {
          continue;
        }

        for (
          const verseNumber of Object.keys(verses)
        ) {
          verseIndex[
            `${suraNumber}:${verseNumber}`
          ] = String(
            verses[verseNumber] || ''
          );
        }
      }
    }
  }

  return verseIndex;
}

function normalizeIndex(indexValue) {
  if (
    !indexValue ||
    typeof indexValue !== 'object'
  ) {
    return {};
  }

  return indexValue;
}

function getVerseId(reference) {
  if (!reference) {
    return null;
  }

  if (typeof reference === 'string') {
    return reference;
  }

  if (typeof reference === 'object') {
    return (
      reference.id ||
      reference.verse_id ||
      reference.verseId ||
      reference.ref ||
      null
    );
  }

  return null;
}

function main() {
  const [
    graphPathArgument,
    turkishPathArgument,
    outputPathArgument
  ] = process.argv.slice(2);

  if (
    !graphPathArgument ||
    !turkishPathArgument ||
    !outputPathArgument
  ) {
    console.log(`
Kullanım:

node tools/build-evidence-data.js <graph.json.gz> <quran_tr.json> <output>

Örnek:

node tools/build-evidence-data.js data/quran_numbered_6234_evidence_graph_v2_1.json.gz data/quran_tr.json data/evidence
`);

    process.exit(1);
  }

  const projectRoot =
    process.cwd();

  const graphPath =
    path.resolve(
      projectRoot,
      graphPathArgument
    );

  const turkishPath =
    path.resolve(
      projectRoot,
      turkishPathArgument
    );

  const outputPath =
    path.resolve(
      projectRoot,
      outputPathArgument
    );

  console.log(
    'Evidence graph okunuyor...'
  );

  const graph =
    readJsonFile(graphPath);

  console.log(
    'Türkçe ayet verisi okunuyor...'
  );

  const turkishData =
    readJsonFile(turkishPath);

  const turkishVerseIndex =
    normalizeTurkishData(turkishData);

  const verses =
    graph?.verses || {};

  const indexes =
    graph?.indexes || {};

  const suraGroups =
    Object.create(null);

  let verseCount = 0;
  let missingTurkishCount = 0;

  for (
    const verseId of Object.keys(verses)
  ) {
    const verse =
      verses[verseId] || {};

    const [
      suraFromId,
      verseFromId
    ] = verseId.split(':');

    const sura =
      String(
        verse.sura ??
        suraFromId
      );

    const verseNumber =
      String(
        verse.verse ??
        verseFromId
      );

    if (!suraGroups[sura]) {
      suraGroups[sura] =
        Object.create(null);
    }

    const turkishText =
      turkishVerseIndex[verseId] || '';

    if (!turkishText) {
      missingTurkishCount += 1;
    }

    suraGroups[sura][verseNumber] = {
      id: verseId,
      sura: Number(sura),
      verse: Number(verseNumber),
      text_en: String(
        verse.text_en || ''
      ),
      text_tr: turkishText,
      text_ar: String(
        verse.text_ar || ''
      ),
      previous_verse:
        getVerseId(
          verse.previous_verse
        ),
      next_verse:
        getVerseId(
          verse.next_verse
        ),
      content_words_en:
        Array.isArray(
          verse.content_words_en
        )
          ? verse.content_words_en
          : [],
      maximal_repeated_phrases_en:
        Array.isArray(
          verse.maximal_repeated_phrases_en
        )
          ? verse.maximal_repeated_phrases_en
          : [],
      lexical_neighbors:
        Array.isArray(
          verse.lexical_neighbors
        )
          ? verse.lexical_neighbors
          : [],
      similar_phrase_patterns:
        Array.isArray(
          verse.similar_phrase_patterns
        )
          ? verse.similar_phrase_patterns
          : [],
      topic_candidates:
        Array.isArray(
          verse.topic_candidates
        )
          ? verse.topic_candidates
          : [],
      filtered_theme_neighbors:
        Array.isArray(
          verse.filtered_theme_neighbors
        )
          ? verse.filtered_theme_neighbors
          : []
    };

    verseCount += 1;
  }

  ensureDirectory(outputPath);

  console.log(
    'Sure dosyaları yazılıyor...'
  );

  const suraNumbers =
    Object.keys(suraGroups)
      .sort(
        (left, right) =>
          Number(left) -
          Number(right)
      );

  for (
    const suraNumber of suraNumbers
  ) {
    writeJson(
      path.join(
        outputPath,
        'suras',
        `${suraNumber}.json`
      ),
      {
        sura: Number(suraNumber),
        verses:
          suraGroups[suraNumber]
      }
    );
  }

  console.log(
    'Arama indeksleri yazılıyor...'
  );

  writeJson(
    path.join(
      outputPath,
      'word-index-en.json'
    ),
    normalizeIndex(
      indexes.word_index_en
    )
  );

  writeJson(
    path.join(
      outputPath,
      'stem-index-en.json'
    ),
    normalizeIndex(
      indexes.stem_index_en
    )
  );

  writeJson(
    path.join(
      outputPath,
      'phrase-index-en.json'
    ),
    normalizeIndex(
      indexes.query_phrase_index_en
    )
  );

  writeJson(
    path.join(
      outputPath,
      'metadata.json'
    ),
    {
      generated_at:
        new Date().toISOString(),
      dataset_version:
        graph?.metadata?.version ||
        graph?.metadata?.dataset_version ||
        '2.1.0',
      release_name:
        graph?.metadata?.release_name ||
        '',
      verse_count:
        verseCount,
      sura_count:
        suraNumbers.length,
      missing_turkish_count:
        missingTurkishCount,
      validation_passed:
        graph?.validation?.passed === true,
      source_notice:
        'Bu araç yalnızca Numbered Verse Evidence Graph v2.1 veri setini kullanır. Veri seti 6.234 numaralı ayeti içerir.',
      unnumbered_basmala_notice:
        '112 numarasız Besmele bu veri sürümüne dahil değildir.'
    }
  );

  console.log('');
  console.log('İşlem tamamlandı.');
  console.log(
    `Ayet sayısı: ${verseCount}`
  );
  console.log(
    `Sure sayısı: ${suraNumbers.length}`
  );
  console.log(
    `Türkçe metni bulunamayan ayet: ${missingTurkishCount}`
  );
  console.log(
    `Çıktı klasörü: ${outputPath}`
  );
}

main();