"""
AI features via the Claude CLI (`claude -p`).
  - generate_captions: 3 caption drafts
  - tag_inbox_message: fast inbox classification
"""
import asyncio
import shutil
from typing import Optional

PLATFORM_HINTS = {
    "instagram": "Instagram (2200-char limit; add relevant hashtags at the end)",
    "twitter":   "X / Twitter (strict 280-char limit; punchy and direct)",
    "linkedin":  "LinkedIn (professional tone; insight-driven; up to 3000 chars)",
    "facebook":  "Facebook (conversational; emojis welcome; any length)",
}

VALID_TAGS = {"Question", "Complaint", "Praise", "Spam", "Other"}

CLAUDE_BIN = shutil.which("claude") or "claude"


async def _run_claude(prompt: str) -> str:
    """Run `claude -p <prompt>` and return stdout."""
    proc = await asyncio.create_subprocess_exec(
        CLAUDE_BIN, "-p", prompt,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI error: {stderr.decode().strip()}")
    return stdout.decode().strip()


async def generate_captions(
    prompt: str,
    platform: Optional[str] = None,
    tone: str = "engaging",
) -> list[str]:
    """Return 3 caption drafts."""
    platform_note = (
        f" optimised for {PLATFORM_HINTS[platform]}"
        if platform in PLATFORM_HINTS
        else ""
    )
    full_prompt = (
        f"Write 3 distinct social media caption drafts{platform_note}.\n\n"
        f"Post idea: {prompt}\n"
        f"Tone: {tone}\n\n"
        "Output exactly 3 captions separated by '---' on its own line. "
        "No numbering, labels, or explanations — just the captions."
    )
    raw = await _run_claude(full_prompt)
    parts = [c.strip() for c in raw.split("---") if c.strip()]
    while len(parts) < 3:
        parts.append(parts[0] if parts else prompt)
    return parts[:3]


async def tag_inbox_message(content: str) -> str:
    """
    Classify an inbox message as one of:
    Question | Complaint | Praise | Spam | Other
    """
    full_prompt = (
        "Classify this social media message into exactly one category: "
        "Question, Complaint, Praise, Spam, Other.\n\n"
        f'Message: "{content}"\n\n'
        "Reply with only the single category word."
    )
    tag = await _run_claude(full_prompt)
    # Strip any extra whitespace or punctuation the CLI might add
    tag = tag.strip().split()[0].rstrip(".,!") if tag.strip() else "Other"
    return tag if tag in VALID_TAGS else "Other"


VALID_SENTIMENTS = {"positive", "negative", "neutral"}


async def analyze_sentiment(content: str) -> str:
    """
    Classify the sentiment of a social media message as one of:
    positive | negative | neutral
    """
    full_prompt = (
        "Classify the sentiment of this social media message as exactly one word: "
        "positive, negative, or neutral.\n\n"
        f'Message: "{content}"\n\n'
        "Reply with only the word."
    )
    result = await _run_claude(full_prompt)
    result = result.strip().split()[0].rstrip(".,!").lower() if result.strip() else "neutral"
    return result if result in VALID_SENTIMENTS else "neutral"


async def describe_image_tags(url: str) -> list[str]:
    """
    Suggest 3-5 short content tags for categorising an image in a media library.
    Returns a list of tag strings.
    """
    full_prompt = (
        f"Look at this image URL and suggest 3-5 short content tags (single words or two-word phrases) "
        f"for categorising it in a media library. URL: {url}\n\n"
        "Reply with only a comma-separated list of tags, nothing else."
    )
    raw = await _run_claude(full_prompt)
    return [t.strip() for t in raw.split(",") if t.strip()]


REPURPOSE_FORMATS = {
    "twitter": (
        "X / Twitter thread. Start with a standalone hook tweet under 280 chars. "
        "Then number each tweet (2/, 3/, etc.), each under 280 chars. "
        "End tweet: 'If this was useful, follow for weekly system design content'. "
        "Output exactly one tweet per line, blank line between tweets. "
        "Add the link on tweet 2, NOT tweet 1."
    ),
    "instagram": (
        "Instagram caption. Use a strong opening hook line (no hashtags on line 1). "
        "Body: 3-5 bullet points of value. Closing CTA. "
        "Then on a new line, add 5-8 relevant hashtags starting with #. "
        "Total under 2200 chars."
    ),
    "tiktok": (
        "TikTok video script. Format: Hook (first 1-2 seconds — bold statement), "
        "Problem setup (5 sec), Main content (3 fast points), CTA at end. "
        "Keep total under 60 seconds when read aloud at normal pace. "
        "Add 3-5 hashtags: mix trending (#systemdesign) + niche (#faangprep)."
    ),
    "linkedin": (
        "LinkedIn text post. Relatable opening line addressing a pain point (no emoji on line 1). "
        "3-5 bullet points with actual value. "
        "One-line takeaway. Question to invite comments. "
        "CTA: 'If you're preparing for system design interviews, try SystemDesignLab free at [link]'. "
        "300-600 words. Use line breaks for scanability."
    ),
    "facebook": (
        "Facebook post. Conversational, warm tone. "
        "Ask a question or share a story. 100-300 words. "
        "Emojis welcome. End with a CTA."
    ),
    "youtube": (
        "YouTube video description. First 2 lines are a hook (appears in search previews). "
        "Then timestamps/chapters, then full description, then relevant tags at bottom. "
        "Also suggest a clickbait-style title under 60 chars."
    ),
}


async def repurpose_content(
    content: str,
    source_platform: str,
    target_platforms: list[str],
) -> dict[str, str]:
    """
    Reformat content from source_platform into each target_platform's preferred format.
    Returns a dict of {platform: reformatted_content}.
    """
    results = {}
    for platform in target_platforms:
        if platform == source_platform:
            continue
        fmt = REPURPOSE_FORMATS.get(platform, f"Rewrite for {platform}.")
        full_prompt = (
            f"Repurpose the following {source_platform} post for {platform}.\n\n"
            f"Format instructions: {fmt}\n\n"
            f"Original post:\n{content}\n\n"
            "Output only the repurposed content — no labels, no explanations."
        )
        try:
            results[platform] = await _run_claude(full_prompt)
        except Exception:
            results[platform] = f"[Repurpose failed for {platform}]"
    return results
