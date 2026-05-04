import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MovieService, CreateMovieDto, CreateShowtimeDto } from '../services/movie.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';

@Controller()
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'movie-service' };
  }

  @Get('movies')
  async listMovies() {
    return this.movieService.findAllMovies();
  }

  @Get('movies/:id')
  async getMovieById(@Param('id') id: string) {
    return this.movieService.findMovieById(id);
  }

  @Get('movies/:id/showtimes')
  async getShowtimesByMovie(@Param('id') id: string) {
    return this.movieService.findShowtimesByMovieId(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('movies')
  async createMovie(@Body() dto: CreateMovieDto) {
    return this.movieService.createMovie(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('movies/:id/showtimes')
  async createShowtime(
    @Param('id') movieId: string,
    @Body() dto: CreateShowtimeDto,
  ) {
    return this.movieService.createShowtime(movieId, dto);
  }
}
