import JSZip from 'jszip';
import { pluginManifestSchema, type CatalogVersion, type PluginCatalog, type PluginManifest } from './schema';

const MAX_PACKAGE_BYTES = 5_000_000;
const MAX_PACKAGE_FILES = 100;
const MAX_EXPANDED_BYTES = 20_000_000;
const FORBIDDEN_EXTENSIONS = /\.(?:js|mjs|cjs|jsx|ts|tsx|wasm|exe|dll|so|dylib|bat|cmd|ps1|sh)$/i;

export type MarketplacePlugin = {
  id: string;
  manifest: PluginManifest;
  versions: CatalogVersion[];
};

export type MarketplaceSnapshot = {
  commit: string;
  catalog: PluginCatalog;
  plugins: MarketplacePlugin[];
  stale: boolean;
  fetchedAt: string;
};

const encoder = new TextEncoder();

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function sha256(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const copy = new Uint8Array(bytes instanceof Uint8Array ? bytes.byteLength : (bytes as ArrayBuffer).byteLength);

  if (bytes instanceof Uint8Array) {
    copy.set(bytes);
  } else {
    copy.set(new Uint8Array(bytes as ArrayBuffer));
  }

  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

type ZipHeader = { name: string; compressedBytes: number; expandedBytes: number };

function inspectZipHeaders(bytes: Uint8Array): Map<string, ZipHeader> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocdOffset = Math.max(0, bytes.byteLength - 65_557);

  let eocd = -1;

  for (let offset = bytes.byteLength - 22; offset >= minEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0 || eocd + 22 > bytes.byteLength) {
    throw new Error('Plugin package is not a valid ZIP archive.');
  }

  const diskNumber = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const directoryBytes = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const commentLength = view.getUint16(eocd + 20, true);

  if (
    eocd + 22 + commentLength !== bytes.byteLength ||
    diskNumber !== 0 ||
    directoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    directoryOffset === 0xffffffff ||
    directoryBytes === 0xffffffff ||
    entryCount === 0 ||
    entryCount > MAX_PACKAGE_FILES + 10 ||
    directoryOffset + directoryBytes > eocd
  ) {
    throw new Error('Plugin ZIP uses an unsupported or invalid archive layout.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries = new Map<string, ZipHeader>();

  let offset = directoryOffset;
  let totalExpanded = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Plugin ZIP directory is corrupt.');
    }

    const creatorSystem = view.getUint8(offset + 5);
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedBytes = view.getUint32(offset + 20, true);
    const expandedBytes = view.getUint32(offset + 24, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const fileCommentLength = view.getUint16(offset + 32, true);
    const startDisk = view.getUint16(offset + 34, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const recordLength = 46 + filenameLength + extraLength + fileCommentLength;

    if (
      offset + recordLength > eocd ||
      startDisk !== 0 ||
      compressedBytes === 0xffffffff ||
      expandedBytes === 0xffffffff ||
      (flags & 0x41) !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8)
    ) {
      throw new Error('Plugin ZIP uses encryption, ZIP64, or an unsupported compression format.');
    }

    const nameBytes = bytes.subarray(offset + 46, offset + 46 + filenameLength);
    const name = decoder.decode(nameBytes);
    const normalized = name.replaceAll('\\', '/');
    const unixMode = creatorSystem === 3 ? externalAttributes >>> 16 : 0;
    const fileType = unixMode & 0o170000;

    if (
      !name ||
      normalized !== name ||
      normalized.startsWith('/') ||
      normalized.split('/').some((part) => part === '.' || part === '..') ||
      name.includes(':') ||
      fileType === 0o120000 ||
      entries.has(name)
    ) {
      throw new Error('Plugin ZIP contains a duplicate, linked, or unsafe file path.');
    }

    if (!name.endsWith('/')) {
      totalExpanded += expandedBytes;

      if (totalExpanded > MAX_EXPANDED_BYTES) {
        throw new Error('Expanded plugin package exceeds 20 MB.');
      }

      entries.set(name, { name, compressedBytes, expandedBytes });
    }

    offset += recordLength;
  }

  if (offset !== directoryOffset + directoryBytes) {
    throw new Error('Plugin ZIP directory has trailing or missing entries.');
  }

  return entries;
}

async function readEntryBounded(entry: JSZip.JSZipObject, maximumBytes: number): Promise<Uint8Array> {
  type InternalStream = (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>;

  const stream = (entry as JSZip.JSZipObject & { internalStream: InternalStream }).internalStream('uint8array');
  const chunks: Uint8Array[] = [];

  let size = 0;

  return new Promise((resolve, reject) => {
    stream
      .on('data', (chunk) => {
        size += chunk.byteLength;

        if (size > maximumBytes) {
          stream.pause();
          reject(new Error('Expanded plugin package exceeds 20 MB.'));

          return;
        }

        chunks.push(chunk);
      })
      .on('error', reject)
      .on('end', () => {
        const result = new Uint8Array(size);

        let offset = 0;

        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }

        resolve(result);
      });

    stream.resume();
  });
}

function isCanonicalManifest(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) {
      return `[${value.map(canonical).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(',')}}`;
    }

    return JSON.stringify(value);
  };

  return canonical(left) === canonical(right);
}

