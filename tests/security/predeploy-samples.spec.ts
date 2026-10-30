/**
 * Ten deliberately vulnerable sample projects, written the way generated apps
 * actually look (multi-line SQL, Firebase test-mode rules, destructured request
 * bodies), run through the real pre-deploy scan.
 *
 * KNOWN_MISSES lists what the scan still does not catch. Those cases assert
 * the miss, so docs/PREDEPLOY-CHECK.md cannot drift from reality: fixing one
 * fails its test until it moves to CAUGHT.
 */
import { describe, expect, it } from 'vitest';
import { scan } from '~/lib/predeploy/scan';

// Built at runtime so the repo secret scan does not flag this test file.
const FAKE_OPENAI = ['sk', 'proj', 'Z9'.repeat(24)].join('-');
const FAKE_STRIPE = ['sk', 'live', 'Q7'.repeat(12)].join('_');

type Sample = { files: Record<string, string>; expect: string[] };

const GITIGNORE = { '.gitignore': 'node_modules\n.env\ndist\n' };

const CAUGHT: Record<string, Sample> = {
  'leaked provider key in client code': {
    files: { ...GITIGNORE, 'src/lib/ai.ts': `export const client = new OpenAI({ apiKey: "${FAKE_OPENAI}" });\n` },
    expect: ['secret-leak'],
  },
  'Supabase table without RLS': {
    files: {
      ...GITIGNORE,
      'supabase/migrations/001_init.sql': 'create table public.todos (\n  id uuid primary key,\n  title text\n);\n',
    },
    expect: ['supabase-rls-missing'],
  },
  'Supabase multi-line anon write policy': {
    files: {
      ...GITIGNORE,
      'supabase/migrations/002_policies.sql': [
        'create table todos (id uuid primary key, title text);',
        'alter table todos enable row level security;',
        'create policy "Anyone can write"',
        '  on public.todos',
        '  for all',
        '  to anon',
        '  using (true)',
        '  with check (true);',
      ].join('\n'),
    },
    expect: ['supabase-rls-open'],
  },
  'Firebase rules open to everyone': {
    files: {
      ...GITIGNORE,
      'firestore.rules':
        "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{db}/documents {\n    match /{doc=**} {\n      allow read, write: if true;\n    }\n  }\n}\n",
    },
    expect: ['firebase-open-rules'],
  },
  'Firebase test-mode rules (open until a date)': {
    files: {
      ...GITIGNORE,
      'firestore.rules':
        "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.time < timestamp.date(2030, 1, 1);\n    }\n  }\n}\n",
    },
    expect: ['firebase-open-rules'],
  },
  'XSS through dangerouslySetInnerHTML': {
    files: {
      ...GITIGNORE,
      'src/Comment.tsx':
        'export function Comment({ body }) {\n  return <div dangerouslySetInnerHTML={{ __html: body }} />;\n}\n',
    },
    expect: ['unsafe-html'],
  },
  'XSS through innerHTML assignment': {
    files: {
      ...GITIGNORE,
      'src/render.ts': 'export function show(el: HTMLElement, msg: string) {\n  el.innerHTML = msg;\n}\n',
    },
    expect: ['unsafe-html'],
  },
  'trusted client price (destructured body)': {
    files: {
      ...GITIGNORE,
      'app/api/checkout/route.ts': [
        "import Stripe from 'stripe';",
        'export async function POST(request: Request) {',
        '  const { amount } = await request.json();',
        '  const session = await stripe.checkout.sessions.create({',
        "    line_items: [{ price_data: { currency: 'usd', unit_amount: amount }, quantity: 1 }],",
        '  });',
        '  return Response.json({ url: session.url });',
        '}',
      ].join('\n'),
    },
    expect: ['client-price-trust'],
  },
  'trusted client price (req.body)': {
    files: {
      ...GITIGNORE,
      'api/pay.ts':
        'const intent = await stripe.paymentIntents.create({ amount: req.body.amount, currency: "usd" });\n',
    },
    expect: ['client-price-trust'],
  },
  'CORS wildcard header': {
    files: { ...GITIGNORE, 'api/data.ts': "res.setHeader('Access-Control-Allow-Origin', '*');\n" },
    expect: ['cors-wildcard'],
  },
  'CORS wildcard via cors() defaults': {
    files: { ...GITIGNORE, 'server/index.ts': "import cors from 'cors';\nconst app = express();\napp.use(cors());\n" },
    expect: ['cors-wildcard'],
  },
  'session token in localStorage': {
    files: { ...GITIGNORE, 'src/auth.ts': "localStorage.setItem('token', data.session.access_token);\n" },
    expect: ['localstorage-token'],
  },
  'admin decided from localStorage': {
    files: { ...GITIGNORE, 'src/Admin.tsx': "const isAdmin = localStorage.getItem('isAdmin') === 'true';\n" },
    expect: ['client-admin-check'],
  },
  'SQL injection via template literal': {
    files: {
      ...GITIGNORE,
      'api/users.ts': 'const rows = await db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n',
    },
    expect: ['sql-injection'],
  },
  'SQL injection via string concatenation': {
    files: {
      ...GITIGNORE,
      'server/db.ts': 'const result = await pool.query("SELECT * FROM orders WHERE user = \'" + userId + "\'");\n',
    },
    expect: ['sql-injection'],
  },
  'committed .env with a real value': {
    files: { ...GITIGNORE, '.env': `STRIPE_SECRET_KEY=${FAKE_STRIPE}\n` },
    expect: ['dotenv-committed', 'secret-leak'],
  },
};

