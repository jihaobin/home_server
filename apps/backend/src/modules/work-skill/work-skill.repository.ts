import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ServicePersonnel } from "@repo/types";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DB } from "src/common/database/database.provider";
import { DbType } from "src/common/database/db";
import {
	servicePersonnel,
	servicePersonnelSkills,
	servicePersonnelPricing,
	users,
} from "src/common/database/schema";

@Injectable()
export class WorkSkillRepository {
	@Inject(DB)
	private readonly db: DbType;

	/**
	 * 设置或更新工作人员的工作信息
	 *
	 * 功能说明：
	 * - 如果工作人员不存在，则创建新记录
	 * - 如果工作人员已存在，则更新现有记录
	 * - 使用upsert机制保证操作的幂等性
	 *
	 * @param info 工作人员信息，必须包含userId
	 * @returns 返回创建或更新后的工作人员信息
	 * @throws 参数无效时抛出异常
	 */
	async upsertWorkInfo(
		info: Omit<ServicePersonnel, "geom"> & {
			location: { lng: number; lat: number };
		},
	) {
		// 检查用户是否存在于users表中
		if (!(await this.isUserExists(info.userId))) {
			throw new BadRequestException("用户不存在，无法创建服务人员信息");
		}

		// 使用 onConflictDoUpdate 实现 upsert 操作
		const result = await this.db
			.insert(servicePersonnel)
			.values({ ...info, geom: [info.location.lng, info.location.lat] })
			.onConflictDoUpdate({
				target: servicePersonnel.userId,
				set: {
					bio: info.bio,
					province: info.province,
					district: info.district,
					county: info.county,
					yearsOfExperience: info.yearsOfExperience,
					workStartTime: info.workStartTime,
					workEndTime: info.workEndTime,
					isAvailable: info.isAvailable,
				},
			})
			.returning();

		return result[0];
	}

	/**
	 * 设置工作人员能够提供的服务技能
	 *
	 * 功能说明：
	 * - 支持新增绑定：如果工作人员之前没有任何技能，会直接添加所有指定的服务技能
	 * - 支持完整更新：会智能计算差异，只添加新技能，删除不再需要的技能
	 * - 事务安全：所有操作都在数据库事务中进行，保证数据一致性
	 *
	 * @param serviceIds 服务ID数组，传入空数组将清除该工作人员的所有技能
	 * @param personnelId 工作人员用户ID
	 * @returns 返回操作统计信息：{added: 新增数量, removed: 删除数量}
	 * @throws 参数无效时抛出异常
	 */
	async updatePersonnelSkills(serviceIds: string[], personnelId: string) {
		// 检查服务人员是否存在
		if (!(await this.isServicePersonnelExists(personnelId))) {
			throw new BadRequestException("该服务人员不存在");
		}

		// 去重处理
		const uniqueServiceIds = [...new Set(serviceIds.filter(Boolean))];
		// 2. 在事务中操作
		return await this.db.transaction(async (tx) => {
			// 3. 获取现有技能
			const existing = await tx
				.select({ serviceId: servicePersonnelSkills.serviceId })
				.from(servicePersonnelSkills)
				.where(eq(servicePersonnelSkills.userId, personnelId));

			const existingIds = existing.map((e) => e.serviceId);

			// 4. 计算差异
			const toAdd = uniqueServiceIds.filter((id) => !existingIds.includes(id));
			const toRemove = existingIds.filter(
				(id) => !uniqueServiceIds.includes(id),
			);

			// 5. 执行变更
			if (toRemove.length > 0) {
				await tx
					.delete(servicePersonnelSkills)
					.where(
						and(
							eq(servicePersonnelSkills.userId, personnelId),
							inArray(servicePersonnelSkills.serviceId, toRemove),
						),
					);
			}

			if (toAdd.length > 0) {
				await tx.insert(servicePersonnelSkills).values(
					toAdd.map((serviceId) => ({
						serviceId,
						userId: personnelId,
					})),
				);
			}

			return { added: toAdd.length, removed: toRemove.length };
		});
	}

