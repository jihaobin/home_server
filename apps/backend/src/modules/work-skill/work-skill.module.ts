import { Module } from '@nestjs/common';
import { WorkSkillService } from './work-skill.service';
import { WorkSkillController } from './work-skill.controller';

@Module({
    controllers: [WorkSkillController],
    providers: [WorkSkillService],
})
export class WorkSkillModule {}
