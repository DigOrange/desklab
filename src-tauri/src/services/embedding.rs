//! 向量嵌入服务
//!
//! 提供轻量级文本向量化与相似度计算

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub const EMBEDDING_DIM: usize = 384;
const MAX_TEXT_CHARS: usize = 20_000;

pub fn embed_text(text: &str) -> Vec<f32> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let content = truncate_text(trimmed, MAX_TEXT_CHARS);
    let tokens = tokenize(content);
    if tokens.is_empty() {
        return Vec::new();
    }

    let mut embedding = vec![0.0; EMBEDDING_DIM];
    for token in tokens {
        let hash = hash_token(&token);
        let index = (hash % EMBEDDING_DIM as u64) as usize;
        let sign = if (hash >> 1) & 1 == 0 { 1.0 } else { -1.0 };
        embedding[index] += sign;
    }

    normalize(&mut embedding);
    embedding
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

fn truncate_text(text: &str, max_chars: usize) -> &str {
    if text.chars().count() <= max_chars {
        return text;
    }

    let mut end = 0;
    for (idx, _) in text.char_indices().take(max_chars) {
        end = idx;
    }
    &text[..end]
}

fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() {
            current.push(ch.to_ascii_lowercase());
            continue;
        }

        if !current.is_empty() {
            tokens.push(current.clone());
            current.clear();
        }

        if is_cjk(ch) {
            tokens.push(ch.to_string());
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF
    )
}

fn hash_token(token: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    hasher.finish()
}

fn normalize(vector: &mut [f32]) {
    let norm = vector.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for value in vector.iter_mut() {
            *value /= norm;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embed_text_empty() {
        assert!(embed_text("").is_empty());
        assert!(embed_text("   ").is_empty());
    }

    #[test]
    fn test_embed_text_shape() {
        let embedding = embed_text("Hello 世界");
        assert_eq!(embedding.len(), EMBEDDING_DIM);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = embed_text("test query");
        let b = embed_text("test query");
        let c = embed_text("completely different");
        assert!(cosine_similarity(&a, &b) > cosine_similarity(&a, &c));
    }
}