	/**
	 * 获取工作人员的完整信息
	 *
	 * @param personnelId 工作人员用户ID
	 * @returns 返回工作人员信息及其技能列表，不存在时返回null
	 * @throws 参数无效时抛出异常
	 */
	async getPersonnelInfo(personnelId: string, serviceId?: string) {
		// 参数验证
		if (!personnelId || typeof personnelId !== "string") {
			throw new Error("工作人员ID不能为空");
		}

		const result = await this.db.query.servicePersonnel.findFirst({
			where: (servicePersonnel, { eq }) =>
				eq(servicePersonnel.userId, personnelId),
			with: {
				skills: {
					with: {
						service: true, // 包含服务详细信息
					},
					where: (servicePersonnelSkills, { eq, and }) => {
						if (serviceId) {
							return and(eq(servicePersonnelSkills.serviceId, serviceId));
						}
					},
				},
				pricing: true,
			},
		});

		// 如果没有找到结果，直接返回
		if (!result) {
			return null;
		}

		// 重构数据结构，将定价信息合并到技能信息中
		const { pricing, skills, ...personnelInfo } = result;

		// 创建定价映射，便于快速查找
		const pricingMap = new Map(pricing.map((p) => [p.serviceId, p]));

		// 合并技能和定价信息
		const skillsWithPrice = skills.map((skill) => {
			const priceInfo = pricingMap.get(skill.serviceId);
			return {
				...skill.service,
				price: priceInfo,
			};
		});

		// 返回新的数据结构
		return {
			...personnelInfo,
			skills: skillsWithPrice,
		};
	}

	/**
	 * 检查用户是否存在于users表中
	 *
	 * @param userId 用户ID
	 * @returns 存在返回true，不存在返回false
	 */
	async isUserExists(userId: string): Promise<boolean> {
		const s = sql`SELECT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${userId}) AS user_exists`;
		const result = await this.db.execute<{
			user_exists: boolean;
		}>(s);

		return result.rows[0].user_exists;
	}

	/**
	 * 检查服务人员是否存在于service_personnel表中
	 *
	 * @param personnelId 服务人员用户ID
	 * @returns 存在返回true，不存在返回false
	 */
	async isServicePersonnelExists(personnelId: string): Promise<boolean> {
		const s = sql`SELECT EXISTS (SELECT 1 FROM ${servicePersonnel} WHERE ${servicePersonnel.userId} = ${personnelId}) AS personnel_exists`;
		const result = await this.db.execute<{
			personnel_exists: boolean;
		}>(s);

		return result.rows[0].personnel_exists;
	}

	/**
	 * 设置或更新服务人员的个人定价
	 *
	 * @param personnelId 服务人员用户ID
	 * @param serviceId 服务ID
	 * @param price 个人定价
	 * @param currency 币种代码
	 * @returns 返回定价记录
	 */
	async upsertPersonnelPricing(
		personnelId: string,
		serviceId: string,
		price: string,
		currency: string = "CNY",
	) {
		// 检查服务人员是否存在
		if (!(await this.isServicePersonnelExists(personnelId))) {
			throw new BadRequestException("该服务人员不存在");
		}

		const now = new Date();

		// 使用 upsert 操作
		const result = await this.db
			.insert(servicePersonnelPricing)
			.values({
				userId: personnelId,
				serviceId,
				price,
				currency,
				isActive: true,
				effectiveFrom: now,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [
					servicePersonnelPricing.userId,
					servicePersonnelPricing.serviceId,
				],
				set: {
					price,
					currency,
					isActive: true,
					effectiveFrom: now,
					updatedAt: now,
				},
			})
			.returning();

		return result[0];
	}

	/**
	 * 获取服务人员的所有定价
	 *
	 * @param personnelId 服务人员用户ID
	 * @returns 返回定价列表
	 */
	async getPersonnelPricing(personnelId: string) {
		return await this.db
			.select({
				id: servicePersonnelPricing.id,
				serviceId: servicePersonnelPricing.serviceId,
				price: servicePersonnelPricing.price,
				currency: servicePersonnelPricing.currency,
				isActive: servicePersonnelPricing.isActive,
				effectiveFrom: servicePersonnelPricing.effectiveFrom,
				effectiveTo: servicePersonnelPricing.effectiveTo,
			})
			.from(servicePersonnelPricing)
			.where(
				and(
					eq(servicePersonnelPricing.userId, personnelId),
					eq(servicePersonnelPricing.isActive, true),
				),
			);
	}

	/**
	 * 删除服务人员的定价
	 *
	 * @param personnelId 服务人员用户ID
	 * @param serviceId 服务ID
	 * @returns 返回是否成功
	 */
	async removePersonnelPricing(personnelId: string, serviceId: string) {
		const result = await this.db
			.update(servicePersonnelPricing)
			.set({
				isActive: false,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(servicePersonnelPricing.userId, personnelId),
					eq(servicePersonnelPricing.serviceId, serviceId),
				),
			)
			.returning();

		return result.length > 0;
	}
}
