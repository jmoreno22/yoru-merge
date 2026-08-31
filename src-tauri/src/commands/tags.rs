//! Tag lifecycle. A tag with a message becomes an annotated tag object;
//! without one it stays a lightweight ref.

use super::git::{
    validate_message, validate_ref, validate_remote_name, validate_repo_path, validate_revision,
    GitCmd,
};

fn create_tag_inner(
    path: &str,
    name: &str,
    target: Option<&str>,
    message: Option<&str>,
) -> Result<(), String> {
    let mut args: Vec<&str> = vec!["tag"];
    if let Some(message) = message {
        args.extend(["-a", "-m", message]);
    }
    args.push(name);
    if let Some(target) = target {
        args.push(target);
    }
    GitCmd::in_repo(path).args(&args).run().map(|_| ())
}

fn delete_tag_inner(path: &str, name: &str) -> Result<(), String> {
    GitCmd::in_repo(path)
        .args(["tag", "-d", name])
        .run()
        .map(|_| ())
}

/// Fully-qualified so a branch of the same name can never win the lookup.
fn push_tag_inner(path: &str, remote: &str, name: &str) -> Result<(), String> {
    GitCmd::in_repo(path)
        .args(["push", remote, &format!("refs/tags/{name}")])
        .run()
        .map(|_| ())
}

fn delete_remote_tag_inner(path: &str, remote: &str, name: &str) -> Result<(), String> {
    GitCmd::in_repo(path)
        .args(["push", remote, "--delete", &format!("refs/tags/{name}")])
        .run()
        .map(|_| ())
}

#[tauri::command]
pub async fn create_tag(
    path: String,
    name: String,
    target: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&name)?;
    if let Some(target) = target.as_deref() {
        validate_revision(target)?;
    }
    if let Some(message) = message.as_deref() {
        validate_message(message)?;
    }
    tauri::async_runtime::spawn_blocking(move || {
        create_tag_inner(&path, &name, target.as_deref(), message.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_tag(path: String, name: String) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_ref(&name)?;
    tauri::async_runtime::spawn_blocking(move || delete_tag_inner(&path, &name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn push_tag(path: String, remote: String, name: String) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_remote_name(&remote)?;
    validate_ref(&name)?;
    tauri::async_runtime::spawn_blocking(move || push_tag_inner(&path, &remote, &name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_remote_tag(path: String, remote: String, name: String) -> Result<(), String> {
    validate_repo_path(&path)?;
    validate_remote_name(&remote)?;
    validate_ref(&name)?;
    tauri::async_runtime::spawn_blocking(move || delete_remote_tag_inner(&path, &remote, &name))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::history::testutil::{
        commit_file, git_ok, init_empty_repo, init_remote_and_clone, init_repo,
    };

    fn tag_names(repo: &str) -> String {
        git_ok(
            repo,
            &["for-each-ref", "--format=%(refname:short)", "refs/tags"],
        )
    }

    #[test]
    fn a_message_makes_the_tag_annotated() {
        let (_dir, repo) = init_repo();

        create_tag_inner(&repo, "light", None, None).unwrap();
        create_tag_inner(&repo, "heavy", None, Some("release notes")).unwrap();

        assert_eq!(
            git_ok(&repo, &["cat-file", "-t", "refs/tags/light"]),
            "commit"
        );
        assert_eq!(git_ok(&repo, &["cat-file", "-t", "refs/tags/heavy"]), "tag");
    }

    #[test]
    fn tags_a_specific_target() {
        let (_dir, repo) = init_empty_repo();
        commit_file(&repo, "file.txt", "one\n", "one");
        let first = git_ok(&repo, &["rev-parse", "HEAD"]);
        commit_file(&repo, "file.txt", "two\n", "two");

        create_tag_inner(&repo, "v0", Some(&first), None).unwrap();
        assert_eq!(git_ok(&repo, &["rev-parse", "v0^{commit}"]), first);
    }

    #[test]
    fn deletes_a_local_tag() {
        let (_dir, repo) = init_repo();
        create_tag_inner(&repo, "v1", None, None).unwrap();
        delete_tag_inner(&repo, "v1").unwrap();
        assert!(tag_names(&repo).is_empty());
        assert!(delete_tag_inner(&repo, "v1").is_err());
    }

    #[test]
    fn pushes_and_deletes_a_tag_on_a_remote() {
        let (remote, _clone, repo) = init_remote_and_clone();
        let remote_path = remote.path().to_str().expect("non-UTF-8 path").to_string();
        create_tag_inner(&repo, "v1", None, Some("first release")).unwrap();

        push_tag_inner(&repo, "origin", "v1").unwrap();
        assert_eq!(tag_names(&remote_path), "v1");

        delete_remote_tag_inner(&repo, "origin", "v1").unwrap();
        assert!(tag_names(&remote_path).is_empty());
        // Deleting on the remote leaves the local tag alone.
        assert_eq!(tag_names(&repo), "v1");
    }

    #[test]
    fn unicode_tag_names_round_trip() {
        let (_dir, repo) = init_repo();
        create_tag_inner(&repo, "versión-ñ", None, Some("acentos")).unwrap();
        assert_eq!(tag_names(&repo), "versión-ñ");
        delete_tag_inner(&repo, "versión-ñ").unwrap();
        assert!(tag_names(&repo).is_empty());
    }
}
