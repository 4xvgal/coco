import type { CoreEvents, EventBus } from "@core/events";
import { AuthSessionError, AuthSessionExpiredError } from "@core/models";
import type { AuthSessionRepository } from "@core/repositories";
import { normalizeMintUrl } from "@core/utils";
import type { Logger } from "@core/logging";
import type { AuthSession } from '../models/AuthSession';



export class AuthSessionService {
    private readonly repo: AuthSessionRepository;
    private readonly eventBus?: EventBus<CoreEvents>;
    private readonly logger?: Logger;

    constructor(
        repo: AuthSessionRepository,
        logger?: Logger,
        eventBus?: EventBus<CoreEvents>
    ) {
        this.repo = repo;
        this.eventBus = eventBus;
        this.logger = logger;
    }

    /** Get Valid Session, Error if it's expired*/
    async getValidSession(mintUrl: string): Promise<AuthSession> {
        mintUrl = normalizeMintUrl(mintUrl);
        const session = await this.repo.getSession(mintUrl);
        if(!session){
            throw new AuthSessionError(mintUrl, 'No auth session found');
        }
        const now = Math.floor(Date.now() / 1000);
        if(session.expiresAt <= now){
            await this.eventBus?.emit('auth-session:expired', {mintUrl});
            throw new AuthSessionExpiredError(mintUrl);
        }
        return session;
    }


/** Get OIDC token and save session */
    async saveSession(
      mintUrl: string,
      tokens: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string },
    ): Promise<AuthSession> {
      mintUrl = normalizeMintUrl(mintUrl);
      const now = Math.floor(Date.now() / 1000);
      const session: AuthSession = {
        mintUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: now + (tokens.expires_in ?? 3600),
        scope: tokens.scope,
      };
      await this.repo.saveSession(session);
      await this.eventBus?.emit('auth-session:updated', { mintUrl });
      this.logger?.info('Auth session saved', { mintUrl, expiresAt: session.expiresAt });
      return session;
    }

    /** logout */
    async deleteSession(mintUrl: string): Promise<void> {
      mintUrl = normalizeMintUrl(mintUrl);
      await this.repo.deleteSession(mintUrl);
      await this.eventBus?.emit('auth-session:deleted', { mintUrl });
      this.logger?.info('Auth session deleted', { mintUrl });
    }

    /**has session */
    async hasSession(mintUrl: string): Promise<boolean> {
      mintUrl = normalizeMintUrl(mintUrl);
      const session = await this.repo.getSession(mintUrl);
      return session !== null;
    }
  }
