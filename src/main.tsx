import '@fontsource/amiri/400.css';
import './ui/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import rawVerbs from './data/verbs.json';
import { filterVerbs, validateParadigm } from './engine/validate';
import { App } from './ui/App';
import { createStore } from './ui/storage';
import { applyTheme } from './ui/theme';

// Ждём арабский шрифт до первого показа, иначе знаки сначала рисуются запасным шрифтом и «дорисовываются» после подгрузки.
async function waitForFont() {
  try {
    await Promise.race([
      document.fonts.load('1.7rem Amiri', '\u0628\u0651\u064e\u0652'),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // шрифт не обязателен для работы
  }
}

async function main() {
  applyTheme(createStore().load().theme);
  await waitForFont();
  const root = createRoot(document.getElementById('root')!);

  // Режим ?demo: только dev-сборка, TEST-фикстуры. В продакшен-сборку demo.ts не попадает.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { demoVerbs, demoRuleSources } = await import('./ui/demo');
    root.render(
      <StrictMode>
        <App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={() => demoRuleSources} />
      </StrictMode>,
    );
    return;
  }

  const { valid, rejected } = filterVerbs(rawVerbs as unknown[]);
  for (const r of rejected) console.warn('Глагол отклонён:', r.issues, r.verb);
  root.render(
    <StrictMode>
      <App verbs={valid} missingRuleSources={validateParadigm()} />
    </StrictMode>,
  );
}

void main();
