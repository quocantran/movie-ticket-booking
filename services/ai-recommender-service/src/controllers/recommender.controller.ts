import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RecommenderService } from '../services/recommender.service';
import { JwtAuthGuard, JwtPayload, SERVICE_NAMES } from '@app/common';
import { Request } from 'express';
import { AI_CONFIG } from '../constants/ai.constants';

@Controller()
export class RecommenderController {
  constructor(private readonly recommenderService: RecommenderService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: SERVICE_NAMES.AI_RECOMMENDER };
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommendations/grouped')
  async getRecommendationsGrouped(
    @Req() req: Request,
    @Query('limit') limitStr?: string,
  ) {
    const user = (req as any).user as JwtPayload;
    const limit = limitStr ? parseInt(limitStr, 10) : AI_CONFIG.DEFAULT_RECOMMENDATION_LIMIT;

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

