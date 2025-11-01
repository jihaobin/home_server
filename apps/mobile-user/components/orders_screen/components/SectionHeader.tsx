import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { View } from "react-native";
import type { SectionHeaderProps } from "../types";
import { getIconComponent } from "../utils";

export function SectionHeader({
	section,
	isFirst,
	isSticky,
}: SectionHeaderProps) {
	const SectionIcon = getIconComponent(section.icon);

	return (
		<View
			className={cn(
				"bg-background border-border border-b",
				isSticky ? "mt-0 z-10 shadow-sm" : isFirst ? "mt-3" : "mt-6",
                "h-20 px-4"
			)}
		>
			<View className="flex-row items-center justify-between">
				<View className="flex-1 flex-row items-start pr-3">
					<View
						className={cn(
							"mt-1 h-1.5 w-6 flex-shrink-0 rounded-full",
							section.accentClassName,
						)}
					/>
					<View className="ml-3 flex-1">
						<View className="flex-row items-center">
							{SectionIcon ? (
								<Icon
									as={SectionIcon}
									size={16}
									className={cn(
										section.iconClassName ?? "text-muted-foreground",
									)}
								/>
							) : null}
							<Text
								className="ml-1 flex-1 text-base font-semibold text-foreground"
								numberOfLines={1}
							>
								{section.sectionTitle}
							</Text>
						</View>
						<Text
							className="mt-1 text-xs text-muted-foreground"
							numberOfLines={2}
						>
							{section.sectionDescription}
						</Text>
					</View>
				</View>
				<View
					className={cn(
						"ml-3 flex-shrink-0 rounded-full px-3 py-1",
						section.badgeClassName ?? "bg-muted text-muted-foreground",
					)}
				>
					<Text className="text-[10px] font-medium" numberOfLines={1}>
						{section.badgeText}
					</Text>
				</View>
			</View>
		</View>
	);
}