const CATALOGUE_DISABLED = 'The third-party plugin catalogue is not part of v1. Import a local ZIP instead.';

export async function fetchMarketplace(): Promise<MarketplaceSnapshot> {
  throw new Error(CATALOGUE_DISABLED);
}

export async function installMarketplacePlugin(
  _snapshot: MarketplaceSnapshot,
  _pluginId: string,
  _version: CatalogVersion,
): Promise<{
  manifest: PluginManifest;
  manifestBytes: Uint8Array;
  packageBytes: Uint8Array;
  manifestSha256: string;
  packageSha256: string;
}> {
  throw new Error(CATALOGUE_DISABLED);
}

export async function fetchMarketplaceChangelog(
  _snapshot: MarketplaceSnapshot,
  _version: CatalogVersion,
): Promise<string | undefined> {
  throw new Error(CATALOGUE_DISABLED);
}

async function validatePackage(bytes: Uint8Array, expected?: PluginManifest): Promise<PluginManifest> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error('Plugin package must be between 1 byte and 5 MB.');
  }

  const zipHeaders = inspectZipHeaders(bytes);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false });
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);

  if (entries.length === 0 || entries.length > MAX_PACKAGE_FILES || entries.length !== zipHeaders.size) {
    throw new Error('Plugin package has an invalid number of files.');
  }

  let expandedSize = 0;
  let packagedManifest: PluginManifest | undefined;

  for (const [name, entry] of entries) {
    const originalName = entry.unsafeOriginalName ?? name;
    const normalized = originalName.replaceAll('\\', '/');

    const mode =
      typeof entry.unixPermissions === 'number'
        ? entry.unixPermissions & 0o170000
        : typeof entry.unixPermissions === 'string'
          ? Number.parseInt(entry.unixPermissions, 8) & 0o170000
          : 0;

    const header = zipHeaders.get(name);

    if (
      normalized !== name ||
      normalized.startsWith('/') ||
      normalized.split('/').some((part) => part === '.' || part === '..') ||
      FORBIDDEN_EXTENSIONS.test(normalized) ||
      mode === 0o120000 ||
      !header
    ) {
      throw new Error('Plugin package contains an unsupported or unsafe file path.');
    }

    if (
      name !== 'manifest.json' &&
      name !== expected?.icon &&
      (!name.startsWith('assets/') || !/\.(?:png|jpe?g|webp)$/i.test(name))
    ) {
      throw new Error(`Plugin package contains an unlisted file: ${name}`);
    }

    const fileBytes = await readEntryBounded(entry, Math.min(MAX_EXPANDED_BYTES - expandedSize, header.expandedBytes));
    expandedSize += fileBytes.byteLength;

    if (expandedSize > MAX_EXPANDED_BYTES || fileBytes.byteLength !== header.expandedBytes) {
      throw new Error('Expanded plugin package exceeds 20 MB.');
    }

    if (name === 'manifest.json') {
      packagedManifest = pluginManifestSchema.parse(parseJson(fileBytes));
    }
  }

  if (!packagedManifest || (expected && !isCanonicalManifest(packagedManifest, expected))) {
    throw new Error('The package manifest does not match the marketplace manifest.');
  }

  return packagedManifest;
}

export async function inspectLocalPackage(file: File) {
  if (file.size > MAX_PACKAGE_BYTES) {
    throw new Error('Plugin package must be 5 MB or smaller.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const manifest = await validatePackage(bytes);

  return {
    manifest,
    packageBytes: bytes,
    manifestSha256: await sha256(encoder.encode(JSON.stringify(manifest))),
    packageSha256: await sha256(bytes),
  };
}

export async function createPluginPackage(manifest: PluginManifest): Promise<Blob> {
  const zip = new JSZip();
  zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export { compareVersions } from './schema';
