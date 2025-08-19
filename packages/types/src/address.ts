import { z } from 'zod/v4';
import { UserAddressesSchema } from './database-entity';

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



/**
 * 地址逆解析服务
 */

// 位置信息 Schema
export const LocationSchema = z.object({
    lat: z.number().describe('纬度'),
    lng: z.number().describe('经度'),
});

// 行政区划信息 Schema
export const AdInfoSchema = z.object({
    nation_code: z.string().describe('国家代码（ISO3166标准3位数字码）'),
    adcode: z.string().describe('行政区划代码'),
    city_code: z.string().describe('城市代码'),
    phone_area_code: z.string().optional().describe('城市电话区号'),
    name: z.string().describe('行政区划名称'),
    location: LocationSchema.describe('行政区划中心点坐标'),
    nation: z.string().describe('国家'),
    province: z.string().describe('省/直辖市'),
    city: z.string().describe('市/地级区及同级行政区划'),
    district: z.string().optional().describe('区/县级市及同级行政区划'),
});

// 地址组件 Schema
export const AddressComponentSchema = z.object({
    nation: z.string().describe('国家'),
    province: z.string().describe('省'),
    city: z.string().describe('市'),
    district: z.string().optional().describe('区，可能为空字符串'),
    street: z.string().optional().describe('道路，可能为空字符串'),
    street_number: z.string().optional().describe('门牌，可能为空字符串'),
});

// 参考位置信息通用结构 Schema
export const ReferenceLocationSchema = z.object({
    id: z.string().describe('地点唯一标识'),
    title: z.string().optional().describe('名称/标题'),
    location: LocationSchema.optional().describe('坐标'),
    _distance: z.number().optional().describe('此参考位置到输入坐标的直线距离'),
    _dir_desc: z.string().optional().describe('此参考位置到输入坐标的方位关系'),
});

// 地址参考信息 Schema
export const AddressReferenceSchema = z.object({
    famous_area:
        ReferenceLocationSchema.optional().describe('知名区域，如商圈'),
    business_area: ReferenceLocationSchema.optional().describe('商圈'),
    town: ReferenceLocationSchema.optional().describe(
        '乡镇/街道（四级行政区划）',
    ),
    landmark_l1: ReferenceLocationSchema.optional().describe('一级地标'),
    landmark_l2: ReferenceLocationSchema.optional().describe('二级地标'),
    street: ReferenceLocationSchema.optional().describe('道路'),
    street_number: ReferenceLocationSchema.optional().describe('门牌'),
    crossroad: ReferenceLocationSchema.optional().describe('交叉路口'),
    water: ReferenceLocationSchema.optional().describe('水系'),
});

// 海洋信息 Schema
export const OceanSchema = z.object({
    id: z.string().optional().describe('海洋唯一标识'),
    title: z.string().optional().describe('海洋名称'),
});

// 格式化地址 Schema
export const FormattedAddressesSchema = z.object({
    recommend: z.string().optional().describe('推荐使用的地址描述'),
    rough: z.string().optional().describe('粗略位置描述'),
    standard_address: z
        .string()
        .optional()
        .describe('基于附近关键地点（POI）的精确地址'),
});

// POI 行政区划信息 Schema
export const PoiAdInfoSchema = z.object({
    adcode: z.string().describe('行政区划代码'),
    province: z.string().optional().describe('省'),
    city: z.string().optional().describe('市'),
    district: z.string().optional().describe('区'),
});

// POI 信息 Schema
export const PoiSchema = z.object({
    id: z.string().optional().describe('地点（POI）唯一标识'),
    title: z.string().optional().describe('名称'),
    address: z.string().optional().describe('地址'),
    category: z.string().optional().describe('地点分类信息'),
    location: LocationSchema.optional().describe('提示所述位置坐标'),
    ad_info: PoiAdInfoSchema.optional().describe('行政区划信息'),
    _distance: z
        .number()
        .optional()
        .describe('该POI到逆地址解析传入坐标的直线距离'),
    _dir_desc: z
        .string()
        .optional()
        .describe('该POI在逆地址解析传入坐标的相对方位描述'),
});

