import type { ReactNode } from "react";
import {
	Modal,
	TouchableWithoutFeedback,
	useWindowDimensions,
	View,
} from "react-native";
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	SlideInDown,
	SlideOutDown,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";

export interface BottomSheetModalProps {
	visible: boolean;
	onClose: () => void;
	children: ReactNode;
	/** 初始高度占屏幕的比例,默认 0.66 (66%) */
	initialHeightRatio?: number;
	/** 最小高度占屏幕的比例,默认 0.3 (30%) */
	minHeightRatio?: number;
	/** 最大高度占屏幕的比例,默认 0.9 (90%) */
	maxHeightRatio?: number;
	/** 快速向下滑动关闭的阈值(像素),默认 150 */
	closeThreshold?: number;
	/** 快速向下滑动关闭的速度阈值,默认 500 */
	closeVelocityThreshold?: number;
	/** 是否显示拖动指示条,默认 true */
	showDragIndicator?: boolean;
}

/**
 * 底部弹出的 Sheet Modal 组件,支持拖动调整高度
 *
 * @example
 * ```tsx
 * <BottomSheetModal
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 * >
 *   <View>你的内容</View>
 * </BottomSheetModal>
 * ```
 */
export function BottomSheetModal({
	visible,
	onClose,
	children,
	initialHeightRatio = 0.66,
	minHeightRatio = 0.3,
	maxHeightRatio = 0.9,
	closeThreshold = 150,
	closeVelocityThreshold = 500,
	showDragIndicator = true,
}: BottomSheetModalProps) {
	const { height } = useWindowDimensions();

	const context = useSharedValue({ y: 0 });
	const modalHeight = useSharedValue(height * initialHeightRatio);

	// 拖动手势
	const panGesture = Gesture.Pan()
		.onStart(() => {
			context.value = { y: modalHeight.value };
		})
		.onUpdate((event) => {
			// 向下拖动减小高度,向上拖动增加高度
			const newHeight = context.value.y - event.translationY;

			// 限制最小和最大高度
			const minHeight = height * minHeightRatio;
			const maxHeight = height * maxHeightRatio;

			if (newHeight >= minHeight && newHeight <= maxHeight) {
				modalHeight.value = newHeight;
			}
		})
		.onEnd((event) => {
			const currentHeight = modalHeight.value;

			// 如果向下拖动超过阈值且速度够快,关闭modal
			if (
				event.translationY > closeThreshold &&
				event.velocityY > closeVelocityThreshold
			) {
				runOnJS(onClose)();
				return;
			}

			// 否则回弹到最近的预设高度
			let targetHeight: number;
			const largeThreshold = height * 0.75;
			const mediumThreshold = height * 0.5;

			if (currentHeight > largeThreshold) {
				targetHeight = height * maxHeightRatio;
			} else if (currentHeight > mediumThreshold) {
				targetHeight = height * initialHeightRatio;
			} else {
				targetHeight = height * minHeightRatio;
			}

			modalHeight.value = withSpring(targetHeight, {
				damping: 20,
				stiffness: 300,
			});
		});

	// 动画样式
	const animatedModalStyle = useAnimatedStyle(() => {
		return {
			height: modalHeight.value,
		};
	});

	// 当 modal 关闭或打开时重置高度
	const handleModalOpen = () => {
		modalHeight.value = height * initialHeightRatio;
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
			onShow={handleModalOpen}
			statusBarTranslucent={false}
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				{/* 半透明背景遮罩 */}
				<TouchableWithoutFeedback onPress={onClose}>
					<View
						style={{
							flex: 1,
							justifyContent: "flex-end",
						}}
					>
						<TouchableWithoutFeedback>
							<Animated.View
								entering={SlideInDown.duration(300)}
								exiting={SlideOutDown.duration(250)}
								style={[
									animatedModalStyle,
									{
										shadowColor: "#000",
										shadowOffset: {
											width: 0,
											height: -4,
										},
										shadowOpacity: 0.25,
										shadowRadius: 12,
										elevation: 24,
									},
								]}
								className="rounded-t-3xl bg-background"
							>
								<View className="flex-1">
									{/* 顶部拖动指示条 */}
									{showDragIndicator && (
										<GestureDetector gesture={panGesture}>
											<Animated.View className="items-center py-4 active:bg-muted/10">
												<View className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
											</Animated.View>
										</GestureDetector>
									)}

									{/* 内容区域 */}
									{children}
								</View>
							</Animated.View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</GestureHandlerRootView>
		</Modal>
	);
}
