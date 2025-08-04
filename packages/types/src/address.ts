import { z } from 'zod/v4';

export const AddressQuerySchema = z.object({
    filter: z.enum(['all', 'province', 'city', 'area']).meta({
        title: '筛选条件',
        examples: [
            'all-获取所有地址',
            'province-获取省份',
            'city-获取城市',
            'area-获取市区'
        ]
    }),
})



export type AddressQuery = z.infer<typeof AddressQuerySchema>;
