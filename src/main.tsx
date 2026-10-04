import '@fontsource/amiri/400.css';
import './ui/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import rawVerbs from './data/verbs.json';
import { filterVerbs, validateParadigm } from './engine/validate';
import { App } from './ui/App';
import { createStore } from './ui/storage';
import { applyTheme } from './ui/theme';

async function main() {
  applyTheme(createStore().load().theme);
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
