import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import {
    NOTIFICATION_SOCKET_CLIENT_EVENT,
    NOTIFICATION_SOCKET_SERVER_EVENT,
    NotificationSocketClientEventType,
    NotificationSocketEventType,
    type NotificationHeartbeatDto,
    type NotificationSocketServerMessage,
} from "@repo/types"

import { adminApiBaseUrl } from "@/lib/api-client"

type NotificationMessage = Extract<
    NotificationSocketServerMessage,
    { type: NotificationSocketEventType.Notification }
>

type NotificationErrorMessage = Extract<
    NotificationSocketServerMessage,
    { type: NotificationSocketEventType.Error }
>

type DeliveryAckStatus = "pending" | "success" | "failed"

type ConnectionStatus =
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"

type NotificationSocketOptions = {
    autoConnect?: boolean
    heartbeatIntervalMs?: number
    metadata?: {
        deviceId?: string
        platform?: NotificationHeartbeatDto["platform"]
        appVersion?: string
    }
    onMessage?: (message: NotificationSocketServerMessage) => void
    onNotification?: (message: NotificationMessage) => void
    onError?: (message: NotificationErrorMessage) => void
}

type UseNotificationSocketResult = {
    status: ConnectionStatus
    lastError: string | null
    lastAckError: string | null
    deliveryAckStates: Record<string, DeliveryAckStatus>
    sendHeartbeat: () => void
}

const DEFAULT_HEARTBEAT_INTERVAL = 15_000

export function useNotificationSocket(
    options: NotificationSocketOptions = {},
): UseNotificationSocketResult {
    const {
        autoConnect = true,
        heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL,
        metadata,
        onMessage,
        onNotification,
        onError,
    } = options
    const [status, setStatus] = useState<ConnectionStatus>("idle")
    const [lastError, setLastError] = useState<string | null>(null)
    const [lastAckError, setLastAckError] = useState<string | null>(null)
    const [deliveryAckStates, setDeliveryAckStates] = useState<
        Record<string, DeliveryAckStatus>
    >({})
    const socketRef = useRef<Socket | null>(null)
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const resolvedMetadata = useMemo(
        () => ({
            platform: metadata?.platform ?? "web",
            deviceId: metadata?.deviceId,
            appVersion: metadata?.appVersion,
        }),
        [metadata?.platform, metadata?.deviceId, metadata?.appVersion],
    )

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current)
            heartbeatTimerRef.current = null
        }
    }, [])

    const sendHeartbeat = useCallback(() => {
        if (!socketRef.current) {
            return
        }
        socketRef.current.emit(NOTIFICATION_SOCKET_CLIENT_EVENT, {
            type: NotificationSocketClientEventType.Heartbeat,
            timestamp: new Date().toISOString(),
            platform: resolvedMetadata.platform,
            deviceId: resolvedMetadata.deviceId,
            appVersion: resolvedMetadata.appVersion,
        })
    }, [resolvedMetadata])

    const startHeartbeat = useCallback(() => {
        stopHeartbeat()
        heartbeatTimerRef.current = setInterval(() => {
            sendHeartbeat()
        }, heartbeatIntervalMs)
    }, [heartbeatIntervalMs, sendHeartbeat, stopHeartbeat])

    const handleStrictAck = useCallback(
        (message: NotificationMessage) => {
            const { deliveryId, deliveryMode } = message
            if (!deliveryId || deliveryMode !== "strict") {
                return
            }
            const endpoint = resolveNotificationsEndpoint()
            if (!endpoint) {
                setDeliveryAckStates((prev) => ({
                    ...prev,
                    [deliveryId]: "failed",
                }))
                setLastAckError("缺少通知服务地址，无法发送通知 ACK")
                return
            }
            setDeliveryAckStates((prev) => {
                const current = prev[deliveryId]
                if (current === "pending" || current === "success") {
                    return prev
                }
                return {
                    ...prev,
                    [deliveryId]: "pending",
                }
            })
            void fetch(`${endpoint}/ack`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ deliveryId }),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `通知 ACK 失败，状态码 ${response.status}`,
                        )
                    }
                    setDeliveryAckStates((prev) => ({
                        ...prev,
                        [deliveryId]: "success",
                    }))
                    setLastAckError(null)
                })
                .catch((error) => {
                    const messageText =
                        error instanceof Error
                            ? error.message
                            : "通知 ACK 请求失败"
                    setDeliveryAckStates((prev) => ({
                        ...prev,
                        [deliveryId]: "failed",
                    }))
                    setLastAckError(messageText)
                })
        },
        [],
    )

    const handleServerEvent = useCallback(
        (message: NotificationSocketServerMessage) => {
            onMessage?.(message)
            switch (message.type) {
                case NotificationSocketEventType.Notification:
                    onNotification?.(message)
                    handleStrictAck(message)
                    break
                case NotificationSocketEventType.Error:
                    onError?.(message)
                    setStatus("error")
                    setLastError(message.message)
                    break
                default:
                    break
            }
        },
        [handleStrictAck, onError, onMessage, onNotification],
    )

    useEffect(() => {
        if (!autoConnect || typeof window === "undefined") {
            return
        }
        const endpoint = resolveNotificationsEndpoint()
        if (!endpoint) {
            return
        }

        setStatus("connecting")
        const socket = io(endpoint, {
            withCredentials: true,
            transports: ["websocket"],
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30_000,
            timeout: 10_000,
            query: {
                platform: resolvedMetadata.platform,
                deviceId: resolvedMetadata.deviceId,
                appVersion: resolvedMetadata.appVersion,
            },
        })

        socketRef.current = socket

        const handleConnect = () => {
            setStatus("connected")
            setLastError(null)
            sendHeartbeat()
            startHeartbeat()
        }

        const handleDisconnect = () => {
            setStatus("disconnected")
            stopHeartbeat()
        }

        const handleConnectError = (error: Error) => {
            setStatus("error")
            setLastError(error.message)
        }

        socket.on("connect", handleConnect)
        socket.on("disconnect", handleDisconnect)
        socket.on("connect_error", handleConnectError)
        socket.on(NOTIFICATION_SOCKET_SERVER_EVENT, handleServerEvent)

        return () => {
            stopHeartbeat()
            socket.off("connect", handleConnect)
            socket.off("disconnect", handleDisconnect)
            socket.off("connect_error", handleConnectError)
            socket.off(
                NOTIFICATION_SOCKET_SERVER_EVENT,
                handleServerEvent,
            )
            socket.disconnect()
            socketRef.current = null
        }
    }, [
        autoConnect,
        handleServerEvent,
        resolvedMetadata,
        sendHeartbeat,
        startHeartbeat,
        stopHeartbeat,
    ])

    useEffect(() => {
        if (typeof document === "undefined") {
            return
        }
        const handleVisibility = () => {
            if (document.hidden) {
                stopHeartbeat()
                return
            }
            sendHeartbeat()
            startHeartbeat()
        }
        document.addEventListener("visibilitychange", handleVisibility)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility)
        }
    }, [sendHeartbeat, startHeartbeat, stopHeartbeat])

    return {
        status,
        lastError,
        lastAckError,
        deliveryAckStates,
        sendHeartbeat,
    }
}

function resolveNotificationsEndpoint(): string | null {
    if (typeof window === "undefined") {
        return null
    }
    const base =
        adminApiBaseUrl && adminApiBaseUrl.length > 0
            ? adminApiBaseUrl
            : `${window.location.origin}/api`
    const normalized = base.endsWith("/")
        ? base.slice(0, -1)
        : base
    return `${normalized}/notifications`
}