/** Documented in docs/PREDEPLOY-CHECK.md under "What it misses". */
const KNOWN_MISSES: Record<string, Record<string, string>> = {
  'admin decided from a client-side role field': {
    ...GITIGNORE,
    'src/Nav.tsx': "{user?.user_metadata?.role === 'admin' && <AdminPanel />}\n",
  },
  'key split across string concatenation': {
    ...GITIGNORE,
    'src/lib/ai.ts': `const key = "${FAKE_OPENAI.slice(0, 12)}" + "${FAKE_OPENAI.slice(12)}";\n`,
  },
};

function ruleIds(files: Record<string, string>): string[] {
  return [
    ...new Set(
      scan(files)
        .findings.filter((finding) => !finding.suppressed)
        .map((finding) => finding.ruleId),
    ),
  ];
}

describe('pre-deploy scan on vulnerable sample projects', () => {
  it.each(Object.entries(CAUGHT))('catches: %s', (_name, sample) => {
    const found = ruleIds(sample.files);

    for (const rule of sample.expect) {
      expect(found, `expected ${rule}`).toContain(rule);
    }
  });

  it.each(Object.entries(KNOWN_MISSES))('still misses (documented): %s', (_name, files) => {
    const blocking = scan(files).findings.filter((finding) => finding.severity !== 'INFO');
    expect(blocking).toEqual([]);
  });

  it('does not flag the safe versions', () => {
    const safe = {
      ...GITIGNORE,
      'supabase/migrations/001.sql': [
        'create table todos (id uuid primary key, owner uuid, title text);',
        'alter table todos enable row level security;',
        'create policy "own rows"',
        '  on todos for all to authenticated',
        '  using (auth.uid() = owner)',
        '  with check (auth.uid() = owner);',
      ].join('\n'),
      'firestore.rules': 'allow read, write: if request.auth != null && request.auth.uid == userId;\n',
      'src/render.ts': 'el.textContent = msg;\nel.innerHTML = "";\n',
      'api/users.ts': "const rows = await db.query('SELECT * FROM users WHERE id = $1', [req.query.id]);\n",
      'server/index.ts': "app.use(cors({ origin: 'https://app.example' }));\n",
      'app/api/checkout/route.ts':
        'const user = await getUser();\nconst { productId } = await request.json();\nconst price = await lookupPrice(productId);\nawait stripe.checkout.sessions.create({ line_items: [{ price, quantity: 1 }] });\n',
      'vercel.json':
        '{"headers":[{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"default-src \'self\'"}]}]}',
    };

    expect(scan(safe).findings.filter((finding) => finding.severity !== 'INFO')).toEqual([]);
  });
});
