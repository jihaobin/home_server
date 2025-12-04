import { useEffect, useMemo, useState } from "react";

const toTimestamp = (value?: Date | string | null) => {
	if (!value) {
		return null;
	}
	const date = typeof value === "string" ? new Date(value) : value;
	const time = date.getTime();
	return Number.isNaN(time) ? null : time;
};

export function usePaymentCountdown(expiresAt?: Date | string | null) {
	const targetTimestamp = useMemo(() => toTimestamp(expiresAt), [expiresAt instanceof Date ? expiresAt.getTime() : expiresAt]);
	const [remainingMs, setRemainingMs] = useState(() =>
		targetTimestamp ? targetTimestamp - Date.now() : 0,
	);

	useEffect(() => {
		if (!targetTimestamp) {
			setRemainingMs(0);
			return;
		}

		setRemainingMs(targetTimestamp - Date.now());

		const timer = setInterval(() => {
			setRemainingMs(targetTimestamp - Date.now());
		}, 1000);

		return () => clearInterval(timer);
	}, [targetTimestamp]);

	const isExpired = Boolean(targetTimestamp && remainingMs <= 0);

	const formatted = useMemo(() => {
		if (!targetTimestamp) {
			return "--";
		}

		if (remainingMs <= 0) {
			return "已超时";
		}

		const totalSeconds = Math.ceil(remainingMs / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		if (minutes > 0) {
			return `${minutes}分${seconds.toString().padStart(2, "0")}秒`;
		}
		return `${seconds}秒`;
	}, [remainingMs, targetTimestamp]);

	return {
		isExpired,
		remainingMs,
		formatted,
		targetTimestamp,
	};
}
