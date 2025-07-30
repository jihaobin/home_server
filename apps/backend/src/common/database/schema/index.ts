import { init } from '@paralleldrive/cuid2';

export * from './auth-user';

export const createId = init({
    length: 15,
});
