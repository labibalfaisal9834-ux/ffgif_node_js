import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { MinioStorageRepository } from '../minio/storage_repo.js';
import { convertToGif, convertToMp4, generateThumbnail } from './ffmpeg.js';
import { runFFprobe, isValidMedia } from './ffprobe.js';

export interface JobResult {
  gifKey: string;
  thumbKey: string;
}

export interface PreProcessedResult {
  videoKey: string;
  thumbnailKey: string;
  size: string;
  duration: string;
  contentType: string;
}

export interface VideoProcessor {
  process(
    jobId: string,
    key: string,
    start: number,
    end: number,
    width: number,
    fps: number,
    loop: boolean
  ): Promise<JobResult>;
  preProcess(key: string): Promise<PreProcessedResult>;
}

export class FFmpegProcessor implements VideoProcessor {
  constructor(private readonly storage: MinioStorageRepository) {}

  async process(
    jobId: string,
    key: string,
    start: number,
    end: number,
    width = 480,
    fps = 10,
    loop = false
  ): Promise<JobResult> {
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const inputPath = path.join(os.tmpdir(), `input_${cleanKey}.mp4`);
    const outputPath = path.join(os.tmpdir(), `${cleanKey}_output.gif`);
    const palettePath = path.join(os.tmpdir(), `${cleanKey}_palette.png`);
    const thumbOutputPath = path.join(os.tmpdir(), `thumb_${cleanKey}.jpg`);

    const cleanup = async () => {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(palettePath).catch(() => {});
      await fs.unlink(thumbOutputPath).catch(() => {});
    };

    try {
      await this.storage.downloadLocal(key, inputPath);

      const actualFps = fps || 10;
      const actualWidth = width || 480;
      const loopFlag = loop ? '0' : '-1';

      await convertToGif({
        inputPath,
        outputPath,
        palettePath,
        width: actualWidth,
        fps: actualFps,
        start,
        end,
        loop: loopFlag,
      });

      await generateThumbnail(inputPath, thumbOutputPath, start + 1.0);

      const gifKey = `${uuidv4()}_output.gif`;
      await this.storage.upload(gifKey, outputPath, 'image/gif');

      const thumbKey = `thumpnail_${uuidv4()}.jpg`;
      await this.storage.upload(thumbKey, thumbOutputPath, 'image/jpeg');

      return {
        gifKey,
        thumbKey,
      };
    } finally {
      await cleanup();
    }
  }

  async preProcess(key: string): Promise<PreProcessedResult> {
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const inputPath = path.join(os.tmpdir(), `raw_video_${cleanKey}`);
    const outputPath = path.join(os.tmpdir(), `converted_${cleanKey}.mp4`);
    const thumbOutputPath = path.join(os.tmpdir(), `thumb_${cleanKey}.jpg`);

    const cleanup = async () => {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      await fs.unlink(thumbOutputPath).catch(() => {});
    };

    try {
      await this.storage.downloadLocalRawVideo(key, inputPath);

      const probeResult = await runFFprobe(inputPath);
      if (!isValidMedia(probeResult)) {
        throw new Error('Invalid file');
      }

      const codecName = probeResult.streams?.[0]?.codec_name;
      await convertToMp4(inputPath, outputPath, codecName);

      await generateThumbnail(outputPath, thumbOutputPath, 1.0);

      const videoKey = `converted_${uuidv4()}.mp4`;
      await this.storage.upload(videoKey, outputPath, 'video/mp4');

      const thumbKey = `thumpnail_${uuidv4()}.jpg`;
      await this.storage.upload(thumbKey, thumbOutputPath, 'image/jpeg');

      const convertedProbe = await runFFprobe(outputPath);
      if (!isValidMedia(convertedProbe)) {
        throw new Error('Invalid file');
      }

      return {
        videoKey,
        thumbnailKey: thumbKey,
        contentType: 'video/mp4',
        size: convertedProbe.format?.size || '0',
        duration: convertedProbe.format?.duration || '0',
      };
    } finally {
      await cleanup();
    }
  }
}
