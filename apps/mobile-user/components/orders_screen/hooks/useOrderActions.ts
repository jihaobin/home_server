import { useCallback, useState } from "react";
import { useOrderPayment } from "@/hooks/useOrderPayment";
import { useCancelOrder, useCompleteOrder } from "@repo/hooks/api/order";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { toast } from "sonner-native";
import { useRouter } from "expo-router";

type PayExistingOrderParams = {
	orderId: string;
	amount: number;
    paymentExpiresAt?: Date | string | null;
};

type CancelOrderParams = {
	orderId: string;
	reason?: string;
};

type CompleteOrderParams = {
	orderId: string;
};

const resolveErrorMessage = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "操作失败，请稍后重试";
};

export function useOrderActions() {
	const { payOrder, isPaying } = useOrderPayment();
	const cancelOrderMutation = useCancelOrder();
	const completeOrderMutation = useCompleteOrder();
	const { session } = useSession();
	const router = useRouter();
	const [isCancelling, setIsCancelling] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);

	const payExistingOrder = useCallback(
		async ({ orderId, amount, paymentExpiresAt }: PayExistingOrderParams) => {
			return await payOrder({
				orderId,
				displayAmount: amount,
				paymentExpiresAt,
			});
		},
		[payOrder],
	);

	const cancelOrder = useCallback(
		async ({ orderId, reason }: CancelOrderParams) => {
			if (!session?.user?.id) {
				toast.error("请先登录后再尝试操作");
				return false;
			}

			setIsCancelling(true);

			try {
				toast.dismiss();
				toast.loading("正在取消订单...");
				await cancelOrderMutation.mutateAsync({
					orderId,
					reason: reason ?? "用户主动取消订单",
					cancelledBy: session.user.id,
				});
				toast.dismiss();
				toast.success("订单已取消");
				return true;
			} catch (error) {
				toast.dismiss();
				toast.error(resolveErrorMessage(error));
				return false;
			} finally {
				setIsCancelling(false);
			}
		},
		[cancelOrderMutation, session?.user?.id],
	);

	const completeOrder = useCallback(
		async ({ orderId }: CompleteOrderParams) => {
			setIsCompleting(true);

			try {
				toast.dismiss();
				toast.loading("正在确认订单完成...");
				await completeOrderMutation.mutateAsync(orderId);
				toast.dismiss();
				toast.success("订单已确认完成");
				return true;
			} catch (error) {
				toast.dismiss();
				toast.error(resolveErrorMessage(error));
				return false;
			} finally {
				setIsCompleting(false);
			}
		},
		[completeOrderMutation],
	);

	const reorder = useCallback(
		() => {
			toast.dismiss();
			toast.info("已为您跳转到首页，方便再次下单");
			router.push("/(tabs)");
		},
		[router],
	);

	return {
		payExistingOrder,
		isPaying,
		cancelOrder,
		isCancelling,
		completeOrder,
		isCompleting,
		reorder,
	};
}
