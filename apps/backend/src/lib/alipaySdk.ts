import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { AlipaySdk } from 'alipay-sdk';
import type { AlipaySdkConfig } from 'alipay-sdk/dist/commonjs/types';

function readOptionalEnv(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function getAlipayEncryptConfig(scope: 'default' | 'worker') {
    const encryptKey =
        scope === 'worker'
            ? readOptionalEnv('ALIPAY_WORKER_ENCRYPT_KEY') ||
              readOptionalEnv('ALIPAY_ENCRYPT_KEY')
            : readOptionalEnv('ALIPAY_ENCRYPT_KEY');

    return encryptKey
        ? ({ encryptKey } satisfies Pick<AlipaySdkConfig, 'encryptKey'>)
        : {};
}

export function createAliPaySdk() {
    if (!process.env.ALIPAY_APP_ID) throw new Error('没有设置appId');

    if (process.env.NODE_ENV === 'development') {
        if (!process.env.ALIPAY_PRIVATE_KEY)
            throw new Error('没有设置应用私钥');
        if (!process.env.ALIPAY_PUBLIC_KEY)
            throw new Error('没有设置支付宝公钥');

        return new AlipaySdk({
            // 设置应用 ID
            appId: process.env.ALIPAY_APP_ID || '',
            signType: 'RSA2',
            // 设置应用私钥
            privateKey: process.env.ALIPAY_PRIVATE_KEY || '',

            // 设置支付宝公钥
            alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',

            // 密钥类型，请与生成的密钥格式保持一致,参考平台配置一节
            // 设置网关地址，默认是 https://openapi.alipay.com

            endpoint: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
            gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
            ...getAlipayEncryptConfig('default'),
        });
    } else {
        // 在生产环境中，证书文件会被复制到 dist/alipay_certificate 目录
        // __dirname 在编译后是 dist/src/lib，所以需要向上两级到 dist，再进入 alipay_certificate
        const certPath = path.join(__dirname, '..', '..', 'alipay_certificate');

        return new AlipaySdk({
            // 设置应用 ID
            appId: process.env.ALIPAY_APP_ID,
            // 设置应用私钥
            privateKey: readFileSync(
                path.join(certPath, 'privateKey.pem'),
                'ascii',
            ),
            alipayRootCertPath: path.join(certPath, 'alipayRootCert.crt'),
            alipayPublicCertPath: path.join(
                certPath,
                'alipayCertPublicKey_RSA2.crt',
            ),
            appCertPath: path.join(
                certPath,
                'appCertPublicKey_2021006104614056.crt',
            ),
            // 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节
            // 设置网关地址，默认是 https://openapi.alipay.com
            endpoint: 'https://openapi.alipay.com',
            ...getAlipayEncryptConfig('default'),
        });
    }
}

export function createWorkerAliPaySdk() {
    const workerAppId = process.env.ALIPAY_WORKER_APP_ID;
    if (!workerAppId) {
        throw new Error('没有设置服务人员端 appId');
    }

    if (process.env.NODE_ENV === 'development') {
        const workerPrivateKey =
            process.env.ALIPAY_WORKER_PRIVATE_KEY ||
            process.env.ALIPAY_PRIVATE_KEY;
        if (!workerPrivateKey) {
            throw new Error('没有设置服务人员端应用私钥');
        }

        const workerPublicKey =
            process.env.ALIPAY_WORKER_PUBLIC_KEY ||
            process.env.ALIPAY_PUBLIC_KEY;
        if (!workerPublicKey) {
            throw new Error('没有设置服务人员端支付宝公钥');
        }

        return new AlipaySdk({
            appId: workerAppId,
            signType: 'RSA2',
            privateKey: workerPrivateKey,
            alipayPublicKey: workerPublicKey,
            endpoint: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
            gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
            ...getAlipayEncryptConfig('worker'),
        });
    }

    const certPath = path.join(__dirname, '..', '..', 'alipay_certificate');

    return new AlipaySdk({
        appId: workerAppId,
        // 设置应用私钥
        privateKey: readFileSync(
            path.join(certPath, 'privateKey.pem'),
            'ascii',
        ),
        alipayRootCertPath: path.join(certPath, 'wrok_alipayRootCert.crt'),
        alipayPublicCertPath: path.join(
            certPath,
            'work_alipayCertPublicKey_RSA2.crt',
        ),
        appCertPath: path.join(
            certPath,
            'work_appCertPublicKey_2021006119612034.crt',
        ),
        // 密钥类型，请与生成的密钥格式保持一致，参考平台配置一节
        // 设置网关地址，默认是 https://openapi.alipay.com
        endpoint: 'https://openapi.alipay.com',
        ...getAlipayEncryptConfig('worker'),
    });
}
