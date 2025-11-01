import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Pressable } from "react-native";
import type { TabItemProps } from "../types";

export function TabItem({ item, isActive, onPress }: TabItemProps) {
	return (
		<Pressable
			onPress={() => onPress(item)}
			className={cn(
				"mr-2 rounded-full border px-4 py-2",
				isActive
					? "border-primary bg-primary/10 dark:bg-primary/20"
					: "border-border bg-muted/60 dark:bg-muted/40",
			)}
		>
			<Text
				className={cn(
					"text-sm font-medium",
					isActive ? "text-primary" : "text-muted-foreground",
				)}
				numberOfLines={1}
			>
				{item.label}
			</Text>
			{item.subLabel ? (
				<Text
					className={cn(
						"mt-0.5 text-[10px]",
						!isActive
							? "text-primary/80 dark:text-primary/70"
							: "text-muted-foreground/80 dark:text-muted-foreground/70",
					)}
					numberOfLines={1}
				>
					{item.subLabel}
				</Text>
			) : null}
		</Pressable>
	);
}
