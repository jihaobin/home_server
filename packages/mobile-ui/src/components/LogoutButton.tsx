import { Button } from "@repo/mobile-ui/components/ui/button";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { router } from "expo-router";
import { Alert } from "react-native";
import { authClient } from "@repo/lib/auth-client";
import { useSession } from "./SessionProvider";

interface LogoutButtonProps {
	variant?:
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link";
	size?: "default" | "sm" | "lg" | "icon";
	className?: string;
}

export function LogoutButton({
	variant = "outline",
	size = "default",
	className,
}: LogoutButtonProps) {
	const { refetch } = useSession();

	const handleLogout = async () => {
		Alert.alert("确认退出", "您确定要退出登录吗？", [
			{
				text: "取消",
				style: "cancel",
			},
			{
				text: "退出",
				style: "destructive",
				onPress: async () => {
                    console.log("Logging out...");
					try {
						const { error } = await authClient.signOut();
                        console.log(error);
						if (error) {
							Alert.alert("退出登录失败", error.message || "登录时发生错误");
						} else {
							// 登录成功，跳转到主页
							refetch();
							router.replace("/(tabs)");
						}
					} catch (error) {
						Alert.alert("错误", "退出登录失败，请重试");
					}
				},
			},
		]);
	};

	return (
		<Button
			variant={variant}
			size={size}
			className={className}
			onPress={handleLogout}
		>
			<Text>退出登录</Text>
		</Button>
	);
}
