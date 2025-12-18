import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, Platform, type AppStateStatus } from "react-native"
import Constants from "expo-constants"
import { io, type Socket } from "socket.io-client"
import {
    NOTIFICATION_SOCKET_CLIENT_EVENT,
    NOTIFICATION_SOCKET_SERVER_EVENT,
    NotificationSocketClientEventType,
    NotificationSocketEventType,
    type NotificationHeartbeatDto,
    type NotificationSocketServerMessage,
} from "@repo/types"

import { authClient } from "../lib/auth"
import { API_BASE_URL, NOTIFICATION_NAMESPACE } from "../lib/config"

export type NotificationSocketNotification = Extract<
    NotificationSocketServerMessage,
    { type: NotificationSocketEventType.Notification }
>

export type NotificationSocketErrorMessage = Extract<
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
    enabled?: boolean
    metadata?: {
        deviceId?: string
        platform?: NotificationHeartbeatDto["platform"]
        appVersion?: string
        registrationId?: string
    }
    onMessage?: (message: NotificationSocketServerMessage) => void
    onNotification?: (message: NotificationSocketNotification) => void
    onError?: (message: NotificationSocketErrorMessage) => void
}

type UseNotificationSocketResult = {
    status: ConnectionStatus
    lastError: string | null
    lastAckError: string | null
    deliveryAckStates: Record<string, DeliveryAckStatus>
}

const DEFAULT_HEARTBEAT_INTERVAL = 15_000

