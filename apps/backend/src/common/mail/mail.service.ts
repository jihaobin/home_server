import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { CACHE_SERVICE, IAdvancedCacheService } from '../cache';
import { AppLoggerService } from '../logger';

export interface MailInfo {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export interface TemplateVariables {
    logo: string; // logo图片地址
    userName: string;
    expiredTime: string; // 链接失效时间
    productName: string;
    registerOrRester: '注册' | '重置密码'; // 注册或重置密码
    url: string; // 邮件链接
    buttonText: string; // 按钮文字
    [key: string]: string;
}

// 邮件发送限制配置
const MAIL_LIMITS = {
    // 同一邮箱限制
    EMAIL_INTERVAL: 60, // 同一邮箱发送间隔（秒）
    EMAIL_DAILY_LIMIT: 5, // 同一邮箱每天最大发送次数

    // 系统总量限制
    DAILY_TOTAL_LIMIT: 1000, // 每天系统总发送量
    HOURLY_TOTAL_LIMIT: 100, // 每小时系统总发送量

    // 邮件大小限制
    MAX_TEXT_LENGTH: 5000, // 文本内容最大长度
    MAX_HTML_LENGTH: 10000, // HTML内容最大长度
} as const;

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    // 注入日志记录器
    @Inject(CACHE_SERVICE)
    private readonly cacheService: IAdvancedCacheService;

