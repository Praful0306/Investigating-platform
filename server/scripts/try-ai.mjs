// Live check of the AI pipeline: node scripts/try-ai.mjs <easy|medium|hard> "<premise>" [--show-solution]
// Uses AI_PROVIDERS from server/.env, so this spends real quota. Run it a handful of times at most.
import { env } from '../src/config/env.js';
import { DIFFICULTY } from '../src/config/difficulty.js';
import { buildProvidersFromEnv, createAiService } from '../src/services/ai/index.js';

const argv = process.argv.slice(2);
const showSolution = argv.includes('--show-solution');
const [difficulty, premise = ''] = argv.filter((a) => !a.startsWith('--'));
const usage = () => {
  console.error('Usage: node scripts/try-ai.mjs <easy|medium|hard> "<premise, 10-300 chars>" [--show-solution]');
  process.exit(1);
};
if (!DIFFICULTY[difficulty] || premise.trim().length < 10 || premise.trim().length > 300) usage();

const providers = buildProvidersFromEnv(env);
if (!providers.length) {
  console.error('No AI provider is configured. Set AI_PROVIDERS and the matching keys in server/.env.');
  process.exit(1);
}

try {
  const { data, meta } = await createAiService(providers).generateCase({ premise: premise.trim(), difficulty });
  const rows = {
    provider: meta.provider, model: meta.model, attempts: meta.attempts, latencyMs: meta.latencyMs,
    suspects: data.suspects.length, clues: data.clues.length, hints: data.hints.length, title: data.title,
  };
  for (const [k, v] of Object.entries(rows)) console.log(`${`${k}:`.padEnd(11)}${v}`);
  if (showSolution) console.log('\nSOLUTION', JSON.stringify(data.solution, null, 2));
} catch (err) {
  console.error(`Generation failed: ${err.code ?? 'ERROR'} - ${err.message}`);
  process.exit(1);
}
