import { pgTable, varchar, integer, index } from "drizzle-orm/pg-core";

export const chinaCity = pgTable(
	"china_city",
	{
		id: integer("id").primaryKey().notNull(),
		pid: integer("pid").notNull(),
		deep: integer("deep").notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		pinyinPrefix: varchar("pinyin_prefix", { length: 255 }).notNull(),
		pinyin: varchar("pinyin", { length: 255 }).notNull(),
		extId: varchar("ext_id", { length: 255 }).notNull(),
		ext_name: varchar("ext_name", { length: 255 }).notNull(),
	},
	(table) => [
		// 根据父ID查询子城市索引
		index("idx_accounts_pid").on(table.pid),

		// 根据城市名称查询索引
		index("idx_accounts_name").on(table.name),

		// 根据拼音前缀查询索引，适用于按字母排序和搜索
		index("idx_accounts_pinyin_prefix").on(table.pinyinPrefix),

		// 根据拼音查询索引，适用于拼音搜索
		index("idx_accounts_pinyin").on(table.pinyin),

		// 根据层级深度查询索引
		index("idx_accounts_deep").on(table.deep),

		// 根据外部ID查询索引
		index("idx_accounts_ext_id").on(table.extId),
	],
);
