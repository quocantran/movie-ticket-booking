import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MovieEntity } from '../entities/movie.entity';
import { ShowtimeEntity } from '../entities/showtime.entity';
import {
  OutboxService,
  AGGREGATE_TYPES,
  EVENT_TYPES,
  MovieCreatedPayload,
} from '@app/common';

export interface CreateMovieDto {
  title: string;
  genre: string;
  duration: number;
  posterUrl?: string;
  description?: string;
}

export interface CreateShowtimeDto {
  hall: string;
  startTime: string;
  price: number;
}

@Injectable()
export class MovieService {
  private readonly seatServiceUrl =
    process.env.SEAT_SERVICE_URL || 'http://localhost:5002';

  constructor(
    @InjectRepository(MovieEntity)
    private readonly movieRepository: Repository<MovieEntity>,
    @InjectRepository(ShowtimeEntity)
    private readonly showtimeRepository: Repository<ShowtimeEntity>,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
  ) {}

  async createMovie(dto: CreateMovieDto): Promise<MovieEntity> {
    if (!dto.title || !dto.genre || !dto.duration) {
      throw new BadRequestException('Thiếu thông tin bắt buộc: title, genre, duration');
    }

    const movieId = uuidv4();

    const result: MovieEntity = await this.dataSource.transaction(async (manager) => {
      const movieRepo = manager.getRepository(MovieEntity);
      const newMovie = new MovieEntity();
      newMovie.id = movieId;
      newMovie.title = dto.title;
      newMovie.genre = dto.genre;
      newMovie.duration = dto.duration;
      newMovie.posterUrl = dto.posterUrl || '';
      newMovie.description = dto.description || '';
      await movieRepo.save(newMovie);

      const payload: MovieCreatedPayload = {
        movieId: newMovie.id,
        title: newMovie.title,
        genre: newMovie.genre,
        description: newMovie.description || '',
        duration: newMovie.duration,
        posterUrl: newMovie.posterUrl || undefined,
      };

      await this.outboxService.createEventInTransaction(manager, {
        aggregateType: AGGREGATE_TYPES.MOVIE,
        aggregateId: newMovie.id,
        eventType: EVENT_TYPES.MOVIE_CREATED,
        payload,
      });

      return newMovie;
    });

    return result;
  }

  async createShowtime(
    movieId: string,
    dto: CreateShowtimeDto,
  ): Promise<ShowtimeEntity & { seatsGenerated: number }> {
    await this.findMovieById(movieId);

    if (!dto.hall || !dto.startTime || !dto.price) {
      throw new BadRequestException('Thiếu thông tin: hall, startTime, price');
    }

    const showtimeId = uuidv4();
    const showtime = new ShowtimeEntity();
    showtime.id = showtimeId;
    showtime.movieId = movieId;
    showtime.hall = dto.hall;
    showtime.startTime = new Date(dto.startTime);
    showtime.price = dto.price;
    await this.showtimeRepository.save(showtime);

    let seatsGenerated = 0;
    try {
      const response = await fetch(`${this.seatServiceUrl}/seats/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showtimeId, rows: 5, cols: 8 }),
      });
      if (response.ok) {
        const data = await response.json();
        seatsGenerated = data.generated || 0;
      }
    } catch {}

    return { ...showtime, seatsGenerated };
  }

  async findAllMovies(): Promise<MovieEntity[]> {
    return this.movieRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findMovieById(id: string): Promise<MovieEntity> {
    const movie = await this.movieRepository.findOne({ where: { id } });
    if (!movie) {
      throw new NotFoundException(`Không tìm thấy phim với ID: ${id}`);
    }
    return movie;
  }

  async findShowtimesByMovieId(movieId: string): Promise<ShowtimeEntity[]> {
    await this.findMovieById(movieId);
    return this.showtimeRepository.find({
      where: { movieId },
      order: { startTime: 'ASC' },
    });
  }
}
