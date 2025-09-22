import { migrate } from "drizzle-orm/node-postgres/migrator";

import db from "./db";

async function main() {
	console.info("正在执行迁移");
	await migrate(db, { migrationsFolder: "drizzle" });
	console.info("迁移成功");
	return;
}

main()
	.catch((err) => {
		console.error("数据库迁移失败");
		console.error(err);
		process.exit(1);
	})
	.finally(() => {
		process.exit();
	});