export function useNotificationSocket(
    options: NotificationSocketOptions = {},
): UseNotificationSocketResult {
    const {
        enabled = true,
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
    const appStateRef = useRef<AppStateStatus>(AppState.currentState)

    const resolvedMetadata = useMemo(
        () => ({
            platform:
                metadata?.platform ??
                (Platform.OS === "ios"
                    ? "ios"
                    : Platform.OS === "android"
                        ? "android"
                        : "unknown"),
            deviceId:
                metadata?.deviceId ??
                (metadata?.registrationId
                    ? `tpns:${metadata.registrationId}`
                    : undefined),
            appVersion:
                metadata?.appVersion ?? Constants.expoConfig?.version ?? undefined,
            registrationId: metadata?.registrationId,
        }),
        [
            metadata?.platform,
            metadata?.deviceId,
            metadata?.appVersion,
            metadata?.registrationId,
        ],
    )

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current)
            heartbeatTimerRef.current = null
        }
    }, [])

    const sendHeartbeat = useCallback(() => {
        const socket = socketRef.current
        if (!socket || socket.disconnected) {
            return
        }
        socket.emit(NOTIFICATION_SOCKET_CLIENT_EVENT, {
            type: NotificationSocketClientEventType.Heartbeat,
            timestamp: new Date().toISOString(),
            platform: resolvedMetadata.platform,
            deviceId: resolvedMetadata.deviceId,
            appVersion: resolvedMetadata.appVersion,
            registrationId: resolvedMetadata.registrationId,
        })
    }, [resolvedMetadata])

    const startHeartbeat = useCallback(() => {
        stopHeartbeat()
        heartbeatTimerRef.current = setInterval(() => {
            sendHeartbeat()
        }, DEFAULT_HEARTBEAT_INTERVAL)
    }, [sendHeartbeat, stopHeartbeat])

    const sendOffline = useCallback(
        (targetSocket?: Socket | null) => {
            const socket = targetSocket ?? socketRef.current
            if (!socket || socket.disconnected) {
                return
            }
            socket.emit(NOTIFICATION_SOCKET_CLIENT_EVENT, {
                type: NotificationSocketClientEventType.Offline,
                timestamp: new Date().toISOString(),
                platform: resolvedMetadata.platform,
                deviceId: resolvedMetadata.deviceId,
                appVersion: resolvedMetadata.appVersion,
                registrationId: resolvedMetadata.registrationId,
            })
        },
        [resolvedMetadata],
    )

    const handleStrictAck = useCallback(
        (message: NotificationSocketNotification) => {
            const { deliveryId, deliveryMode } = message
            if (!deliveryId || deliveryMode !== "strict") {
                return
            }
            const ackUrl = buildNotificationAckUrl()
            if (!ackUrl) {
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
            const cookieHeader = authClient
                .getCookie?.()
                ?.replace(/^\s*;\s*/, "")
                .trim()
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            }
            if (cookieHeader) {
                headers.Cookie = cookieHeader
            }
            void fetch(ackUrl, {
                method: "POST",
                headers,
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
                    const nextMessage =
                        error instanceof Error
                            ? error.message
                            : "通知 ACK 请求失败"
                    setDeliveryAckStates((prev) => ({
                        ...prev,
                        [deliveryId]: "failed",
                    }))
                    setLastAckError(nextMessage)
                })
        },
        [],
    )

    useEffect(() => {
        if (!enabled) {
            setStatus("idle")
            return
        }

        const endpoint = resolveEndpoint()
        if (!endpoint) {
            setLastError("缺少通知服务地址")
            setStatus("error")
            return
        }

        const cookieHeader =
            authClient
                .getCookie?.()
                ?.replace(/^\s*;\s*/, "")
                .trim() ?? ""

        if (!cookieHeader) {
            setLastError("未找到登录态，无法建立通知连接")
            setStatus("error")
            return
        }

        setStatus("connecting")
        const socket = io(endpoint, {
            autoConnect: true,
            transports: ["websocket"],
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30_000,
            timeout: 10_000,
            withCredentials: true,
            query: {
                platform: resolvedMetadata.platform,
                deviceId: resolvedMetadata.deviceId,
                appVersion: resolvedMetadata.appVersion,
                registrationId: resolvedMetadata.registrationId,
            },
            extraHeaders: {
                Cookie: cookieHeader,
            },
            transportOptions: {
                polling: {
                    extraHeaders: {
                        Cookie: cookieHeader,
                    },
                },
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

        const handleServerEvent = (message: NotificationSocketServerMessage) => {
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
        }

        socket.on("connect", handleConnect)
        socket.on("disconnect", handleDisconnect)
        socket.on("connect_error", handleConnectError)
        socket.on(NOTIFICATION_SOCKET_SERVER_EVENT, handleServerEvent)

        return () => {
            stopHeartbeat()
            sendOffline(socket)
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
        enabled,
        handleStrictAck,
        onError,
        onMessage,
        onNotification,
        resolvedMetadata,
        sendHeartbeat,
        sendOffline,
        startHeartbeat,
        stopHeartbeat,
    ])

    useEffect(() => {
        if (!enabled) {
            return
        }
        const subscription = AppState.addEventListener("change", (nextState) => {
            appStateRef.current = nextState
            if (nextState === "active") {
                if (socketRef.current?.disconnected) {
                    socketRef.current.connect()
                }
                sendHeartbeat()
                startHeartbeat()
            } else {
                sendOffline()
                stopHeartbeat()
                socketRef.current?.disconnect()
            }
        })

        return () => subscription.remove()
    }, [enabled, sendHeartbeat, sendOffline, startHeartbeat, stopHeartbeat])

    return {
        status,
        lastError,
        lastAckError,
        deliveryAckStates,
    }
}

function resolveEndpoint(): string | null {
    if (!API_BASE_URL) {
        return null
    }
    const normalizedBase = API_BASE_URL.endsWith("/")
        ? API_BASE_URL.slice(0, -1)
        : API_BASE_URL
    const namespace = NOTIFICATION_NAMESPACE.startsWith("/")
        ? NOTIFICATION_NAMESPACE
        : `/${NOTIFICATION_NAMESPACE}`
    return `${normalizedBase}${namespace}`
}

function buildNotificationAckUrl(): string | null {
    if (!API_BASE_URL) {
        return null
    }
    try {
        return new URL("/notifications/ack", API_BASE_URL).toString()
    } catch {
        return null
    }
}
