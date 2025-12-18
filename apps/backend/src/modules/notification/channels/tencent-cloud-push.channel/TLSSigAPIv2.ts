import { createHmac } from 'node:crypto';
import { deflateSync } from 'node:zlib';

type Maybe<T> = T | undefined;

interface SigDocument {
    'TLS.ver': '2.0';
    'TLS.identifier': string;
    'TLS.sdkappid': number;
    'TLS.time': number;
    'TLS.expire': number;
    'TLS.userbuf'?: string;
    'TLS.sig': string;
}

const base64UrlEscape = (value: string): string =>
    value.replace(/\+/g, '*').replace(/\//g, '-').replace(/=/g, '_');

const toBase64 = (value: Buffer | string): string =>
    Buffer.isBuffer(value)
        ? value.toString('base64')
        : Buffer.from(value, 'utf8').toString('base64');

export class TLSSigApi {
    constructor(
        private readonly sdkAppId: number,
        private readonly secretKey: string,
    ) {}

    genSig(userid: string, expire: number, userBuf?: Buffer): string {
        const current = Math.floor(Date.now() / 1000);
        const payload: SigDocument = {
            'TLS.ver': '2.0',
            'TLS.identifier': `${userid}`,
            'TLS.sdkappid': Number(this.sdkAppId),
            'TLS.time': current,
            'TLS.expire': Number(expire),
            'TLS.sig': '',
        };

        let encodedUserBuf: Maybe<string>;
        if (userBuf) {
            encodedUserBuf = toBase64(userBuf);
            payload['TLS.userbuf'] = encodedUserBuf;
        }

        payload['TLS.sig'] = this.hmacsha256(
            userid,
            current,
            expire,
            encodedUserBuf,
        );

        return base64UrlEscape(
            deflateSync(Buffer.from(JSON.stringify(payload), 'utf8')).toString(
                'base64',
            ),
        );
    }

    genUserSig(userid: string, expire: number): string {
        return this.genSig(userid, expire);
    }

    genPrivateMapKey(
        userid: string,
        expire: number,
        roomId: number,
        privilegeMap: number,
    ): string {
        const userBuf = this.genUserbuf(
            userid,
            roomId,
            expire,
            privilegeMap,
            0,
            undefined,
        );
        return this.genSig(userid, expire, userBuf);
    }

    genPrivateMapKeyWithStringRoomID(
        userid: string,
        expire: number,
        roomStr: string,
        privilegeMap: number,
    ): string {
        const userBuf = this.genUserbuf(
            userid,
            0,
            expire,
            privilegeMap,
            0,
            roomStr,
        );
        return this.genSig(userid, expire, userBuf);
    }

    private hmacsha256(
        identifier: string,
        current: number,
        expire: number,
        base64UserBuf: Maybe<string>,
    ): string {
        const segments = [
            `TLS.identifier:${identifier}`,
            `TLS.sdkappid:${this.sdkAppId}`,
            `TLS.time:${current}`,
            `TLS.expire:${expire}`,
        ];

        if (base64UserBuf) {
            segments.push(`TLS.userbuf:${base64UserBuf}`);
        }

        const content = `${segments.join('\n')}\n`;
        const hmac = createHmac('sha256', this.secretKey);
        hmac.update(content, 'utf8');
        return hmac.digest('base64');
    }

    private genUserbuf(
        account: string,
        authId: number,
        expTime: number,
        privilegeMap: number,
        accountType: number,
        roomStr?: string,
    ): Buffer {
        const accountLength = Buffer.byteLength(account);
        const roomStrLength = roomStr ? Buffer.byteLength(roomStr) : 0;
        let totalLength = 1 + 2 + accountLength + 20;

        if (roomStrLength > 0) {
            totalLength += 2 + roomStrLength;
        }

        const buffer = Buffer.alloc(totalLength);
        let offset = 0;

        buffer[offset++] = roomStrLength > 0 ? 1 : 0;
        buffer.writeUInt16BE(accountLength, offset);
        offset += 2;

        buffer.write(account, offset, accountLength, 'utf8');
        offset += accountLength;

        buffer.writeUInt32BE(this.sdkAppId >>> 0, offset);
        offset += 4;

        buffer.writeUInt32BE(authId >>> 0, offset);
        offset += 4;

        const expire = Math.floor(Date.now() / 1000 + expTime);
        buffer.writeUInt32BE(expire >>> 0, offset);
        offset += 4;

        buffer.writeUInt32BE(privilegeMap >>> 0, offset);
        offset += 4;

        buffer.writeUInt32BE(accountType >>> 0, offset);
        offset += 4;

        if (roomStrLength > 0 && roomStr) {
            buffer.writeUInt16BE(roomStrLength, offset);
            offset += 2;
            buffer.write(roomStr, offset, roomStrLength, 'utf8');
        }

        return buffer;
    }
}

export const Api = TLSSigApi;
export default { Api: TLSSigApi };
