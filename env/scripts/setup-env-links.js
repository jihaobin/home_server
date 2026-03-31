#!/usr/bin/env node

/**
 * 环境变量软连接设置脚本
 * 为各个子项目创建对应的环境变量文件软连接
 */

const fs = require("fs");
const path = require("path");

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, "../..");

// 环境变量配置映射
const ENV_CONFIG = {
    // Backend项目配置
    "apps/backend": {
        development: [
            "env/development/.env.api",
            "env/development/.env.common",
        ],
        production: ["env/production/.env.api", "env/production/.env.common"],
    },
    // Admin Web项目配置
    "apps/admin-web": {
        development: [
            "env/development/.env.admin",
            "env/development/.env.common",
        ],
        production: ["env/production/.env.admin", "env/production/.env.common"],
    },
    // Marketing Web项目配置
    "apps/marketing-web": {
        development: [
            "env/development/.env.marketing",
            "env/development/.env.common",
        ],
        production: [
            "env/production/.env.marketing",
            "env/production/.env.common",
        ],
    },
    // Mobile User项目配置
    "apps/mobile-user": {
        development: [
            "env/development/.env.mobile",
            "env/development/.env.mobile-user",
            "env/development/.env.common",
        ],
        production: [
            "env/production/.env.mobile",
            "env/production/.env.mobile-user",
            "env/production/.env.common",
        ],
    },
    // Mobile Worker项目配置
    "apps/mobile-worker": {
        development: [
            "env/development/.env.mobile",
            "env/development/.env.mobile-worker",
            "env/development/.env.common",
        ],
        production: [
            "env/production/.env.mobile",
            "env/production/.env.mobile-worker",
            "env/production/.env.common",
        ],
    },
};

/**
 * 创建软连接
 * @param {string} target - 目标文件路径
 * @param {string} link - 软连接路径
 */
function createSymlink(target, link) {
    try {
        // 检查目标文件是否存在
        if (!fs.existsSync(target)) {
            console.warn(`⚠️  目标文件不存在: ${target}`);
            return false;
        }

        // 如果软连接已存在，先删除
        if (fs.existsSync(link)) {
            fs.unlinkSync(link);
        }

        // 创建软连接
        fs.symlinkSync(path.relative(path.dirname(link), target), link);
        console.log(`✅ 创建软连接: ${link} -> ${target}`);
        return true;
    } catch (error) {
        console.error(`❌ 创建软连接失败: ${link} -> ${target}`, error.message);
        return false;
    }
}

/**
 * 合并多个环境变量文件内容
 * @param {string[]} envFiles - 环境变量文件路径数组
 * @param {string} outputFile - 输出文件路径
 */
function mergeEnvFiles(envFiles, outputFile) {
    try {
        let mergedContent = "";

        for (const envFile of envFiles) {
            const fullPath = path.resolve(ROOT_DIR, envFile);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, "utf8");
                mergedContent += `\n# ===== 来自 ${envFile} =====\n`;
                mergedContent += content;
                mergedContent += "\n";
            } else {
                console.warn(`⚠️  环境变量文件不存在: ${fullPath}`);
            }
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入合并后的内容
        fs.writeFileSync(outputFile, mergedContent);
        console.log(`✅ 合并环境变量文件: ${outputFile}`);
        return true;
    } catch (error) {
        console.error(`❌ 合并环境变量文件失败: ${outputFile}`, error.message);
        return false;
    }
}

/**
 * 为指定项目设置环境变量文件
 * @param {string} projectPath - 项目路径
 * @param {Object} envConfig - 环境配置
 */
function setupProjectEnv(projectPath, envConfig) {
    console.log(`\n🔧 设置项目环境变量: ${projectPath}`);

    const projectDir = path.resolve(ROOT_DIR, projectPath);

    // 确保项目目录存在
    if (!fs.existsSync(projectDir)) {
        console.warn(`⚠️  项目目录不存在: ${projectDir}`);
        return;
    }

    // 为每个环境创建对应的环境变量文件
    for (const [env, envFiles] of Object.entries(envConfig)) {
        const envFileName = `.env.${env}`;
        const envFilePath = path.join(projectDir, envFileName);

        // 合并多个环境变量文件
        mergeEnvFiles(envFiles, envFilePath);
    }
}

/**
 * 主函数
 */
function main() {
    console.log("🚀 开始设置环境变量软连接...\n");

    // 为每个项目设置环境变量
    for (const [projectPath, envConfig] of Object.entries(ENV_CONFIG)) {
        setupProjectEnv(projectPath, envConfig);
    }

    console.log("\n✨ 环境变量设置完成！");
    console.log("\n📝 使用说明:");
    console.log("  - 开发环境: pnpm dev (自动加载 .env.development)");
    console.log(
        "  - 生产环境: pnpm build && pnpm start (自动加载 .env.production)",
    );
    console.log(
        "  - 手动指定: dotenvx run -f .env.development -- your-command",
    );
}

// 执行主函数
if (require.main === module) {
    main();
}

module.exports = {
    setupProjectEnv,
    mergeEnvFiles,
    createSymlink,
};
