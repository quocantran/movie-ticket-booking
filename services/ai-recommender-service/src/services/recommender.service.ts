import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MovieEmbeddingEntity } from '../entities/movie-embedding.entity';
import { UserBehaviorEntity } from '../entities/user-behavior.entity';
import { EmbeddingService } from './embedding.service';

export interface MovieInfo {
  id: string;
  title: string;
  genre: string;
  description: string;
  duration?: number;
  posterUrl?: string;
}

export interface RecommendedMovie {
  movieId: string;
  title: string;
  genres: string[];
  similarityScore: number;      // Combined score (60% cosine + 40% jaccard)
  cosineScore: number;           // Cosine similarity on description embedding
  jaccardScore: number;          // Jaccard similarity on genres
}

export interface GenreSection {
  genre: string;
  movies: RecommendedMovie[];
}

export interface GroupedRecommendations {
  topPicks: RecommendedMovie[];       // Top AI picks (mixed genres, highest combined score)
  genreSections: GenreSection[];      // Per-genre sections based on user's favorite genres
  userGenres: string[];               // Genres user has watched
}

@Injectable()
export class RecommenderService implements OnModuleInit {
  private readonly movieServiceUrl =
    process.env.MOVIE_SERVICE_URL || 'http://localhost:5003';

  constructor(
    @InjectRepository(MovieEmbeddingEntity)
    private readonly embeddingRepository: Repository<MovieEmbeddingEntity>,
    @InjectRepository(UserBehaviorEntity)
    private readonly behaviorRepository: Repository<UserBehaviorEntity>,
    private readonly embeddingService: EmbeddingService,
  ) { }

  async onModuleInit() {
    setTimeout(() => this.seedEmbeddingsIfEmpty(), 10000);
  }

  private async seedEmbeddingsIfEmpty(): Promise<void> {
    const count = await this.embeddingRepository.count();
    if (count > 0) {
      return;
    }

    try {
      const movies = await this.fetchAllMovies();
      if (movies.length === 0) {
        return;
      }

      for (const movie of movies) {
        try {
          await this.generateAndSaveEmbedding(
            movie.id,
            movie.title,
            movie.genre,
            movie.description,
          );
        } catch {
        }
      }

      await this.embeddingRepository.count();
    } catch {
    }
  }

  async generateAndSaveEmbedding(
    movieId: string,
    title: string,
    genre: string,
    description: string,
  ): Promise<void> {
    const movieText = this.embeddingService.createMovieText({ title, genre, description });
    const embedding = await this.embeddingService.generateEmbedding(movieText);

    if (embedding.length === 0) {
      return;
    }

    const genres = genre.split(',').map((g) => g.trim()).filter((g) => g.length > 0);

    const existing = await this.embeddingRepository.findOne({ where: { movieId } });
    if (existing) {
      existing.title = title;
      existing.genres = genres;
      existing.embedding = embedding;
      await this.embeddingRepository.save(existing);
    } else {
      const entity = new MovieEmbeddingEntity();
      entity.movieId = movieId;
      entity.title = title;
      entity.genres = genres;
      entity.embedding = embedding;
      await this.embeddingRepository.save(entity);
    }
  }

  async saveUserBehavior(userId: string, movieId: string): Promise<void> {
    const existing = await this.behaviorRepository.findOne({
      where: { userId, movieId },
    });

    if (existing) {
      return;
    }

    const behavior = new UserBehaviorEntity();
    behavior.id = uuidv4();
    behavior.userId = userId;
    behavior.movieId = movieId;
    await this.behaviorRepository.save(behavior);
  }

