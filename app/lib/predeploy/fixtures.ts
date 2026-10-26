/**
 * In-memory fixture projects for rules and the debug query.
 * Secrets are built at runtime so this file does not contain a matching key.
 */

function fakeAnt(): string {
  return `sk-ant-${'a'.repeat(24)}`;
}

function fakeJwt(): string {
  return `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(16)}`;
}

const CLEAN_HEADERS = `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}`;

export const cleanFixture: Record<string, string> = {
  '.gitignore': 'node_modules\n.env\n.env.*\ndist\n',
  'package.json': '{"name":"clean-app","dependencies":{"react":"19.0.0"}}',
  'vercel.json': CLEAN_HEADERS,
  'src/App.tsx': 'export function App() { return <h1>Hello</h1>; }\n',
  'src/api.ts': 'export const url = "https://api.example.com/v1";\n',
};

export const secretLeakFixture: Record<string, string> = {
  ...cleanFixture,
  'src/config.ts': `export const key = "${fakeAnt()}";\n`,
};

export const clientSecretFixture: Record<string, string> = {
  ...cleanFixture,
  'src/db.ts': `export const supabase = createClient(url, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);\n`,
};

export const dotenvFixture: Record<string, string> = {
  '.gitignore': 'node_modules\n',
  'package.json': cleanFixture['package.json'],
  'vercel.json': CLEAN_HEADERS,
  'src/App.tsx': cleanFixture['src/App.tsx'],
  '.env': `OPENAI_API_KEY=${fakeAnt()}\n`,
};

export const supabaseRlsMissingFixture: Record<string, string> = {
  ...cleanFixture,
  'supabase/migrations/001_notes.sql': 'CREATE TABLE public.notes (\n  id uuid primary key\n);\n',
};

export const supabaseRlsOpenFixture: Record<string, string> = {
  ...cleanFixture,
  'supabase/migrations/001_notes.sql':
    'CREATE TABLE public.notes (id uuid primary key);\nALTER TABLE notes ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "open" ON notes FOR ALL TO anon USING (true) WITH CHECK (true);\n',
};

export const firebaseOpenFixture: Record<string, string> = {
  ...cleanFixture,
  'firestore.rules':
    'service cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}\n',
};

export const corsWildcardFixture: Record<string, string> = {
  ...cleanFixture,
  'api/server.ts':
    "res.setHeader('Access-Control-Allow-Origin', '*');\nres.setHeader('Access-Control-Allow-Credentials', 'true');\n",
};

export const localStorageTokenFixture: Record<string, string> = {
  ...cleanFixture,
  'src/auth.ts': `localStorage.setItem('access_token', ${JSON.stringify(fakeJwt())});\n`,
};

export const unsafeHtmlFixture: Record<string, string> = {
  ...cleanFixture,
  'src/Widget.tsx':
    'export function Widget({ html }: { html: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n',
};

export const insecureHttpFixture: Record<string, string> = {
  ...cleanFixture,
  'src/api.ts': 'export const url = "http://api.example.com/v1";\n',
};

export const clientAdminFixture: Record<string, string> = {
  ...cleanFixture,
  'src/Admin.tsx':
    "const isAdmin = localStorage.getItem('role') === 'admin';\nexport function Admin() { return isAdmin ? <button>Delete</button> : null; }\n",
};

export const supabaseUnverifiedFixture: Record<string, string> = {
  ...cleanFixture,
  'src/notes.ts': "const { data } = await supabase.from('notes').select('*');\n",
};

export const unauthenticatedWriteFixture: Record<string, string> = {
  ...cleanFixture,
  'app/api/items/route.ts':
    "export async function POST(request: Request) {\n  const body = await request.json();\n  await db.from('items').insert(body);\n  return Response.json({ ok: true });\n}\n",
};

export const clientPriceFixture: Record<string, string> = {
  ...cleanFixture,
  'app/api/checkout/route.ts':
    "import Stripe from 'stripe';\nexport async function POST(request: Request) {\n  const body = await request.json();\n  await stripe.charges.create({ amount: body.amount });\n}\n",
};

export const unpinnedDepFixture: Record<string, string> = {
  ...cleanFixture,
  'package.json': '{"name":"app","dependencies":{"react":"*","vite":"latest"}}',
};

export const missingHeadersFixture: Record<string, string> = {
  '.gitignore': cleanFixture['.gitignore'],
  'package.json': cleanFixture['package.json'],
  'src/App.tsx': cleanFixture['src/App.tsx'],
};

export const missingGitignoreFixture: Record<string, string> = {
  'package.json': cleanFixture['package.json'],
  'vercel.json': CLEAN_HEADERS,
  'src/App.tsx': cleanFixture['src/App.tsx'],
};

export const ignoreCommentFixture: Record<string, string> = {
  ...cleanFixture,
  'src/config.ts': `export const key = "${fakeAnt()}"; // hypeable-ignore: secret-leak test fixture\n`,
};

export const jwtLeakFixture: Record<string, string> = {
  ...cleanFixture,
  'src/session.ts': `export const session = "${fakeJwt()}";\n`,
};

export const RULE_FIXTURES: Record<string, Record<string, string>> = {
  'secret-leak': secretLeakFixture,
  'client-secret': clientSecretFixture,
  'dotenv-committed': dotenvFixture,
  'supabase-rls-missing': supabaseRlsMissingFixture,
  'supabase-rls-open': supabaseRlsOpenFixture,
  'firebase-open-rules': firebaseOpenFixture,
  'cors-wildcard': corsWildcardFixture,
  'localstorage-token': localStorageTokenFixture,
  'unsafe-html': unsafeHtmlFixture,
  'insecure-http': insecureHttpFixture,
  'client-admin-check': clientAdminFixture,
  'supabase-rls-unverified': supabaseUnverifiedFixture,
  'unauthenticated-write': unauthenticatedWriteFixture,
  'client-price-trust': clientPriceFixture,
  'unpinned-dependency': unpinnedDepFixture,
  'missing-security-headers': missingHeadersFixture,
  'missing-gitignore': missingGitignoreFixture,
};

export const failDebugFixture = secretLeakFixture;
export const warnDebugFixture = corsWildcardFixture;
export const cleanDebugFixture = cleanFixture;