// POI选项参数 Schema
export const PoiOptionsSchema = z.object({
    address_format: z
        .enum(['short', 'long'])
        .optional()
        .describe('地址格式，short=短地址，long=长地址(默认)'),
    radius: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .describe('POI搜索半径，单位米，取值范围1-5000'),
    policy: z
        .enum(['1', '2', '3', '4', '5'])
        .optional()
        .describe('控制返回场景：1=默认，2=到家，3=出行，4=社交，5=位置共享'),
    orderby: z
        .literal('_distance')
        .optional()
        .describe('按距离排序，固定值_distance'),
    added_fields: z
        .array(z.enum(['is_aoi', 'category_code']))
        .optional()
        .describe('返回POI附加字段'),
});

// 基础请求字段 Schema
export const BaseRequestFieldsSchema = z.object({
    location: z
        .string()
        .regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, '位置格式应为 "纬度,经度"')
        .describe('经纬度（GCJ02坐标系），格式：lat,lng'),
    radius: z
        .number()
        .int()
        .min(0)
        .max(5000)
        .optional()
        .describe('解析行政区划的吸附半径，单位米，默认0，最大5000'),
    get_poi: z
        .enum(['0', '1'])
        .optional()
        .describe('是否返回周边地点列表，0不返回(默认)，1返回'),
    output: z.enum(['json', 'jsonp']).optional().describe('返回格式，默认json'),
    callback: z.string().optional().describe('JSONP方式回调函数'),
});

// 逆地址解析请求参数 Schema（支持字符串和结构化POI选项）
export const ReverseGeocodeRequestSchema = BaseRequestFieldsSchema.extend({
    poi_options: z
        .union([z.string(), PoiOptionsSchema])
        .optional()
        .describe('周边POI控制参数，可以是字符串或结构化对象'),
});

// 逆地址解析响应结果 Schema
export const ReverseGeocodeResponseSchema = z.object({
    status: z.number().describe('状态码，0为正常，其它为异常'),
    message: z.string().describe('状态说明'),
    request_id: z.string().describe('本次请求的唯一标识'),
    result: z
        .object({
            address: z.string().describe('标准格式化地址'),
            formatted_addresses:
                FormattedAddressesSchema.optional().describe(
                    '结合知名地点形成的描述性地址',
                ),
            address_component: AddressComponentSchema.describe('地址部件'),
            ad_info: AdInfoSchema.describe('行政区划信息'),
            address_reference:
                AddressReferenceSchema.optional().describe('坐标相对位置参考'),
            ocean: OceanSchema.optional().describe('海洋信息'),
            poi_count: z.number().optional().describe('查询的周边poi的总数'),
            pois: z.array(PoiSchema).optional().describe('周边地点（POI）列表'),
        })
        .describe('逆地址解析结果'),
});

// 请求参数类型
export type ReverseGeocodeRequest = z.infer<typeof ReverseGeocodeRequestSchema>;

// POI选项类型
export type PoiOptions = z.infer<typeof PoiOptionsSchema>;

// 响应结果类型
export type ReverseGeocodeResponse = z.infer<
    typeof ReverseGeocodeResponseSchema
>;

/**
 * 关键词输入提示服务
 */

// 子地点信息 Schema
export const SubPoiSchema = z.object({
    parent_id: z.string().describe('主地点ID，对应data中的地点ID'),
    id: z.string().describe('地点唯一标识'),
    title: z.string().describe('地点名称'),
    address: z.string().describe('地址'),
    category: z.string().describe('POI（地点）分类'),
    location: LocationSchema.describe('坐标'),
    adcode: z.number().describe('行政区划代码'),
    city: z.string().describe('地点所在城市名称'),
});

// 关键词提示数据项 Schema
export const SuggestionDataSchema = z.object({
    id: z.string().optional().describe('POI唯一标识（type为4时不返回）'),
    title: z.string().describe('提示文字（地点名称）'),
    address: z.string().optional().describe('地址（type为4时不返回）'),
    category: z.string().optional().describe('POI（地点）分类（type为4时不返回）'),
    category_code: z.number().optional().describe('POI（地点）分类编码，设置added_fields=category_code时返回'),
    type: z.number().describe('POI类型，值说明：0:普通POI / 1:公交车站 / 2:地铁站 / 3:公交线路 / 4:行政区划'),
    _distance: z.number().optional().describe('传入location参数时，返回定位坐标到各POI的直线距离，单位：米'),
    location: LocationSchema.describe('提示所述位置坐标'),
    adcode: z.number().describe('行政区划代码'),
    province: z.string().optional().describe('省（type为4时不返回）'),
    city: z.string().optional().describe('市（type为4时不返回）'),
    district: z.string().optional().describe('区/县（type为4时不返回），当type为3（公交线路）时，district由city补全'),
    sub_pois: z.array(SubPoiSchema).optional().describe('子地点列表，仅在输入参数get_subpois=1时返回'),
});

