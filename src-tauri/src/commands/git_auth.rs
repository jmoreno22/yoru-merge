//! Credential-failure detection shared by every network command.
//!
//! YoruMerge never prompts for credentials itself: `GIT_TERMINAL_PROMPT=0`
//! makes git fail fast instead of blocking on a terminal that does not exist.
//! The phrases below are the ones git emits in that situation; they are matched
//! only on a *failed* process so that a successful transfer whose output merely
//! mentions credentials is never reported as an auth error.

pub const AUTH_HELP_MESSAGE: &str = "Authentication required. Configure credentials with your system Git credential helper (for example Git Credential Manager or your OS keychain), then retry. YoruMerge never prompts in a terminal or stores tokens.";

/// Lowercased so the match is case-insensitive.
const AUTH_MARKERS: &[&str] = &[
    "authentication failed",
    "could not read username",
    "permission denied (publickey)",
    "terminal prompts disabled",
    "http 401",
    "http 403",
    "invalid credentials",
];

/// Whether `message` (a failed command's output) reports missing credentials.
pub fn is_auth_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    AUTH_MARKERS.iter().any(|marker| lower.contains(marker))
}

pub fn auth_error_message(detail: &str) -> String {
    let trimmed = detail.trim();
    if trimmed.is_empty() {
        return AUTH_HELP_MESSAGE.to_string();
    }
    if trimmed.starts_with(AUTH_HELP_MESSAGE) {
        return trimmed.to_string();
    }
    format!("{AUTH_HELP_MESSAGE}\n\nDetails: {trimmed}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_known_auth_failure_phrases() {
        assert!(is_auth_error(
            "fatal: Authentication failed for 'https://x'"
        ));
        assert!(is_auth_error("could not read Username for 'https://x'"));
        assert!(is_auth_error(
            "git@github.com: Permission denied (publickey)."
        ));
        assert!(is_auth_error(
            "fatal: could not read Username: terminal prompts disabled"
        ));
        assert!(is_auth_error("The requested URL returned error: HTTP 403"));
        assert!(is_auth_error("remote: Invalid credentials"));
    }

    #[test]
    fn ignores_incidental_credential_mentions() {
        assert!(!is_auth_error(
            "warning: credential helper 'manager' is configured"
        ));
        assert!(!is_auth_error("Storing credentials in the keychain"));
        assert!(!is_auth_error("error: failed to push some refs"));
    }

    #[test]
    fn help_message_is_not_duplicated() {
        let once = auth_error_message("Authentication failed");
        assert_eq!(auth_error_message(&once), once);
    }
}
