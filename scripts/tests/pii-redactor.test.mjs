// Run: node scripts/tests/pii-redactor.test.mjs   (Node 23.6+ strips TS types natively)
import { redactPII, redactAIContent } from '../../supabase/functions/_shared/pii-redactor.ts';
const R = '[REDACTED]';
const cases = [
  ['Hi! My name is Anna Tan and I\'m looking for a movie to watch with my husband Michael', `Hi! My name is ${R} and I'm looking for a movie to watch with my husband ${R}`],
  ['[REDACTED] and Michael! I\'m FlixBuddy, your guide to HogFlix.', `${R} and ${R}! I'm FlixBuddy, your guide to HogFlix.`],
  ['Hi Anna and Michael! Try 🎬 **Prickly Blinders** or **Breaking Spines**.', `Hi ${R} and ${R}! Try 🎬 **Prickly Blinders** or **Breaking Spines**.`],
  ['Contact John Smith at john@example.com or +1 415 555 0199', `Contact ${R} at ${R} or ${R}`],
  ['Based on what you\'re looking for, I\'d recommend:\n\n🎬 **Hulk Hog: Standup Special** - Hulk Hog takes the stage in Hogville!', 'Based on what you\'re looking for, I\'d recommend:\n\n🎬 **Hulk Hog: Standup Special** - Hulk Hog takes the stage in Hogville!'],
  ['I am looking for something funny', 'I am looking for something funny'],
  ['Call me Sam, I live at 221 Baker Street', `Call me ${R}, I live at ${R}`],
  ['Thanks, Priya! Enjoy The Grand Budapest Hedgehog tonight.', `Thanks, ${R}! Enjoy The Grand Budapest Hedgehog tonight.`],
  ['Tell Dr. Watson I said hi', `Tell ${R} I said hi`],
  ['Watch it with Maria and Jonas this weekend', `Watch it with ${R} and ${R} this weekend`],
  // Real FlixBuddy replies must come through untouched
  ...[
    "Here are series you won't be able to stop watching:\n\n1. **Prickly Blinders** - Period crime drama, 6 seasons (⭐ 9.1)\n2. **Breaking Spines** - A chemistry teacher hedgehog turns to crime, 5 seasons",
    "**Breaking Spines** has:\n\n📺 5 Seasons, 62 episodes total\n⏱️ Episodes are ~47 minutes each\n\nPerfect for a weekend binge! Plus, there's **Better Call Saul-hog**",
    'If you loved The Hog Father, here are similar crime dramas:\n\n1. **Goodfellas: Hedgehog Edition** - Rise and fall of a mob hedgehog (⭐ 8.7)',
    'Would you like more details about any of these, or should I look for something different?',
  ].map(t => [t, t]),
  ['My email is anna.tan@gmail.com and my number is +65 8123 4567', `My email is ${R} and my number is ${R}`],
];
let fail = 0;
for (const [input, want] of cases) {
  const got = redactPII(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(input));
  if (!ok) console.log('   got :', JSON.stringify(got), '\n   want:', JSON.stringify(want));
}
// Conversation-level: a name given in the prompt is masked in the reply too
const convo = redactAIContent([
  { role: 'user', content: 'Hi! My name is Anna Tan, I want a funny movie to watch with my husband Michael tonight.' },
  { role: 'assistant', content: "Hi Anna! I'd love to help you and Michael pick a movie. Try **Hulk Hog: Standup Special**." },
]);
const wantReply = `Hi ${R}! I'd love to help you and ${R} pick a movie. Try **Hulk Hog: Standup Special**.`;
const convoOk = convo[1].content === wantReply;
if (!convoOk) { fail++; console.log('FAIL conversation', JSON.stringify(convo[1].content)); } else console.log('PASS conversation: reply masks names from the prompt');
console.log(`\n${cases.length + 1 - fail}/${cases.length + 1} passed`);
process.exit(fail ? 1 : 0);
