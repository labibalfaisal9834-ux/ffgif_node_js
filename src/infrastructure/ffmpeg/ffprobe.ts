import { spawn } from 'child_process';

export interface FFprobeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  probe_score?: number;
}

export interface FFprobeStream {
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  mime_codec_string?: string;
}

export interface FFprobeOutput {
  format?: FFprobeFormat;
  streams?: FFprobeStream[];
}

export function isValidMedia(probe: FFprobeOutput): boolean {
  if (!probe.format || !probe.streams || probe.streams.length === 0) {
    return false;
  }

  const probeScore = probe.format.probe_score ?? 0;
  if (probeScore < 50) {
    return false;
  }

  const size = parseInt(probe.format.size || '0', 10);
  if (isNaN(size) || size > 500 * 1024 * 1024) {
    return false;
  }

  if (probe.streams[0].codec_type !== 'video') {
    return false;
  }

  return true;
}

export async function runFFprobe(inputPath: string): Promise<FFprobeOutput> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-select_streams', 'v:0',
      inputPath,
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with exit code ${code}: ${stderr}`));
      }
      try {
        const result = JSON.parse(stdout) as FFprobeOutput;
        resolve(result);
      } catch (err) {
        reject(new Error(`ffprobe output JSON parse failed: ${err}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
