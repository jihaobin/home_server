import { Module } from '@nestjs/common';
import { WorkSkillService } from './work-skill.service';
import { WorkSkillController } from './work-skill.controller';
import { WorkSkillRepository } from './work-skill.repository';

@Module({
    controllers: [WorkSkillController],
    providers: [WorkSkillService, WorkSkillRepository],
})
export class WorkSkillModule {}
