export interface AuthSession {
    mintUrl: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    scope?: string;
}