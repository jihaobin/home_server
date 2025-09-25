import { apiClient } from "@/lib/http-client";

export async function genericAuthSign(){
    const signString = await apiClient.get<string>("/pay/getAuthSign")
    return signString;
}