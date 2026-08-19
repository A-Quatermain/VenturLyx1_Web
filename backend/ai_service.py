import os
import logging
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from db import db

logger = logging.getLogger("ai_service")

# Tiered model map: (provider) -> {tier -> model}
MODEL_MAP = {
    "anthropic": {
        "heavy": "claude-sonnet-5",
        "primary": "claude-sonnet-4-6",
        "cheap": "claude-haiku-4-5-20251001",
    },
    "openai": {
        "heavy": "gpt-5.6-terra",
        "primary": "gpt-5.6-luna",
        "cheap": "gpt-5.4-mini",
    },
}

# Which tier each feature runs on
FEATURE_TIER = {
    "seo_recommendations": "primary",
    "page_generation": "primary",
    "review_response": "primary",
    "next_best_action": "primary",
    "metric_explanation": "cheap",
    "business_blueprint": "heavy",
}

PROVIDER_LABEL = {
    "anthropic": "Claude",
    "openai": "ChatGPT",
}


def _key() -> str:
    return os.environ["EMERGENT_LLM_KEY"]


def resolve_route(feature: str, provider_pref: str = "auto"):
    """Return (primary_provider, fallback_provider, tier)."""
    tier = FEATURE_TIER.get(feature, "primary")
    default_primary = os.environ.get("AI_PRIMARY_PROVIDER", "anthropic")
    default_fallback = os.environ.get("AI_FALLBACK_PROVIDER", "openai")
    if provider_pref in ("anthropic", "openai"):
        primary = provider_pref
        fallback = "openai" if provider_pref == "anthropic" else "anthropic"
    else:
        primary, fallback = default_primary, default_fallback
    return primary, fallback, tier


def _build_chat(provider: str, model: str, session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=_key(),
        session_id=session_id,
        system_message=system_message,
    ).with_model(provider, model)


async def _log_usage(business_id, feature, provider, model, chars):
    try:
        await db.ai_usage.insert_one({
            "business_id": business_id,
            "feature": feature,
            "provider": provider,
            "model": model,
            "approx_tokens": int(chars / 4),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"usage log failed: {e}")


async def stream_feature(feature, system_message, user_text, business_id=None, provider_pref="auto", session_id="s"):
    """Async generator yielding dicts: {'type':'meta'|'delta'|'done', ...}. Cross-provider fallback."""
    primary, fallback, tier = resolve_route(feature, provider_pref)
    providers = [primary, fallback]
    last_err = None
    for idx, provider in enumerate(providers):
        model = MODEL_MAP[provider][tier]
        try:
            chat = _build_chat(provider, model, f"{feature}-{session_id}", system_message)
            yield {"type": "meta", "provider": provider, "provider_label": PROVIDER_LABEL[provider], "model": model, "fallback": idx > 0}
            collected = 0
            async for event in chat.stream_message(UserMessage(text=user_text)):
                if isinstance(event, TextDelta):
                    collected += len(event.content)
                    yield {"type": "delta", "content": event.content}
                elif isinstance(event, StreamDone):
                    break
            await _log_usage(business_id, feature, provider, model, collected)
            yield {"type": "done", "provider": provider, "model": model}
            return
        except Exception as e:
            last_err = e
            logger.warning(f"AI provider {provider} failed for {feature}: {e}. Trying fallback.")
            yield {"type": "fallback_notice", "failed_provider": provider}
            continue
    yield {"type": "error", "message": f"All AI providers failed: {last_err}"}


async def generate_text(feature, system_message, user_text, business_id=None, provider_pref="auto", session_id="s"):
    """Non-streaming: collect full text with fallback. Returns (text, provider, model)."""
    full = []
    provider_used, model_used = None, None
    async for ev in stream_feature(feature, system_message, user_text, business_id, provider_pref, session_id):
        if ev["type"] == "meta":
            provider_used, model_used = ev["provider"], ev["model"]
        elif ev["type"] == "delta":
            full.append(ev["content"])
        elif ev["type"] == "error":
            raise RuntimeError(ev["message"])
    return "".join(full), provider_used, model_used
