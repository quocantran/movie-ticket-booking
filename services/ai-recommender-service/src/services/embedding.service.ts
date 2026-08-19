import { Injectable, OnModuleInit } from '@nestjs/common';
import { AI_CONFIG } from '../constants/ai.constants';

let pipeline: any;
let env: any;
const dynamicImport = new Function(
  'modulePath',
  'return import(modulePath)',
) as (modulePath: string) => Promise<any>;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embedder: any = null;
  private isModelLoading = false;
  private modelLoadPromise: Promise<void> | null = null;

  async onModuleInit() {
    await this.loadModel().catch(() => {
    });
  }

  private async loadModel(): Promise<void> {
    if (this.embedder) return;
    if (this.isModelLoading && this.modelLoadPromise) {
      await this.modelLoadPromise;
      return;
    }

    this.isModelLoading = true;
    this.modelLoadPromise = (async () => {
      try {
        const transformers = await dynamicImport('@xenova/transformers');
        pipeline = transformers.pipeline;
        env = transformers.env;

        env.allowLocalModels = false;

        this.embedder = await pipeline(AI_CONFIG.TASK_NAME, AI_CONFIG.MODEL_NAME);
      } catch (error) {
        throw error;
      } finally {
        this.isModelLoading = false;
      }
    })();

    await this.modelLoadPromise;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.loadModel();

    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      const truncatedText = text.slice(0, AI_CONFIG.MAX_TEXT_LENGTH);

      const output = await this.embedder(truncatedText, {
        pooling: 'mean',
        normalize: true,
      });

      return Array.from(output.data) as number[];
    } catch {
      return [];
    }
  }

  createMovieText(movie: {
    title: string;
    genre?: string;
    description?: string;
  }): string {
    const parts: string[] = [];

    if (movie.title) {
      parts.push(movie.title);
    }

    if (movie.genre) {
      parts.push(`Thể loại: ${movie.genre}`);
    }

    if (movie.description) {
      parts.push(movie.description);
      parts.push(movie.description);
      parts.push(movie.description);
    }

    return parts.join('. ');
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }
}
