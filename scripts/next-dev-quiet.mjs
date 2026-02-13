import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';

const QUIET_PATTERNS = [
  '/api/sdk/v2/session/heartbeat'
];

function createLineFilterStream({ shouldDropLine }) {
  let buffer = '';
  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString('utf8');
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        if (!shouldDropLine(line)) this.push(`${line}\n`);
      }
      callback();
    },
    flush(callback) {
      if (buffer && !shouldDropLine(buffer)) this.push(buffer);
      callback();
    }
  });
}

const child = spawn('next', ['dev', '--turbopack'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: true,
  env: process.env
});

const filter = createLineFilterStream({
  shouldDropLine: (line) => QUIET_PATTERNS.some((p) => line.includes(p))
});

child.stdout.pipe(filter).pipe(process.stdout);

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) process.kill(process.pid, signal);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
