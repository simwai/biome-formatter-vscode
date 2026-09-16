/**
 * STARTUP Gate Plugin for opencode (simple event-based API)
 *
 * Observes session lifecycle and tracks STARTUP phase verification.
 * The actual enforcement is done by the agent following instructions in opencode.jsonc.
 * This plugin provides visibility via toasts and logs.
 */

interface StartupState {
  verified: boolean
  fingerprint?: {
    lineCount: number
    first100: string
    last100: string
    sha256First1kb: string
    verifiedAt: string
  }
}

const startupStates = new Map<string, StartupState>()

const _FINGERPRINT_REGEX =
  /00-system\.md fingerprint:\s*(\d+)\s+lines,\s*first_100_chars="([^"]{0,100})",\s*last_100_chars="([^"]{0,100})",\s*sha256_first_1kb="([^"]+)"/

export default async ({
  _client,
  _$,
  _project,
  _directory,
  _worktree,
}: {
  _client: unknown
  _$: unknown
  _project: unknown
  _directory: string
  _worktree: string
}) => {
  return {
    event: async ({ event }: { event: unknown }) => {
      // Session created - initialize tracking
      if (event.type === 'session.created') {
        const sessionID = event.properties.sessionID
        startupStates.set(sessionID, { verified: false })

        // Show reminder toast
        await $`opencode tui toast show --title "STARTUP Required" --message "Emit 00-system.md fingerprint before any response" --variant info`
        return
      }

      // Session updated - check for fingerprint in metadata or message parts
      if (event.type === 'session.updated') {
        const sessionID = event.properties.sessionID
        const info = event.properties.info
        const state = startupStates.get(sessionID) || { verified: false }

        // Check session metadata for startup verification
        if (
          info.metadata?.startup_verified === true &&
          info.metadata?.startup_fingerprint
        ) {
          state.verified = true
          state.fingerprint = info.metadata.startup_fingerprint
          startupStates.set(sessionID, state)

          await $`opencode tui toast show --title "STARTUP Verified" --message "Fingerprint accepted, proceeding normally" --variant success`
          return
        }

        // Check recent assistant messages for fingerprint emission
        // (This requires fetching session messages - may need client call)
        if (!state.verified) {
        }
        return
      }

      // Session deleted - cleanup
      if (event.type === 'session.deleted') {
        const sessionID = event.properties.sessionID
        startupStates.delete(sessionID)
        return
      }
    },
  }
}