// 关键词输入提示请求参数 Schema
export const SuggestionRequestSchema = z.object({
    keyword: z.string().max(96).describe('搜索关键词，最多支持96个字符（每个英文字符占1个，中文占3个）'),
    region: z.string().optional().describe('限制城市范围，如：广州、北京等'),
    region_fix: z.enum(['0', '1']).optional().describe('0：[默认] 不限制当前城市，会召回其他城市的poi；1：仅限制在当前城市'),
    location: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, '位置格式应为 "纬度,经度"').optional().describe('定位坐标，格式：lat,lng'),
    get_subpois: z.enum(['0', '1']).optional().describe('是否返回子地点，0 [默认]不返回；1 返回'),
    get_ad: z.enum(['0', '1']).optional().describe('是否返回区划结果，0 [默认]不返回；1 返回'),
    policy: z.enum(['0', '1', '10', '11']).optional().describe('检索策略：0-默认，1-收货地址，10-出行起点，11-出行终点'),
    filter: z.string().optional().describe('筛选条件，如：category=公交站'),
    added_fields: z.array(z.literal('category_code')).optional().describe('返回指定标准附加字段'),
    address_format: z.literal('short').optional().describe('返回"不带行政区划的"短地址'),
    page_index: z.string().regex(/^\d+$/, '页码必须是数字').refine((val) => {
        const num = parseInt(val, 10);
        return num >= 1;
    }, {
        message: '页码必须大于等于1',
    }).optional().describe('页码，从1开始'),
    page_size: z.string().regex(/^\d+$/, '每页条数必须是数字').refine((val) => {
        const num = parseInt(val, 10);
        return num >= 1 && num <= 20;
    }, {
        message: '每页条数必须在1-20之间',
    }).optional().describe('每页条数，取值范围1-20'),
    output: z.enum(['json', 'jsonp']).optional().describe('返回格式，默认JSON'),
    callback: z.string().optional().describe('JSONP方式回调函数'),
});

// 关键词输入提示响应结果 Schema
export const SuggestionResponseSchema = z.object({
    status: z.number().describe('状态码，0为正常，其它为异常'),
    message: z.string().describe('状态说明'),
    request_id: z.string().describe('本次请求的唯一标识'),
    count: z.number().describe('结果总数（注：本服务一个查询条件最多返回100条结果）'),
    data: z.array(SuggestionDataSchema).describe('提示词数组，每项为一个POI对象'),
});

// 新建用户地址schema
export const CreateUserAddressSchema = UserAddressesSchema.omit({ geom: true, id: true }).extend({
    /**
     * 经度
     */
    lng: z.number("lng 不能为空,并且lng必须是数字").describe('经度'),
    /**
     * 纬度
     */
    lat: z.number("lat 不能为空,并且lat必须是数字").describe('纬度'),
}).refine((data) => data.lat && data.lng, {
    message: '经纬度信息不完整',
    path: ['lat', 'lng'],
});

export const UpdateUserAddressSchema = CreateUserAddressSchema.partial().extend({
    id: z.string("id 不能为空").max(255, "id 不能超过255个字符").meta({
        description: '地址ID',
        title: '地址ID'
    }),
});

export type CreateUserAddress = z.infer<typeof CreateUserAddressSchema>;

export type UpdateUserAddress = z.infer<typeof UpdateUserAddressSchema>;

// 关键词输入提示请求参数类型
export type SuggestionRequest = z.infer<typeof SuggestionRequestSchema>;

// 关键词输入提示数据项类型
export type SuggestionData = z.infer<typeof SuggestionDataSchema>;

// 关键词输入提示响应结果类型
export type SuggestionResponse = z.infer<typeof SuggestionResponseSchema>;

// 子地点信息类型
export type SubPoi = z.infer<typeof SubPoiSchema>;
