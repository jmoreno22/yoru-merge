use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String, // ISO 8601
    pub parent_shas: Vec<String>,
    pub refs: Vec<RefInfo>,
    pub on_current_branch: bool, // true when reachable from current HEAD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefInfo {
    pub name: String,
    pub ref_type: RefType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefType {
    Branch,
    Tag,
    Remote,
    Head,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commit_info_serializes_to_json() {
        let c = CommitInfo {
            sha: "abc123".to_string(),
            short_sha: "abc".to_string(),
            message: "test".to_string(),
            author_name: "jhoan".to_string(),
            author_email: "j@example.com".to_string(),
            date: "2026-01-01T00:00:00Z".to_string(),
            parent_shas: vec![],
            refs: vec![RefInfo {
                name: "main".to_string(),
                ref_type: RefType::Branch,
            }],
            on_current_branch: true,
        };
        let json = serde_json::to_string(&c).unwrap();
        assert!(json.contains("\"sha\":\"abc123\""));
        assert!(json.contains("\"ref_type\":\"branch\"")); // snake_case enum
    }

    #[test]
    fn commit_info_roundtrip() {
        let c = CommitInfo {
            sha: "x".to_string(),
            short_sha: "x".to_string(),
            message: "m".to_string(),
            author_name: "a".to_string(),
            author_email: "e".to_string(),
            date: "2026".to_string(),
            parent_shas: vec!["p".to_string()],
            refs: vec![],
            on_current_branch: true,
        };
        let json = serde_json::to_string(&c).unwrap();
        let parsed: CommitInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.sha, "x");
    }

    #[test]
    fn ref_type_serializes_snake_case() {
        let r = RefType::Remote;
        assert_eq!(serde_json::to_string(&r).unwrap(), "\"remote\"");
    }
}