  async getUserHistory(userId: string): Promise<UserBehaviorEntity[]> {
    return this.behaviorRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private jaccardSimilarity(genresA: string[], genresB: string[]): number {
    const setA = new Set(genresA.map((g) => g.toLowerCase()));
    const setB = new Set(genresB.map((g) => g.toLowerCase()));

    if (setA.size === 0 && setB.size === 0) return 0;

    let intersection = 0;
    for (const g of setA) {
      if (setB.has(g)) intersection++;
    }

    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private static readonly COSINE_BONUS_TIERS = [
    { threshold: 0.8, bonus: 0.10 },
    { threshold: 0.6, bonus: 0.05 },
    { threshold: 0.4, bonus: 0.02 },
  ];

  private static readonly JACCARD_BONUS_TIERS = [
    { threshold: 0.6, bonus: 0.08 },
    { threshold: 0.3, bonus: 0.04 },
    { threshold: 0.1, bonus: 0.01 },
  ];

  private static readonly MAX_RAW_SCORE = 1.18;

  private getTierBonus(value: number, tiers: { threshold: number; bonus: number }[]): number {
    for (const tier of tiers) {
      if (value > tier.threshold) return tier.bonus;
    }
    return 0;
  }

  private calculateCombinedScore(
    candidate: MovieEmbeddingEntity,
    watchedEmbeddings: MovieEmbeddingEntity[],
  ): { combinedScore: number; cosineScore: number; jaccardScore: number } {
    let totalCosine = 0;
    let totalJaccard = 0;

    for (const watched of watchedEmbeddings) {
      totalCosine += this.embeddingService.cosineSimilarity(
        candidate.embedding,
        watched.embedding,
      );

      totalJaccard += this.jaccardSimilarity(candidate.genres, watched.genres);
    }

    const avgCosine = totalCosine / watchedEmbeddings.length;
    const avgJaccard = totalJaccard / watchedEmbeddings.length;

    const baseScore = 0.6 * avgCosine + 0.4 * avgJaccard;

    const cosineBonus = this.getTierBonus(avgCosine, RecommenderService.COSINE_BONUS_TIERS);
    const jaccardBonus = this.getTierBonus(avgJaccard, RecommenderService.JACCARD_BONUS_TIERS);

    const rawScore = baseScore + cosineBonus + jaccardBonus;
    const normalizedScore = rawScore / RecommenderService.MAX_RAW_SCORE;

    return {
      combinedScore: Math.round(normalizedScore * 10000) / 10000,
      cosineScore: Math.round(avgCosine * 10000) / 10000,
      jaccardScore: Math.round(avgJaccard * 10000) / 10000,
    };
  }


  async getRecommendationsGrouped(
    userId: string,
    limit: number = 10,
  ): Promise<GroupedRecommendations> {
    const emptyResult: GroupedRecommendations = {
      topPicks: [],
      genreSections: [],
      userGenres: [],
    };

    const history = await this.getUserHistory(userId);

    if (history.length === 0) {
      return emptyResult;
    }

    const watchedMovieIds = new Set(history.map((h) => h.movieId));

    const watchedEmbeddings: MovieEmbeddingEntity[] = [];
    const genreCount = new Map<string, number>();

    for (const movieId of watchedMovieIds) {
      const emb = await this.embeddingRepository.findOne({ where: { movieId } });
      if (emb) {
        watchedEmbeddings.push(emb);
        for (const genre of emb.genres) {
          const g = genre.trim();
          genreCount.set(g, (genreCount.get(g) || 0) + 1);
        }
      }
    }

    if (watchedEmbeddings.length === 0) {
      return emptyResult;
    }

    const sortedGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);

    const allEmbeddings = await this.embeddingRepository.find();

    const allScored: RecommendedMovie[] = [];

    for (const emb of allEmbeddings) {
      if (watchedMovieIds.has(emb.movieId)) continue;

      const { combinedScore, cosineScore, jaccardScore } =
        this.calculateCombinedScore(emb, watchedEmbeddings);

      allScored.push({
        movieId: emb.movieId,
        title: emb.title,
        genres: emb.genres,
        similarityScore: combinedScore,
        cosineScore,
        jaccardScore,
      });
    }

    allScored.sort((a, b) => b.similarityScore - a.similarityScore);

    const topPicks = allScored.slice(0, limit);

    const genreSections: GenreSection[] = [];

    for (const genre of sortedGenres) {
      const genreMovies = allScored
        .filter((m) => {
          const hasGenre = m.genres.some(
            (g) => g.toLowerCase() === genre.toLowerCase(),
          );
          return hasGenre;
        })
        .slice(0, 8);

      if (genreMovies.length > 0) {
        genreSections.push({
          genre,
          movies: genreMovies,
        });
      }
    }

    return {
      topPicks,
      genreSections,
      userGenres: sortedGenres,
    };
  }

  private async fetchAllMovies(): Promise<MovieInfo[]> {
    try {
      const response = await fetch(`${this.movieServiceUrl}/movies`);
      if (!response.ok) return [];
      return (await response.json()) as MovieInfo[];
    } catch {
      return [];
    }
  }
}

