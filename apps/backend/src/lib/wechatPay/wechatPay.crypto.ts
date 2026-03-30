import {
    constants,
    createDecipheriv,
    publicEncrypt,
    createSign,
    createVerify,
    randomBytes,
} from 'node:crypto';

export function createWechatPayNonce(size = 16) {
    return randomBytes(size).toString('hex').toUpperCase();
}

export function signWechatPayMessage(message: string, privateKeyPem: string) {
    const signer = createSign('RSA-SHA256');
    signer.update(message, 'utf8');
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
}

export function verifyWechatPaySignature({
    message,
    signature,
    publicKeyPem,
}: {
    message: string;
    signature: string;
    publicKeyPem: string;
}) {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    verifier.end();
    return verifier.verify(publicKeyPem, signature, 'base64');
}

export function decryptWechatPayAead({
    apiV3Key,
    associatedData,
    nonce,
    ciphertext,
}: {
    apiV3Key: string;
    associatedData?: string;
    nonce: string;
    ciphertext: string;
}) {
    const key = Buffer.from(apiV3Key, 'utf8');
    const encrypted = Buffer.from(ciphertext, 'base64');
    const authTag = encrypted.subarray(encrypted.length - 16);
    const data = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(nonce, 'utf8'),
    );

    if (associatedData) {
        decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    return decrypted.toString('utf8');
}

export function encryptWechatPaySensitiveField({
    plaintext,
    publicKeyPem,
}: {
    plaintext: string;
    publicKeyPem: string;
}) {
    return publicEncrypt(
        {
            key: publicKeyPem,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha1',
        },
        Buffer.from(plaintext, 'utf8'),
    ).toString('base64');
}
