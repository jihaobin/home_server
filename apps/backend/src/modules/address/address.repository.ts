import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	AddressQuery,
	CreateUserAddress,
	UpdateUserAddress,
	UserAddresses,
} from "@repo/types";
import { eq } from "drizzle-orm";
import { DB } from "src/common/database/database.provider";
import { DbType } from "src/common/database/db";
import { userAddresses } from "src/common/database/schema";

@Injectable()
export class AddressRespository {
	@Inject(DB)
	private readonly db: DbType;

	/**
	 * 检查地址是否存在, 如果传入ID则优先使用ID进行查询
	 * @param phone 手机号
	 * @param id 地址ID（可选）
	 */
	private async isAddressExists(phone: string, id?: string): Promise<boolean> {
		try {
			if (id) {
				// 使用ID查询
				const result = await this.db.query.userAddresses.findFirst({
					where: (userAddresses, { eq }) => eq(userAddresses.id, id),
					columns: { id: true },
				});
				return !!result;
			} else {
				// 使用手机号查询
				const result = await this.db.query.userAddresses.findFirst({
					where: (userAddresses, { eq }) =>
						eq(userAddresses.recipientPhone, phone),
					columns: { id: true },
				});
				return !!result;
			}
		} catch (error) {
			console.error("检查地址是否存在时发生错误:", error);
			return false;
		}
	}

	find(query: AddressQuery) {
		switch (query.filter) {
			case "all":
				return this.db.query.chinaCity.findMany();
			case "province":
				return this.db.query.chinaCity.findMany({
					where: (chinaCity, { eq }) => eq(chinaCity.deep, 0),
				});
			case "city":
				return this.db.query.chinaCity.findMany({
					where: (chinaCity, { eq }) => eq(chinaCity.deep, 1),
				});
			case "area":
				return this.db.query.chinaCity.findMany({
					where: (chinaCity, { eq }) => eq(chinaCity.deep, 2),
				});
			default:
				return this.db.query.chinaCity.findMany();
		}
	}

	async createAddress(data: CreateUserAddress) {
		if (await this.isAddressExists(data.recipientPhone)) {
			throw new BadRequestException("当前已存在该手机用户的地址");
		}

		return this.db.insert(userAddresses).values({
			...data,
			geom: [data.lng, data.lat],
		});
	}

	async updateAddress(id: string, data: UpdateUserAddress) {
		if (!(await this.isAddressExists(data?.recipientPhone || "", id))) {
			throw new BadRequestException("当前该手机用户的地址不存在");
		}

		return this.db
			.update(userAddresses)
			.set({
				...data,
				...(data.lat && data.lng ? { geom: [data.lat, data.lng] } : {}),
			})
			.where(eq(userAddresses.userId, id));
	}

	async deleteAddress(id: string) {
		if (!(await this.isAddressExists("", id))) {
			throw new BadRequestException("当前该收货地址不存在");
		}
		return this.db.delete(userAddresses).where(eq(userAddresses.id, id));
	}

	async findByUserId(id: string): Promise<UserAddresses[]> {
		const response = await this.db.query.userAddresses.findMany({
			where: (userAddresses, { eq }) => eq(userAddresses.userId, id),
		});

		return response.map((item) => ({
			...item,
			addressName: item.addressName ?? "",
			homeNumber: item.homeNumber ?? "",
			city: item.city ?? "",
			district: item.district ?? "",
			geom: item.geom as number[] | undefined,
		}));
	}
}
