use std::sync::OnceLock;
use std::time::Duration;

#[derive(serde::Serialize)]
pub struct SidecarResponse {
    pub status: u16,
    pub body: String,
}

fn local_url(url: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(url).map_err(|error| error.to_string())?;
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || url.port().is_none_or(|port| port == 0)
        || !url.username().is_empty()
        || url.password().is_some()
        || !(url.path() == "/health" || url.path().starts_with("/v1/"))
    {
        return Err("Expected a local sidecar HTTP endpoint".into());
    }
    Ok(url)
}

pub async fn request(
    url: String,
    method: String,
    content_type: Option<String>,
    body: Option<Vec<u8>>,
    timeout_ms: u64,
) -> Result<SidecarResponse, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    let url = local_url(&url)?;
    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err("Unsupported sidecar HTTP method".into()),
    };
    if timeout_ms == 0 || timeout_ms > 45 * 60 * 1000 {
        return Err("Invalid sidecar timeout".into());
    }
    let client = CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)?;
    let mut request = client
        .request(method, url)
        .timeout(Duration::from_millis(timeout_ms));
    if let Some(content_type) = content_type {
        request = request.header(reqwest::header::CONTENT_TYPE, content_type);
    }
    if let Some(body) = body {
        request = request.body(body);
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|error| error.to_string())?;
    Ok(SidecarResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[test]
    fn restricts_requests_to_local_sidecars() {
        assert!(local_url("http://127.0.0.1:7772/health").is_ok());
        assert!(local_url("http://127.0.0.1:7772/v1/models/turbo/status?validate=false").is_ok());
        for url in [
            "https://example.com/v1/test",
            "http://localhost:7772/v1/test",
            "http://127.0.0.1:7772/admin",
            "http://127.0.0.1:0/health",
            "http://user@127.0.0.1:7772/health",
        ] {
            assert!(local_url(url).is_err(), "{url}");
        }
    }

    #[tokio::test]
    async fn returns_http_status_and_complete_body() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = [0; 4096];
            let read = stream.read(&mut bytes).await.unwrap();
            assert!(String::from_utf8_lossy(&bytes[..read]).starts_with("DELETE /v1/session"));
            stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 20\r\nConnection: close\r\n\r\n{\"code\":\"not_found\"}").await.unwrap();
        });
        let response = request(
            format!("http://{address}/v1/session"),
            "DELETE".into(),
            None,
            None,
            1000,
        )
        .await
        .unwrap();
        assert_eq!(response.status, 404);
        assert_eq!(response.body, "{\"code\":\"not_found\"}");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn sends_binary_audio_and_does_not_follow_redirects() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            loop {
                let mut buffer = [0; 1024];
                let read = stream.read(&mut buffer).await.unwrap();
                assert!(read > 0);
                request.extend_from_slice(&buffer[..read]);
                if let Some(end) = request.windows(4).position(|part| part == b"\r\n\r\n") {
                    if request.len() >= end + 8 {
                        assert_eq!(&request[end + 4..end + 8], &[0, 128, 63, 255]);
                        assert!(String::from_utf8_lossy(&request[..end])
                            .contains("application/octet-stream"));
                        break;
                    }
                }
            }
            stream.write_all(b"HTTP/1.1 307 Temporary Redirect\r\nLocation: http://127.0.0.1:1/health\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
        });
        let response = request(
            format!("http://{address}/v1/session/chunks"),
            "POST".into(),
            Some("application/octet-stream".into()),
            Some(vec![0, 128, 63, 255]),
            1000,
        )
        .await
        .unwrap();
        assert_eq!(response.status, 307);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn enforces_timeout_while_reading_response_body() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = [0; 4096];
            stream.read(&mut bytes).await.unwrap();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n")
                .await
                .unwrap();
            std::future::pending::<()>().await;
        });
        let response = request(
            format!("http://{address}/health"),
            "GET".into(),
            None,
            None,
            50,
        )
        .await;
        assert!(response.is_err());
        server.abort();
    }
}