    constructor(
        private configService: ConfigService,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(MailService.name);
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('MAIL_HOST'),
            port: this.configService.get<number>('MAIL_PORT', 465),
            secure: true,
            auth: {
                user: this.configService.get<string>('MAIL_USER'),
                pass: this.configService.get<string>('MAIL_PASS'),
            },
        });
    }

    /**
     * 读取HTML模板文件
     * @param templateName 模板文件名
     * @returns 模板内容
     */
    private async readTemplate(templateName: string): Promise<string> {
        try {
            // 由于打包后文件在dist中，同时模板文件不会被打包进去，所以需要使用绝对路径
            const templatePath = path.join(
                process.cwd(),
                'src',
                'common',
                'mail',
                'templates',
                templateName,
            );
            return await fs.promises.readFile(templatePath, 'utf-8');
        } catch (error) {
            this.logger.error(`读取模板文件失败 (${templateName}):`, error);
            throw new BadRequestException('邮件模板加载失败');
        }
    }

    /**
     * 替换模板中的变量
     * @param template 模板内容
     * @param variables 变量对象
     * @returns 替换后的内容
     */
    private replaceTemplateVariables(
        template: string,
        variables: TemplateVariables,
    ): string {
        let result = template;

        // 替换所有 {{变量名}} 格式的占位符
        Object.keys(variables).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, variables[key]);
        });

        return result;
    }

    /**
     * 使用模板生成HTML邮件内容
     * @param templateName 模板文件名
     * @param variables 模板变量
     * @returns HTML内容
     */
    private async generateEmailFromTemplate(
        templateName: string,
        variables: TemplateVariables,
    ): Promise<string> {
        const template = await this.readTemplate(templateName);
        return this.replaceTemplateVariables(template, variables);
    }

    private getEmailKey(email: string) {
        return `mail:limit:email:${email}`;
    }

    private getEmailDailyKey(email: string) {
        const date = new Date().toISOString().split('T')[0];
        return `mail:limit:email:daily:${email}:${date}`;
    }

    private getDailyTotalKey() {
        const date = new Date().toISOString().split('T')[0];
        return `mail:limit:total:daily:${date}`;
    }

    private getHourlyTotalKey() {
        const date = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        return `mail:limit:total:hourly:${date}:${hour}`;
    }

    private async checkEmailLimit(email: string): Promise<void> {
        // 检查发送间隔
        const emailKey = this.getEmailKey(email);
        const lastSentTime = (await this.cacheService.get(emailKey)) as string;

        if (lastSentTime) {
            const remainingTime =
                MAIL_LIMITS.EMAIL_INTERVAL -
                Math.floor(
                    (Date.now() - parseInt(lastSentTime.toString())) / 1000,
                );
            if (remainingTime > 0) {
                throw new BadRequestException(
                    `请等待 ${remainingTime} 秒后再试`,
                );
            }
        }

        // 检查每日限制
        const dailyKey = this.getEmailDailyKey(email);
        const dailyCount = parseInt(
            (await this.cacheService.get(dailyKey)) || '0',
        );

        if (dailyCount >= MAIL_LIMITS.EMAIL_DAILY_LIMIT) {
            throw new BadRequestException(
                '该邮箱今日发送次数已达上限，请明天再试',
            );
        }
    }

    private async checkSystemLimit(): Promise<void> {
        // 检查每日总量
        const dailyKey = this.getDailyTotalKey();
        const dailyTotal = parseInt(
            (await this.cacheService.get(dailyKey)) || '0',
        );

        if (dailyTotal >= MAIL_LIMITS.DAILY_TOTAL_LIMIT) {
            throw new BadRequestException('系统今日邮件配额已用完，请明天再试');
        }

        // 检查每小时总量
        const hourlyKey = this.getHourlyTotalKey();
        const hourlyTotal = parseInt(
            (await this.cacheService.get(hourlyKey)) || '0',
        );

        if (hourlyTotal >= MAIL_LIMITS.HOURLY_TOTAL_LIMIT) {
            throw new BadRequestException(
                '系统当前小时邮件配额已用完，请稍后再试',
            );
        }
    }

    private checkContentSize(mailInfo: MailInfo): void {
        if (
            mailInfo.text &&
            mailInfo.text.length > MAIL_LIMITS.MAX_TEXT_LENGTH
        ) {
            throw new BadRequestException(
                `文本内容超出长度限制 ${MAIL_LIMITS.MAX_TEXT_LENGTH} 字符`,
            );
        }

        if (
            mailInfo.html &&
            mailInfo.html.length > MAIL_LIMITS.MAX_HTML_LENGTH
        ) {
            throw new BadRequestException(
                `HTML内容超出长度限制 ${MAIL_LIMITS.MAX_HTML_LENGTH} 字符`,
            );
        }
    }

    private async updateLimits(email: string): Promise<void> {
        // 更新邮箱最后发送时间
        const emailKey = this.getEmailKey(email);
        await this.cacheService.set(
            emailKey,
            Date.now().toString(),
            MAIL_LIMITS.EMAIL_INTERVAL,
        );

        // 更新邮箱每日发送次数
        const dailyKey = this.getEmailDailyKey(email);
        await this.cacheService.increment(dailyKey, 1, 86400); // 24小时过期

        // 更新系统每日总量
        const dailyTotalKey = this.getDailyTotalKey();
        await this.cacheService.increment(dailyTotalKey, 1, 86400);

        // 更新系统每小时总量
        const hourlyKey = this.getHourlyTotalKey();
        await this.cacheService.increment(hourlyKey, 1, 3600);
    }

    async sendEmail(mailInfo: MailInfo) {
        // 检查内容大小
        this.checkContentSize(mailInfo);

        // 检查发送限制
        await this.checkEmailLimit(mailInfo.to);
        await this.checkSystemLimit();

        // 发送邮件
        const info = await this.transporter.sendMail({
            from: `${this.configService.get<string>('MAIL_FROM_NAME', 'Cow Course')} <${this.configService.get<string>('MAIL_USER')}>`,
            ...mailInfo,
        });

        // 更新限制计数
        await this.updateLimits(mailInfo.to);

        return info;
    }

    /**
     * 发送邮箱验证邮件
     * @param email 用户邮箱
     * @param verificationUrl 验证链接
     * @param userName 用户名（可选）
     */
    async sendVerificationEmail(
        email: string,
        verificationUrl: string,
        userName: string = '用户',
    ): Promise<void> {
        try {
            const subject = '验证您的邮箱地址';

            // 定义模板变量
            const templateVariables: TemplateVariables = {
                logo: '',
                userName: userName,
                expiredTime: '30分钟',
                productName: '小牛课堂',
                registerOrRester: '注册',
                url: verificationUrl,
                buttonText: '验证邮箱地址',
            };

            // 使用模板生成HTML内容
            const html = await this.generateEmailFromTemplate(
                'template.html',
                templateVariables,
            );

            // 生成纯文本版本作为备用
            const text = `
邮箱验证

尊敬的${userName}，您好！

我们收到了您对Cow Course的注册请求。为确保账户安全，请完成以下验证步骤：

请访问以下链接验证您的邮箱地址：
${verificationUrl}

该链接将在24小时后失效。如果您没有进行此操作，请忽略此邮件，您的账户仍然是安全的。

感谢您选择我们的产品！


此邮件为系统自动发送，请勿直接回复。
      `.trim();

            await this.sendEmail({
                to: email,
                subject,
                html,
                text,
            });

            this.logger.log(`验证邮件已发送到: ${email}`, email);
        } catch (error) {
            this.logger.error(`发送验证邮件失败 (${email}):`, error);
            throw new BadRequestException('验证邮件发送失败，请稍后重试');
        }
    }

    /**
     * 发送密码重置邮件
     * @param email 用户邮箱
     * @param resetUrl 重置链接
     * @param userName 用户名（可选）
     */
    async sendResetPasswordEmail(
        email: string,
        resetUrl: string,
        userName: string = '用户',
    ): Promise<void> {
        try {
            const subject = '重置您的密码';

            // 定义模板变量
            const templateVariables: TemplateVariables = {
                logo: '',
                userName: userName,
                expiredTime: '30分钟',
                productName: '小牛课堂',
                registerOrRester: '重置密码',
                url: resetUrl,
                buttonText: '重置密码',
            };

            // 使用模板生成HTML内容
            const html = await this.generateEmailFromTemplate(
                'template.html',
                templateVariables,
            );

            // 生成纯文本版本作为备用
            const text = `
密码重置

尊敬的${userName}，您好！

我们收到了您对Cow Course的密码重置请求。为确保账户安全，请完成以下步骤：

请访问以下链接重置您的密码：
${resetUrl}

该链接将在30分钟内有效。如果您没有进行此操作，请忽略此邮件，您的账户仍然是安全的。

感谢您选择我们的产品！


此邮件为系统自动发送，请勿直接回复。
      `.trim();

            await this.sendEmail({
                to: email,
                subject,
                html,
                text,
            });

            this.logger.log(`密码重置邮件已发送到: ${email}`, email);
        } catch (error) {
            this.logger.error(`发送密码重置邮件失败 (${email}):`, error);
            throw new BadRequestException('密码重置邮件发送失败，请稍后重试');
        }
    }
}
