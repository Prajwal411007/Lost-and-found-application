import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.resolve(__dirname, '../src/locales');
const enDir = path.join(localesDir, 'en');
const targetLangs = ['kn', 'hi'];

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkTranslations() {
  console.log('--- Checking i18n Parity across Languages ---');

  if (!fs.existsSync(enDir)) {
    console.error(`Error: English locale directory not found at ${enDir}`);
    process.exit(1);
  }

  const enFiles = fs.readdirSync(enDir).filter((file) => file.endsWith('.json'));
  let totalMissing = 0;
  let totalEnKeys = 0;

  for (const file of enFiles) {
    const enFilePath = path.join(enDir, file);
    const enContent = JSON.parse(fs.readFileSync(enFilePath, 'utf-8'));
    const enKeys = new Set(getKeys(enContent));
    totalEnKeys += enKeys.size;

    console.log(`\nChecking namespace file: ${file} (${enKeys.size} keys in English)`);

    for (const lang of targetLangs) {
      const targetFilePath = path.join(localesDir, lang, file);

      if (!fs.existsSync(targetFilePath)) {
        console.error(`  [FAIL] Missing translation file: ${lang}/${file}`);
        totalMissing += enKeys.size;
        continue;
      }

      let targetContent;
      try {
        targetContent = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8'));
      } catch (err) {
        console.error(`  [FAIL] JSON syntax error in ${lang}/${file}:`, err.message);
        totalMissing++;
        continue;
      }

      const targetKeys = new Set(getKeys(targetContent));
      const missingKeys = [];

      for (const key of enKeys) {
        if (!targetKeys.has(key)) {
          missingKeys.push(key);
        }
      }

      if (missingKeys.length > 0) {
        console.error(`  [FAIL] ${lang}/${file} is missing ${missingKeys.length} keys:`);
        missingKeys.forEach((k) => console.error(`    - ${k}`));
        totalMissing += missingKeys.length;
      } else {
        console.log(`  [PASS] ${lang}/${file} has 100% key parity (${targetKeys.size} keys)`);
      }
    }
  }

  console.log('\n----------------------------------------');
  if (totalMissing > 0) {
    console.error(`i18n check FAILED: ${totalMissing} missing keys found.`);
    process.exit(1);
  } else {
    console.log(`i18n check PASSED: All ${totalEnKeys} keys across ${enFiles.length} namespaces verified in [${targetLangs.join(', ')}]!`);
    process.exit(0);
  }
}

checkTranslations();
