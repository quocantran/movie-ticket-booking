import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RecommenderService } from '../services/recommender.service';
import { JwtAuthGuard, JwtPayload } from '@app/common';
import { Request } from 'express';

@Controller()
export class RecommenderController {
  constructor(private readonly recommenderService: RecommenderService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'ai-recommender-service' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommendations/grouped')
  async getRecommendationsGrouped(
    @Req() req: Request,
    @Query('limit') limitStr?: string,
  ) {
    const user = (req as any).user as JwtPayload;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    const grouped = await this.recommenderService.getRecommendationsGrouped(
      user.sub,
      limit,
    );

    return {
      userId: user.sub,
      ...grouped,
    };
  }
}

