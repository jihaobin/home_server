import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { Button } from '@repo/mobile-ui/components/ui/button';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { RadioGroup } from '@repo/mobile-ui/components/ui/radio-group';
import { ArrowLeft } from '@repo/mobile-ui/lib/icons/ArrowLeft';
import { ChevronRight } from '@repo/mobile-ui/lib/icons/ChevronRight';
import { z } from 'zod';
import { CreateUserAddressSchema } from "@repo/types"
import { SafeAreaView } from 'react-native-safe-area-context';

// 定义表单schema，确保isDefault为必需的布尔值
const FormSchema = CreateUserAddressSchema;

type FormData = z.infer<typeof FormSchema>;

// 性别选择组件 - 使用RadioGroup但保持原有按钮样式
function GenderSelection({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} className="flex-row gap-2">
      <GenderButton value="male" currentValue={value} onPress={() => onValueChange('male')} />
      <GenderButton value="female" currentValue={value} onPress={() => onValueChange('female')} />
    </RadioGroup>
  );
}

// 性别按钮组件 - 保持原有样式
function GenderButton({
  value,
  currentValue,
  onPress,
}: {
  value: string;
  currentValue: string;
  onPress: () => void;
}) {
  const label = value === 'male' ? '先生' : '女士';
  const isSelected = value === currentValue;

  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full ${
        isSelected ? 'bg-primary' : 'border border-border bg-background'
      }`}
    >
      <Text className={`text-sm ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EditAddressScreen() {
  const params = useLocalSearchParams();
  const addressId = params.addressId as string;
  const isEdit = !!addressId;
  const [gender, setGender] = useState('male');

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      recipientName: '',
      recipientPhone: '',
      detailedAddress: '',
      homeNumber: '',
      province: '',
      district: '',
      county: '',
      lng: 0,
      lat: 0,
      userId: "1123",
      isDefault: false,
    }
  });

  // 编辑模式下的地址数据预填充
  useEffect(() => {
    if (isEdit && addressId) {
      // 模拟从API获取地址数据
      // TODO: 替换为实际的API调用
      const mockAddressData = {
        recipientName: 'u6154',
        recipientPhone: '19090416306',
        detailedAddress: '黄冈武穴市兴雨科技大楼hh',
        homeNumber: '101',
        province: '湖北省',
        district: '黄冈市',
        county: '武穴市',
        lng: 115.5656,
        lat: 29.8496,
      };

      // 预填充表单数据
      Object.entries(mockAddressData).forEach(([key, value]) => {
        setValue(key as keyof FormData, value);
      });
    }
  }, [isEdit, addressId, setValue]);

  const handleGoBack = () => {
    router.back();
  };

  const handleSelectServiceAddress = () => {
    // TODO: 导航到地址选择页面
    console.log('选择服务地址');
    router.push('./select-address');
  };

  const onSubmit = async (data: FormData) => {
    try {
      console.log('提交表单数据:', data);
      // TODO: 调用API保存地址
      // if (isEdit) {
      //   await updateAddress({...data, id: addressId});
      // } else {
      //   await createAddress(data);
      // }
      router.back();
    } catch (error) {
      console.error('保存地址失败:', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* 头部导航 */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          onPress={handleGoBack}
          className="mr-4"
        >
          <ArrowLeft size={24} className="text-foreground" />
        </Pressable>
        <Text className="text-lg font-medium text-foreground">
          添加地址
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <View className="py-6 space-y-6">
          {/* 服务地址 */}
          <Pressable onPress={handleSelectServiceAddress}>
            <View className="flex-row items-center justify-between py-4 border-b border-border">
              <View className="flex-row items-center flex-1">
                <Text className="text-base text-foreground mr-4">服务地址</Text>
                <Text className="text-base text-foreground flex-1">
                  黄冈武穴市兴雨科技大楼
                </Text>
              </View>
                <ChevronRight size={20} className="text-muted-foreground" />
            </View>
          </Pressable>

          {/* 门牌号 */}
          <View>
            <View className="flex-row items-center py-4 border-b border-border">
              <Text className="text-base text-foreground mr-4 w-16">门牌号</Text>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="homeNumber"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder="详细地址，例如：A座102室"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      className="border-0 bg-transparent px-0 text-muted-foreground"
                    />
                  )}
                />
              </View>
            </View>
            {errors.homeNumber && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.homeNumber.message}
              </Text>
            )}
          </View>

          {/* 联系人 */}
          <View>
            <View className="flex-row items-center py-4 border-b border-border">
              <Text className="text-base text-foreground mr-4 w-16">联系人</Text>
              <View className="flex-1 flex-row items-center">
                <Controller
                  control={control}
                  name="recipientName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder="u61546306"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      className="border-0 bg-transparent px-0 flex-1 mr-4"
                    />
                  )}
                />
                <GenderSelection value={gender} onValueChange={setGender} />
              </View>
            </View>
            {errors.recipientName && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.recipientName.message}
              </Text>
            )}
          </View>

          {/* 联系电话 */}
          <View>
            <View className="flex-row items-center py-4 border-b border-border">
              <Text className="text-base text-foreground mr-4">联系电话</Text>
              <View className="flex-1 flex-row items-center">
                <Controller
                  control={control}
                  name="recipientPhone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder="19090416306"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="phone-pad"
                      className="border-0 bg-transparent px-0 flex-1 mr-4"
                    />
                  )}
                />
                <Pressable className="px-3 py-1 border border-border rounded">
                  <Text className="text-sm text-foreground">通讯录</Text>
                </Pressable>
              </View>
            </View>
            {errors.recipientPhone && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.recipientPhone.message}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 底部保存按钮 */}
      <View className="p-4 bg-background">
        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className=" h-12 rounded-lg"
        >
          <Text className="text-white text-base font-medium">
            保存
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
