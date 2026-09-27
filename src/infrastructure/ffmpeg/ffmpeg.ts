import { spawn } from 'child_process';

function runProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

export interface GifConvertParams {
  inputPath: string;
  outputPath: string;
  palettePath: string;
  width: number;
  fps: number;
  start: number;
  end: number;
  loop: string;
}

export async function convertToGif(params: GifConvertParams): Promise<void> {
  const duration = params.end - params.start;
  const paletteFilter = `fps=${params.fps},scale=${params.width}:-1:flags=lanczos,format=rgb24,palettegen=stats_mode=full`;

  // Pass 1: Palettegen
  const paletteArgs = [
    '-ss', params.start.toFixed(2),
    '-t', duration.toFixed(2),
    '-i', params.inputPath,
    '-vf', paletteFilter,
    '-update', '1',
    '-frames:v', '1',
    '-y',
    params.palettePath,
  ];

  await runProcess('ffmpeg', paletteArgs);

  // Pass 2: Paletteuse
  const gifFilter = `fps=${params.fps},scale=${params.width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`;
  const gifArgs = [
    '-ss', params.start.toFixed(2),
    '-t', duration.toFixed(2),
    '-i', params.inputPath,
    '-i', params.palettePath,
    '-filter_complex', gifFilter,
    '-loop', params.loop,
    '-y',
    params.outputPath,
  ];

  await runProcess('ffmpeg', gifArgs);
}

export async function convertToMp4(inputPath: string, outputPath: string, codecName?: string): Promise<void> {
  let args: string[];
  if (codecName === 'h264') {
    args = [
      '-i', inputPath,
      '-c:v', 'copy',
      '-an',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];
  } else {
    args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-an',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];
  }

  await runProcess('ffmpeg', args);
}

export async function generateThumbnail(inputPath: string, outputPath: string, startAt = 1.0): Promise<void> {
  const args = [
    '-ss', startAt.toFixed(2),
    '-i', inputPath,
    '-vframes', '1',
    '-q:v', '2',
    '-update', '1',
    '-vf', 'format=yuvj420p',
    outputPath,
  ];

  await runProcess('ffmpeg', args);
}
