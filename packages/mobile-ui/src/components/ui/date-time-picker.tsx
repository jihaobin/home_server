import { cn } from '@repo/mobile-ui/lib/utils';
import DateTimePickerPrimitive, {
    DateType,
    useDefaultClassNames,
} from 'react-native-ui-datepicker';
import * as React from 'react';
import { Platform, View, type ViewProps } from 'react-native';

// 定义选择器模式类型
type DateTimePickerMode = 'single' | 'range' | 'multiple';

// 单选模式的 Props
interface SingleModeProps {
    mode: 'single';
    date?: DateType;
    onChange?: (params: { date: DateType }) => void;
    timePicker?: boolean;
    use12Hours?: boolean;
}

// 范围选择模式的 Props
interface RangeModeProps {
    mode: 'range';
    startDate?: DateType;
    endDate?: DateType;
    onChange?: (params: { startDate: DateType; endDate: DateType }) => void;
    min?: number;
    max?: number;
}

// 多选模式的 Props
interface MultipleModeProps {
    mode: 'multiple';
    dates?: DateType[];
    onChange?: (params: { dates: DateType[] }) => void;
    max?: number;
    multiRangeMode?: boolean;
}

// 基础 Props
interface BaseDateTimePickerProps {
    className?: string;
    minDate?: DateType;
    maxDate?: DateType;
    enabledDates?: DateType[] | ((date: DateType) => boolean);
    disabledDates?: DateType[] | ((date: DateType) => boolean);
    firstDayOfWeek?: number;
    initialView?: 'day' | 'month' | 'year' | 'time';
    locale?: string;
    timeZone?: string;
    showOutsideDays?: boolean;
    navigationPosition?: 'around' | 'right' | 'left';
    containerHeight?: number;
    weekdaysHeight?: number;
    weekdaysFormat?: 'short' | 'full' | 'min';
    monthsFormat?: 'short' | 'full';
    monthCaptionFormat?: 'short' | 'full';
    hideHeader?: boolean;
    hideWeekdays?: boolean;
    disableMonthPicker?: boolean;
    disableYearPicker?: boolean;
}

// 组合所有 Props 类型
type DateTimePickerProps = BaseDateTimePickerProps &
    (SingleModeProps | RangeModeProps | MultipleModeProps);

// DateTimePicker 容器组件
function DateTimePickerContainer({ className, ...props }: ViewProps) {
    return (
        <View
            className={cn(
                'bg-background border-border rounded-lg border p-4 shadow-sm shadow-black/5',
                className
            )}
            {...props}
        />
    );
}

// 主 DateTimePicker 组件
function DateTimePicker({ className, ...props }: DateTimePickerProps) {
    const defaultClassNames = useDefaultClassNames();

    // 自定义 classNames，与项目的设计系统保持一致
    const customClassNames = React.useMemo(
        () => ({
            ...defaultClassNames,
            today: cn(defaultClassNames.today, 'border-primary'),
            selected: cn(defaultClassNames.selected, 'bg-primary border-primary'),
            selected_label: cn(defaultClassNames.selected_label, 'text-primary-foreground'),
            disabled: cn(defaultClassNames.disabled, 'opacity-50'),
            day: cn(
                defaultClassNames.day,
                Platform.select({
                    web: 'hover:bg-accent active:bg-accent',
                    native: 'active:bg-accent',
                })
            ),
        }),
        [defaultClassNames]
    );

    return (
        <DateTimePickerContainer className={className}>
            <DateTimePickerPrimitive
                {...(props as any)}
                classNames={customClassNames}
            />
        </DateTimePickerContainer>
    );
}

export { DateTimePicker, DateTimePickerContainer };
export type { DateTimePickerProps, DateType };
