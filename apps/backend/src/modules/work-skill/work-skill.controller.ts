import { Controller } from '@nestjs/common';
import { WorkSkillService } from './work-skill.service';

@Controller('work-skill')
export class WorkSkillController {
    constructor(private readonly workSkillService: WorkSkillService) {}
}
