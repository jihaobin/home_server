import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';

@Injectable()
export class WorkSkillRepository {
    @Inject(DB)
    private readonly db: DbType;

    async bindWorkSkill(workId: string, skillId: string[]) {}
}
