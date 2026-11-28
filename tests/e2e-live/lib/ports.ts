import net from 'node:net';

export const LOCAL_POS_PORT_BASE = 13100;
export const UNIFIED_PORT_BASE = 18100;

const RESERVED_MIN = 3000;
const RESERVED_MAX = 3010;
const RESERVED_EXTRA = new Set<number>([8080]);
const inProcessAllocated = new Set<number>();

export function isReservedPort(port: number): boolean {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return true;
  }
  if (port >= RESERVED_MIN && port <= RESERVED_MAX) {
    return true;
  }
  return RESERVED_EXTRA.has(port);
}

function probeSingleHost(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;

    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    server.unref();
    server.once('error', () => {
      try {
        server.close(() => finish(false));
      } catch {
        finish(false);
      }
    });

    server.once('listening', () => {
      server.close((err) => {
        finish(!err);
      });
    });

    try {
      server.listen({ port, host, exclusive: true });
    } catch {
      finish(false);
    }
  });
}

export async function isPortFree(
  port: number,
  hosts: string[] = ['0.0.0.0', '127.0.0.1'],
): Promise<boolean> {
  if (isReservedPort(port)) {
    return false;
  }
  for (const host of hosts) {
    const ok = await probeSingleHost(port, host);
    if (!ok) {
      return false;
    }
  }
  return true;
}

function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1', exclusive: true }, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      server.close((err) => {
        if (err) {
          reject(err);
        } else if (port <= 0) {
          reject(new Error('Failed to obtain ephemeral port from OS'));
        } else {
          resolve(port);
        }
      });
    });
  });
}

export function releasePort(port: number): void {
  inProcessAllocated.delete(port);
}

export async function allocatePort(
  startFrom: number = LOCAL_POS_PORT_BASE,
  exclude?: Set<number>,
): Promise<number> {
  const start = Math.max(1024, Math.floor(startFrom));
  const maxScan = Math.min(65535, start + 5000);

  for (let candidate = start; candidate <= maxScan; candidate += 1) {
    if (isReservedPort(candidate)) continue;
    if (exclude?.has(candidate) || inProcessAllocated.has(candidate)) continue;
    if (await isPortFree(candidate)) {
      inProcessAllocated.add(candidate);
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = await getEphemeralPort();
    if (isReservedPort(candidate)) continue;
    if (exclude?.has(candidate) || inProcessAllocated.has(candidate)) continue;
    if (await isPortFree(candidate)) {
      inProcessAllocated.add(candidate);
      return candidate;
    }
  }

  throw new Error(`Unable to allocate a free TCP port starting from ${startFrom}`);
}

export async function allocatePorts(
  count: number,
  startFrom: number = LOCAL_POS_PORT_BASE,
  stride: number = 10,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid port count: ${count}`);
  }
  if (count === 0) {
    return [];
  }
  const safeStride = Math.max(1, Math.floor(stride));
  const ports: number[] = [];
  const exclude = new Set<number>();
  let cursor = startFrom;

  for (let i = 0; i < count; i += 1) {
    const port = await allocatePort(cursor, exclude);
    ports.push(port);
    for (let offset = 0; offset < safeStride; offset += 1) {
      exclude.add(port + offset);
    }
    cursor = port + safeStride;
  }

  return ports;
}
