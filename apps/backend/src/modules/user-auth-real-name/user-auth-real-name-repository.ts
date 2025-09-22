import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DB } from "src/common/database/database.provider";
import { DbType } from "src/common/database/db";
import { userProfiles } from "src/common/database/schema";
import { CreateUserAuthRealName, UpdateUserAuthRealName } from "@repo/types";
import { eq, sql } from "drizzle-orm";

@Injectable()
export class UserAuthRealNameRepository {
	@Inject(DB)
	private readonly db: DbType;

	async isExist(userId: string) {
		console.log("userId:", userId);
		const s = sql`SELECT EXISTS (SELECT 1 FROM ${userProfiles} WHERE ${userProfiles.userId} = ${userId}) AS has_user_profile_users`;
		const result = await this.db.execute<{
			has_user_profile_users: boolean;
		}>(s);

		return result.rows[0].has_user_profile_users;
	}

	async createUserRealNameAuth(data: CreateUserAuthRealName) {
		if (await this.isExist(data.userId)) {
			throw new BadRequestException("当前已存在该用户的实名信息");
		}

		const result = await this.db.insert(userProfiles).values(data).returning();
		return result;
	}

	async updateUserRealNameAuth(data: UpdateUserAuthRealName) {
		if (!(await this.isExist(data.userId))) {
			throw new BadRequestException("当前用户不存在");
		}

		const result = await this.db
			.update(userProfiles)
			.set(data)
			.where(eq(userProfiles.userId, data.userId))
			.returning();
		return result;
	}

	async deleteUpdateUserRealNameAuth(id: string) {
		if (!(await this.isExist(id))) {
			throw new BadRequestException("当前用户不存在");
		}

		const result = await this.db
			.delete(userProfiles)
			.where(eq(userProfiles.userId, id));
		return result;
	}

	async getUserRealNameByUserId(id: string) {
		const result = await this.db
			.select()
			.from(userProfiles)
			.where(eq(userProfiles.userId, id));
		return result[0];
	}
}
