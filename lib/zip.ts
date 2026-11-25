// A small ZIP writer for backups made in the browser. Text files are compressed with the
// browser's own deflate; images are stored as they are (they are already compressed).

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

interface Entry { name: Uint8Array; crc: number; size: number; packed: number; method: number; offset: number; time: number; date: number; }

export class ZipWriter {
  private parts: BlobPart[] = [];
  private entries: Entry[] = [];
  private offset = 0;
  private readonly time: number;
  private readonly date: number;

  constructor(when = new Date()) {
    this.time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
    this.date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  }

  /** Add a file. `compress` false for data that is already compressed (images, .gz). */
  async add(path: string, content: string | Uint8Array, compress = true) {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const name = new TextEncoder().encode(path);
    const crc = crc32(data);
    const packedData = compress ? await deflate(data) : null;
    const useDeflate = !!packedData && packedData.length < data.length;
    const body = useDeflate ? packedData! : data;
    const method = useDeflate ? 8 : 0;

    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // file names are UTF-8 (Hebrew)
    h.setUint16(8, method, true);
    h.setUint16(10, this.time, true);
    h.setUint16(12, this.date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, body.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    this.parts.push(h.buffer, name as BlobPart, body as BlobPart);
    this.entries.push({ name, crc, size: data.length, packed: body.length, method, offset: this.offset, time: this.time, date: this.date });
    this.offset += 30 + name.length + body.length;
  }

  get fileCount() { return this.entries.length; }
  get byteSize() { return this.offset; }

  finish(): Blob {
    const start = this.offset;
    let size = 0;
    const central: BlobPart[] = [];
    for (const e of this.entries) {
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, e.method, true);
      c.setUint16(12, e.time, true);
      c.setUint16(14, e.date, true);
      c.setUint32(16, e.crc, true);
      c.setUint32(20, e.packed, true);
      c.setUint32(24, e.size, true);
      c.setUint16(28, e.name.length, true);
      c.setUint32(42, e.offset, true);
      central.push(c.buffer, e.name as BlobPart);
      size += 46 + e.name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, start, true);
    return new Blob([...this.parts, ...central, end.buffer], { type: 'application/zip' });
  }
}

/** Hand a file to the browser's downloads. */
export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
